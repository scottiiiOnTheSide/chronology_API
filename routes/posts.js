const express = require('express'),
      app = express.Router(),
      multer = require('multer'),
      sharp = require('sharp'),
      bodyParser = require('body-parser'),
      mongoose = require('mongoose'),
      {Posts, Content, Comment} = require('../models/posts'),
      {Groups} = require('../models/groups'),
      {User, Notification} = require('../models/user'),
      verify = require('../verifyUser'),
      encrypt = require('bcryptjs'),
      JWT = require('jsonwebtoken'),
      path = require('path'),
      util = require('util'),
      {Storage} = require('@google-cloud/storage');
require('dotenv').config();


/* for processing media content */
let storage = multer.memoryStorage(), //keeps data in RAM storage

    upload = multer({ storage: storage }), //sets target destination for uploads

    GCS = new Storage({ //sets GCS client globally - all paths can use this
      keyFilename: path.join(__dirname, '../logSeqMediaGCSaccess.json'),
      projectId: "aerobic-name-372620"
    }),
    uploadMedia = GCS.bucket('logseqmedia');



app.post('/createPost', verify, upload.any(), async (req,res) => {
  
  try {

    const auth = req.header('auth-token');
    const base64url = auth.split('.')[1];
    const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
    const {_id, _username} = decoded; 
    
    const d = new Date();
    const month = d.getMonth();
    const mm = month + 1;
    const date = d.getDate();
    const year = d.getFullYear();
    const timeStamp = d.getTime();

    console.log(req.body);
    console.log(req.files);
    // console.log(JSON.parse(req.body.taggedUsers));
    
    let newPost = new Posts({});
    let postContent = [];
    newPost.type = req.body.type;
    newPost.owner = _id;
    newPost.author = _username;
    newPost.title = req.body.title;
    newPost.isPrivate = req.body.isPrivate;
    newPost.profilePhoto = req.body.profilePhoto;
    newPost.privacyToggleable = req.body.privacyToggleable;

    if(req.body.geoLon) {
      newPost.location.lon = req.body.geoLon;
      newPost.location.lat = req.body.geoLat;
    }
    
    if(req.body.usePostedByDate == 'true') {
        newPost.postedOn_month = month;
        newPost.postedOn_day = date;
        newPost.postedOn_year = year;
    }
    else if (req.body.usePostedByDate == 'false') {
        newPost.postedOn_month = req.body.postedOn_month;
        newPost.postedOn_day = req.body.postedOn_day;
        newPost.postedOn_year = req.body.postedOn_year;
    }

    if(req.body.taggedUsers) {

      let recipients = []
      let taggedUsers = JSON.parse(req.body.taggedUsers);
      taggedUsers.forEach(user => {

        newPost.taggedUsers.push({
          _id: user._id,
          username: user.username
        })
        recipients.push(user._id)
      })

      await User.updateMany({ _id: {$in: recipients }}, {$inc: {interactionCount: 1}});
    }

    if(req.body.originalPost) {
      newPost.originalPost = req.body.originalPost;
    }
    
    

    /* 
      For media processing   
      loops though all media files originally in req.body,
      sends to GCS then gets their cdnURL, adds url to req.body 
    */
    for (let i = 0; i < req.files.length; i++) {

        const fileNumber = req.files[i].fieldname;
        const fileName = `${fileNumber}_${_username}_${mm}-${date}-${year}_${timeStamp}`;
        const file = uploadMedia.file(fileName);
        const options = {
          resumable: false,
          metadata: {
            contentType: 'image/jpeg/png',
          }
        };

        let fileBuffer = req.files[i].buffer;
        let fileSize = fileBuffer.length;
        let reducedFile = await sharp(fileBuffer).jpeg({ quality: 32, mozjpeg: true }).toBuffer();
        await file.save(reducedFile, options);

        await uploadMedia.setMetadata({
            enableRequesterPays: true,
              website: {
                mainPageSuffix: 'index.html',
                notFoundPage: '404.html',
              },
        });

      
        const [cdnUrl] = await file.getSignedUrl({
          action: 'read',
          expires: '01-01-2499',
        });

        let title = `${fileNumber}`;

        req.body[title] = cdnUrl;
    }

    /* 
       FOR ADDING CONTENT
       Loop through all numbered entries within the req.body,
       add urls and content to new array of objects,
       have said array be post.Content
       organizes data in order user originally intended
    */

    let body = {}
    Object.assign(body, req.body);
    for (let value in body) { //must use for ... in regarding objects

      if( Number.isInteger( parseInt(value) )) {
        if(body[value] == '') {
          continue;
        } else {

        if(value % 1 != 0) {//if media link

            //08. 30. 2023 extract filename from link here
            let data = new Content({
              place: value,
              type: "media",
              content: body[value]
            })

            postContent.push(data);

          } else {

            let data = new Content({
              place: value,
              type: "text",
              content: body[value]
            })
            postContent.push(data);
          }
        }
      }
    }

    postContent.sort((a, b) => {
      return a.place - b.place;
    })

    postContent.forEach((element) => {
      newPost.content.push(element);
    })

    //updates tags to include new post created with them
    if(req.body.tags) {

      let split = req.body.tags.split(',');
      console.log(split)
      let tags = await Groups.find({name: {$in: split}, type: 'tag'});
      console.log(tags)

      newPost.tags = [];

      tags.forEach(tag => {
        newPost.tags.push({
          name: tag.name,
          _id: tag._id,
          isPrivate: tag.isPrivate
        })
      })

      /* for finding topics ...? */
      split.forEach(tag => {
        if(tags.find(t => t.name != tag)) {
          newPost.tags.push({
            name: tag
          })
        }
      })

      await Groups.updateMany({"name": {$in: tags.map(tag => tag.name)}},
                              {type: 'tag'},
                              {$push: {"posts": newPost._id}});
    }

    //increment user's interactionCount
    let newPoint = await User.updateOne( { _id: _id}, { $inc: { interactionCount: 1 } });

    newPost.save();
    console.log(`"${newPost.title}" from @${_username} uploaded successfully`);
    res.status(200).send({postURL: newPost._id, postTitle: newPost.title, confirm: true});

  }
  catch(err) {
    console.log(err);
    res.status(400).send({message: 'An Error Has Occured. Please Try Again'});
  }
});


