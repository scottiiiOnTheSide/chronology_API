const express = require('express'),
      app = express.Router(),
      multer = require('multer'),
      bodyParser = require('body-parser'),
      mongoose = require('mongoose'),
      {Posts, Content, Comment} = require('../models/posts'),
      {Group} = require('../models/groups'),
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
    
    let newPost = new Posts({});
    let postContent = [];

    console.log(req.body);

    /* media processing stuff */
      /*  
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

        await file.save(req.files[i].buffer, options);

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

    // /* 05. 01. 2023
    //    Loop through all numbered entries within the req.body,
    //    add urls and content to new array of objects,
    //    have said array be post.Content
    //    organizes data in order user originally intended
    // */

    if(req.body.usePostedByDate == 'true') {
        console.log(month +' '+ date +' '+ year);
        newPost.owner = _id;
        newPost.author = _username;
        newPost.title = req.body.title;
        newPost.taggedUsers = req.body.taggedUsers;
        newPost.postedOn_month = month;
        newPost.postedOn_day = date;
        newPost.postedOn_year = year;
        newPost.isPrivate = req.body.isPrivate;
    }
    else if (req.body.usePostedByDate == 'false') {
        newPost.owner = _id;
        newPost.author = _username;
        newPost.title = req.body.title;
        newPost.taggedUsers = req.body.taggedUsers;
        newPost.postedOn_month = req.body.postedOn_month;
        newPost.postedOn_day = req.body.postedOn_day;
        newPost.postedOn_year = req.body.postedOn_year;
        newPost.isPrivate = req.body.isPrivate;
    }

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

      let tags = req.body.tags.split(',');
      newPost.tags = tags;
      newPost.save();

      (async()=> {
        await Group.updateMany({"name": {$in: tags}},
                                {$push: {"posts": newPost._id}});
      })
    } else {
      newPost.save();
    }

    // await newPost.save().then((post) => {
    //   if(post) {
        console.log(`"${newPost.title}" uploaded successfully`);
        res.status(200).send({postURL: newPost._id, postTitle: newPost.title, confirm: true});
    //   } else {
    //     console.log("There was an issue with the upload...");
    //     res.status(400).send(false);
    //   }
    // });

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

    let social = req.query.social,
        monthChart = req.query.monthChart;
    
    if(social == 'true') {

        /* 05. 09. 2024
           need to filter posts by privacyDefault on or off
        */

        let socialPosts = await Posts.find({
          'owner': {$in: connections},
        }).sort({createdAt: -1})

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
    else if (social == 'false') {

      let posts = await Posts.find({owner: _id}).sort({createdAt: -1})

        // console.log('Retrieved ' +posts.length+ ' user posts for ' +user.userName);

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
      // console.log(_ID);
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

    Posts.findByIdAndRemove(id, (err, data)=> {
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
          console.log(data.title + 'deleted');
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


app.post('/comment/:type', verify, async(req, res)=> {

  try {

    const type = req.params.type;

    if (type == 'getAll') {

      console.log('Getting comments for ' +req.body.parentID);
      let comments = await Comment.find({ parentID: mongoose.Types.ObjectId(req.body.parentID)} );
      // console.log(comments);
      res.status(200).send(comments);
    }

    else if(type == 'updateCount') {

      let post = await Posts.findOne({_id: req.query.postID});
      post.commentCount = req.query.count;
      post.save()
      res.status(200).send(true);

    }

    else if(type == 'initial') {

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
        replies: []
      })
      newComment.save();

      await Posts.findOneAndUpdate(
        {_id:mongoose.Types.ObjectId(req.body.parentID)},
        {$push: {comments: newComment}},
        [{upsert: true}, {useFindandModify: false}]).then((data) => {
          if(data) {
            console.log(`comment ${newComment._id} was made to post ${newComment.parentID}`);
            res.status(200).send(newComment._id);
          } else {
            console.log(`error in adding comment ${newComment._id} to post ${newComment.parentID}`);
          }
      })
    }

    else if(type == 'response') {

      let newComment = new Comment({
        ownerUsername: req.body.ownerUsername,
        ownerID: req.body.ownerID,
        profilePhoto: req.body.profilePhoto,
        parentPost: req.body.parentPost,
        parentID: req.body.parentID,
        content: req.body.content,
        postedOn_month: req.body.postedOn_month,
        postedOn_day: req.body.postedOn_day,
        postedOn_year: req.body.postedOn_year,
        commentNumber: req.body.commentNumber,
        replies: []
      });
      newComment.save();
      
      let post = await Posts.findById(req.body.parentPost);
      let comments = post.comments,
          commentPlace = req.body.commentNumber.split("-");
      let parentComment = comments[parseInt(commentPlace[0]) - 1];

      console.log(commentPlace)
      console.log(parentComment)

      let i = 1;
      while(i <= commentPlace.length - 2) { //should stop before last number
          parentComment = parentComment.replies[parseInt(commentPlace[i]) - 1];
          i++;
      }
      parentComment.replies.push(newComment);
      post.save();

      res.status(200).send(newComment._id);
    }
  } catch(err) {

    console.log(err);
    res.status(400).send({message: "An Error Has Occured. Please Try Again"});
  }

})

module.exports = app;