app.get('/log', verify, async (req,res) => {

  try {

    const auth = req.header('auth-token');
    const base64url = auth.split('.')[1];
    const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
    const {_id, _username} = decoded;
    const user = await User.findById(_id);
    const connections = user.connections;

    let type = req.query.type,
        monthChart = req.query.monthChart;
    
    if(type == 'social') {

        /* 05. 09. 2024
           need to filter posts by privacyDefault on or off
        */

        let socialPosts = await Posts.find(
          {'owner': {$in: connections}, 
           'type': {$ne: "draft"}}
        ).sort(
          {createdAt: -1}
        ).populate('owner', 'username profilePhoto')

        console.log('Retrieved social posts for ' +user.userName+ " " +socialPosts.length);

          let d = new Date(),
              currentYear = d.getFullYear(),
              currentMonth = d.getMonth(),
              currentDay = d.getDate();

          let results = socialPosts.filter((post) => {

            if(post.isPrivate == true) {
              return null;
            }

            /*all posts made within or before current year*/
            else if (post.postedOn_year <= currentYear) {

              /* removes posts within current year, beyond current month */
              if(post.postedOn_year == currentYear && post.postedOn_month > currentMonth) {
                 return null;
              }
                  
              if(post.postedOn_day > currentDay && post.postedOn_month == currentMonth) {
                 return null;
              }

              else {
                return post;
              }
            }
          });

          let sortByDate = (posts) => {

            posts.sort((a,b) => {

              const dateA = new Date(a.postedOn_year, a.postedOn_month, a.postedOn_day),
                    dateB = new Date(b.postedOn_year, b.postedOn_month, b.postedOn_day);

              if (dateA > dateB) return -1;
              if (dateA < dateB) return 1;
              return 0;
            })
          }

          sortByDate(results);
          console.log("Results reordered");

          // results.forEach((post) => {
          //   console.log(post.postedOn_month+ "." +post.postedOn_day+ "." +post.postedOn_year);
          // })

          /* 10. 02. 2023 No longer necessary ...? */
          // let reorder = [];
          // for(let i = results.length; i >= 0; i--) {
          //   reorder.push(results[i]);
          // }
          // reorder.splice(0, 1);

          res.status(200).send(results)
    }
    else if (type == 'user') {

      // let posts = await Posts.find(
      //   {owner: _id, type: {$ne: "draft"}}, 
      // ).sort(
      //   {createdAt: -1}
      // ).populate('owner', 'username profilePhoto').populate('taggedUsers.id', 'username');

      let posts;
      if (req.query.userID == 'undefined'){

        posts = await Posts.find({
          owner: mongoose.Types.ObjectId(_id),
          type: { $ne: "draft" }
        }).sort(
          { createdAt: -1 }
        ).populate({
          path: 'originalPost',
          populate: {path: 'owner', select: 'username profilePhoto'}
        });
      }
      else if(req.query.userID) {

        console.log("retreving posts for user" +req.query.userID);

        posts = await Posts.find({
          owner: mongoose.Types.ObjectId(req.query.userID),
          type: { $ne: "draft" },
          isPrivate: false
        }).sort(
          { createdAt: -1 }
        ).populate({
          path: 'originalPost',
          populate: {path: 'owner', select: 'username profilePhoto'}
        });

      }

          let d = new Date(),
              currentYear = d.getFullYear(),
              currentMonth = d.getMonth(),
              currentDay = d.getDate();

          let results = posts.filter((post) => {

            /*all posts made within or before current year*/
            if (post.postedOn_year <= currentYear) {


              /* removes posts within current year, beyond current month */
              if(post.postedOn_year == currentYear && post.postedOn_month > currentMonth) {
                 return null;
              }
                  
              if(post.postedOn_day > currentDay && post.postedOn_month == currentMonth) {
                 return null;
              }

              else {
                return post;
              }
            }
          });

          let sortByDate = (posts) => {

            posts.sort((a,b) => {

              const dateA = new Date(a.postedOn_year, a.postedOn_month, a.postedOn_day),
                    dateB = new Date(b.postedOn_year, b.postedOn_month, b.postedOn_day);

              if (dateA > dateB) return -1;
              if (dateA < dateB) return 1;
              return 0;
            })
          }

          sortByDate(results);
          console.log("Results reordered");
          // console.log(results);

        res.status(200).send(results)
    }

    else if(type == 'customLog') {

      console.log('customLog ' +req.query.logNumber);
      let posts;

      if(req.query.logNumber == 0) { //user only

        posts = await Posts.find({
          owner: mongoose.Types.ObjectId(_id),
          type: { $ne: "draft" }
        }).sort(
          { createdAt: -1 }
        ).populate({
          path: 'originalPost',
          populate: {path: 'owner', select: 'username profilePhoto'}
        }).sort(
          { createdAt: -1 }
        ).populate({
          path: 'originalPost',
          populate: {path: 'owner', select: 'username profilePhoto'}
        });
      }
      else {
        let user = await User.findById(_id);
        let customLog = user.settings.customLogs.log[req.body.logNumber];

        posts = await Posts.find({
          type: { $ne: 'draft' },
          isPrivate: false,
          $or: [
            { owner: { $in: customLog.connections } }, 
            { owner: { $in: customLog.subscriptions } }, 
            { tags: { $in: customLog.tags } }, 
            { topics: { $in: customLog.topics } },
            { 'location.city': { $in: customLog.locations } }
          ]
        }).sort(
          { createdAt: -1 }
        ).populate({
          path: 'originalPost',
          populate: {path: 'owner', select: 'username profilePhoto'}
        });
      }

      let d = new Date(),
          currentYear = d.getFullYear(),
          currentMonth = d.getMonth(),
          currentDay = d.getDate();

      let results = posts.filter((post) => {

            /*all posts made within or before current year*/
            if (post.postedOn_year <= currentYear) {


              /* removes posts within current year, beyond current month */
              if(post.postedOn_year == currentYear && post.postedOn_month > currentMonth) {
                 return null;
              }
                  
              if(post.postedOn_day > currentDay && post.postedOn_month == currentMonth) {
                 return null;
              }

              else {
                return post;
              }
            }
      });

      let sortByDate = (posts) => {

            posts.sort((a,b) => {

              const dateA = new Date(a.postedOn_year, a.postedOn_month, a.postedOn_day),
                    dateB = new Date(b.postedOn_year, b.postedOn_month, b.postedOn_day);

              if (dateA > dateB) return -1;
              if (dateA < dateB) return 1;
              return 0;
            })
      }

      sortByDate(results);
      console.log("Results reordered");

      res.status(200).send(results)

    }

    else if (type == 'drafts') {

      let posts = await Posts.find(
        {owner: _id, type: "draft"}, 
      ).sort({createdAt: -1})

      // console.log('line366 in /posts' +posts);

      res.status(200).send(posts);
    } 
    else if (type == 'deleteDraft') {

      await Posts.findByIdAndDelete(mongoose.Types.ObjectId(req.query.postID));
      res.status(200).send(true);
    }
    
  } catch(err) {

    console.log(err);
    res.status(400).send({message: "An Error Has Occured. Please Try Again"});
  }
})


app.get('/monthChart', verify, async (req, res) => {
  try {

    /*
      Break down auth token to retrieve user _id
    */
    const auth = req.header('auth-token');
    const base64url = auth.split('.')[1];
    const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
    const {_id, _username} = decoded; 
    let id = mongoose.Types.ObjectId(_id);
    let user = await User.findById(_id)
          .then(res => res.toJSON());
          connections = user.connections;

    const month = req.query.month,
          year = req.query.year,
          day = req.query.day,
          social = req.query.social;

    console.log(month + day + year + social);

  if (social == 'true' && !day) {/* Social monthChart request*/
      
      console.log('social true day false');

            let postsPerMonth = []

            let results = await Posts.find({
              owner: {$in: connections},
              postedOn_month: month,
              postedOn_year: year
            });

            if (results) {
                let daysInSelectedMonth;

                if(month == 1) {
                  daysInSelectedMonth = new Date(year, 2, 0).getDate();
                } else if (month == 2) {
                  daysInSelectedMonth = new Date(year, 3, 0).getDate();
                } else {
                  daysInSelectedMonth = new Date(year, month+1, 0).getDate();
                }

                for(y = 0; y <= daysInSelectedMonth; y++) {
                  let postsPerDate = 0;
                  if(results.length == 0) {
                      postsPerMonth.push(postsPerDate);
                  } else {
                    for(i=0; i < results.length; i++) {
                      if(results[i].postedOn_day == y) {
                        postsPerDate++;
                      }    
                    }
                    postsPerMonth.push(postsPerDate);
                  }
                }

                res.status(200).send(postsPerMonth);
                console.log(`Posts Per Month ${month}. ${year}\n`+postsPerMonth);
            }
            else {
              res.status(404).send({ error: `Unable to obtain posts per date for ${month} . ${year}`})
              console.log(`Unable to obtain posts per date for ${month} . ${year}`);
            }

      } 

  if (social == 'true' && day) {/* get all posts for full date */
          
        console.log('social true day true');

        let postsForDate = []
          
        let results = await Posts.find({
            'owner': {$in: connections},
            postedOn_month: month,
            postedOn_year: year,
            postedOn_day: day,
          });
      
        if (results) {
          res.status(200).send(results);
        } else {
          res.status(400).send('No posts for this day(?)')
          console.log('No posts for this day(?)') 
        }
      }

  if (social == 'false' && !day ) { /* if not a social monthChart request*/

      console.log('social false day false');

        let postsPerMonth = []

        let results = await Posts.find({
            owner: _id,
            postedOn_month: month,
            postedOn_year: year
        });

        if (results) {

          let daysInSelectedMonth;

          if(month == 1) {
            daysInSelectedMonth = new Date(year, 2, 0).getDate();
          } else if (month == 2) {
            daysInSelectedMonth = new Date(year, 3, 0).getDate();
          } else {
            daysInSelectedMonth = new Date(year, month+1, 0).getDate();
          }

          // let postsPerMonth = []
    
          for(y = 0; y <= daysInSelectedMonth; y++) {
            let postsPerDate = 0;
            if(results.length == 0) {
              postsPerMonth.push(postsPerDate);
            } else {
              for(i=0; i < results.length; i++) {
                if(results[i].postedOn_day == y) {
                  postsPerDate++;
                }    
              }
            postsPerMonth.push(postsPerDate);
            }
          }

          res.status(200).send(postsPerMonth);
          console.log(`Social Posts Per Month ${month}. ${year}\n`+postsPerMonth);

        } else {
          res.status(404).send({ error: `Unable to obtain posts per date for ${month} . ${year}`})
          console.log(`Unable to obtain posts per date for ${month} . ${year}`);
        }
      }
      
  if (social == 'false' && day) {

      console.log('social false day true');

        let postsPerDate = [];

        let results = await Posts.find({
          'owner': _id,
          postedOn_month: month,
          postedOn_year: year,
          postedOn_day: day,
        });

        if (!results) {
          res.status(400).send('No posts for this date ${month} . ${day}')
          console.log(`No posts for this date ${month} . ${day}`)
        } else {
            res.status(200).send(results);
        }}
    
  } catch(err) {

    console.log(err);
    res.status(400).send({message: "An Error Has Occured. Please Try Again"});
  }
});


app.get('/:id', verify, async (req,res) => {
    try {
      let _ID = mongoose.Types.ObjectId(req.params.id);
      let singlePost = await Posts.findOne({_id: _ID});
      console.log('post found and sent');
      res.status(200).send(singlePost);
    }
    catch (err) {
      console.log(err);
      res.status(404).send({message: "Post does not exist!" })
    }
});

/**
 * 12. 12. 2023 - To Be Developed
 */
app.patch('/updatePost', verify, async (req,res) => {

  try {


    
  } catch(err) {

    console.log(err);
    res.status(400).send({message: "An Error Has Occured. Please Try Again"});
  }
})


app.delete('/deletePost', verify, async(req,res) => {
  
  try {

    const id = mongoose.Types.ObjectId(req.query.id);

    async function deleteFile(filename) {
      await GCS.bucket('logseqmedia').file(filename).delete();
      console.log(`${filename} deleted from GCS`);
    }

    await Posts.findByIdAndRemove(id, (err, data)=> {
        if(!data) {
          console.log('error')
        }
        else {

          /* Deletes all post media from GCS database */
          for(let i = 0; i < data.content.length; i++) {
            if(data.content[i].place % 1 != 0) { //for the media links
              let string = data.content[i].content;
              let substring = string.substring(43);
              let cutoff = parseInt(substring.indexOf('?'));
              let filename = substring.substring(0, cutoff);

              console.log(filename);
              deleteFile(filename).catch(console.error);
            }
          }
          console.log(data.title + ' deleted');
        }
    });

    let comments = await Comment.deleteMany({parentPost: req.query.id});
    console.log(comments.deletedCount + "comments deleted for post:" +req.query.id);

    res.status(200).send(true);
    
  } catch(err) {

    console.log(err);
    res.status(400).send({message: "An Error Has Occured. Please Try Again"});
  }
  
})


app.use('/comment/:type', verify, async(req, res)=> {

  const auth = req.header('auth-token');
  const base64url = auth.split('.')[1];
  const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
  const {_id, _username} = decoded;
  const user = await User.findById(_id);

  try {

    const type = req.params.type;

    if (type == 'getComments') {

      console.log('Getting comments for ' +req.query.postID);
      // let comments = await Comment.find({ parentPost: mongoose.Types.ObjectId(req.query.postID), topLevel: true }).populate({
      //   path: 'replies',
      //   populate: { path: 'replies'}
      // });

      const populateRepliesRecursively = async (comment) => {
          if (!comment.replies || comment.replies.length === 0) {
              return comment; // No more replies to populate
          }

          // Populate replies for the current comment
          comment.replies = await Comment.find({ _id: { $in: comment.replies } }).lean();

          // Recursively populate each reply
          for (let i = 0; i < comment.replies.length; i++) {
              comment.replies[i] = await populateRepliesRecursively(comment.replies[i]);
          }

          return comment;
      };

      let comments = await Comment.find({ parentPost: mongoose.Types.ObjectId(req.query.postID), topLevel: true }).lean();

      // Recursively populate all replies
      for (let i = 0; i < comments.length; i++) {
          comments[i] = await populateRepliesRecursively(comments[i]);
      }

      console.log(comments);

      res.status(200).send(comments);
    }

    else if(type == 'updateCount') {

      
      let commentCount = await Comment.find({ parentPost: mongoose.Types.ObjectId(req.query.postID) }).count();

      await Posts.updateOne(
          {_id: req.query.postID},
          { $set: {commentCount: commentCount}},
          {multi: true}
      );
      console.log('updating comment count for post, which is . . .');
      console.log(commentCount);

      res.status(200).send(true);
    }

    else if(type == 'initial') {
      console.log(req.body)
      let newComment = new Comment({
        ownerUsername: req.body.ownerUsername,
        ownerID: req.body.ownerID,
        parentPost: req.body.parentPost,
        profilePhoto: req.body.profilePhoto,
        parentID: req.body.parentID,
        content: req.body.content,
        postedOn_month: req.body.postedOn_month,
        postedOn_day: req.body.postedOn_day,
        postedOn_year: req.body.postedOn_year,
        commentNumber: req.body.commentNumber,
        topLevel: true,
        replies: []
      })
      newComment.save();

      //update user's interactionCount....
      //if post owner isn't also the commentor
      if(req.body.ownerID != req.body.postOwner) {
        await User.updateOne( { _id: _id}, { $inc: { interactionCount: 1 } });
      }
      //if postOwner isn't current user, update their count
      if(req.body.postOwner != _id) {
        await User.updateOne( { _id: req.body.postOwner}, { $inc: { interactionCount: 1 } });
      }

      res.status(200).send(newComment._id);
    }

    else if(type == 'response') {

      let newComment = new Comment({
        ownerUsername: req.body.ownerUsername,
        ownerID: req.body.ownerID,
        profilePhoto: req.body.profilePhoto,
        parentPost: req.body.parentPost,
        parentComment: req.body.parentComment,
        content: req.body.content,
        postedOn_month: req.body.postedOn_month,
        postedOn_day: req.body.postedOn_day,
        postedOn_year: req.body.postedOn_year,
        commentNumber: req.body.commentNumber,
        topLevel: false,
        replies: []
      });
      newComment.save();

      await Comment.findOneAndUpdate(
        {_id: mongoose.Types.ObjectId(req.body.parentComment)},
        {$push: {replies: newComment._id}},
        [{upsert: true}, {useFindandModify: false}]).then((data) => {
          if(data) {
            console.log(`reply comment ${newComment._id} was added to parent comment ${req.body.parentComment}`);
          } else {
            console.log(`error in adding reply ${newComment._id} to parent ${newComment.parentID}`);
          }
      })

      //increment users interactionPoints
      let ids = [_id, req.body.respondeeId, req.body.postOwner];
      if(req.body.respondeeId != _id) {
        await User.updateMany({ _id: {$in: ids }}, {$inc: {interactionCount: 1}});
      }

      res.status(200).send(newComment._id);
    }

    else if(type == 'delete') {

      let commentID = req.query.commentID;

      let comment = await Comment.findById(commentID);

      if(comment.replies.length > 0) {
        await Comment.updateOne(
          {_id: commentID},
          {$set: {
            content: 'This comment has been deleted',
            ownerUsername: '',
            ownerID: '',
            profilePhoto: ''
          }}
        )
      }
      else {
        await Comment.findByIdAndRemove(commentID);
      }

      

      res.status(200).send({confirm: true});
    }
  } 
  catch(err) {

    console.log(err);
    res.status(400).send({message: "An Error Has Occured. Please Try Again"});
  }

})

module.exports = app;