const express = require('express'),
      app = express.Router(),
      multer = require('multer'),
      bodyParser = require('body-parser'),
      mongoose = require('mongoose'),
      {Posts, Content, Comment} = require('../models/posts'),
      // Tags = require('../models/tags'),
      {User, Notification} = require('../models/user'),
      verify = require('../verifyUser'),
      // manageTags = require('../manageTags'),
      manageImages = require('../manageImages'),
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
  let tagslist = null;

  console.log(req.body);

  //converts provided tags to be stored in doc by name, rather than their IDs
  let tags;
  // if(req.body.tags != '') {
  //   tags = req.body.tags.split(/[, ]+/);
  //   tagslist = tags.map((tag) => tag.name)
  // } else if(req.body.tags == undefined) {
  //   return;
  // }


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

      //necessary...?
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
    console.log(month +' '+ date +' '+ year)
      newPost.owner = _id;
      newPost.author = _username;
      newPost.title = req.body.title;
      newPost.tags = tagslist;
      newPost.taggedUsers = req.body.taggedUsers;
      newPost.postedOn_month = month;
      newPost.postedOn_day = date;
      newPost.postedOn_year = year;
  }
  else if (req.body.usePostedByDate == 'false') {
      newPost.owner = _id;
      newPost.author = _username;
      newPost.title = req.body.title;
      newPost.tags = tagslist;
      newPost.taggedUsers = req.body.taggedUsers;
      newPost.postedOn_month = req.body.postedOn_month;
      newPost.postedOn_day = req.body.postedOn_day;
      newPost.postedOn_year = req.body.postedOn_year;
  }

  //updates tags to include new post created with them  
  if(tags) {
    tags.forEach((tag) => {
      Tags.findByIdAndUpdate(
        tag.id,
        {$push: {"posts": newPost}},
        {upsert: true},
        function(err,success) {
          if(err) {
            console.log(err)
          } else {
            console.log("tag updated")
          }
        }
      )
    })
  } 
  else if (tags == '' || tags == 'undefined') {
      return null;
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

  await newPost.save().then((post) => {
    if(post) {
      console.log(`"${post.title}" uploaded successfully`);
      res.status(200).send({postURL: post._id, postTitle: post.title, confirm: true});
    } else {
      console.log("There was an issue with the upload...");
      res.status(400).send(false);
    }
  });
});


app.get('/log', verify, async (req,res) => {
  
  const auth = req.header('auth-token');
  const base64url = auth.split('.')[1];
  const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
  const {_id, _username} = decoded;
  const user = await User.findById(_id)
        .then(res => res.toJSON());
  const connections = user.connections;

  let social = req.query.social,
      monthChart = req.query.monthChart;
  
  if(social == 'true') {

      let socialPosts = await Posts.find({
        'owner': {$in: connections},
      })

      console.log('Retrieved social posts for ' +user.userName+ " " +socialPosts.length);

        let d = new Date(),
            currentYear = d.getFullYear(),
            currentMonth = d.getMonth(),
            currentDay = d.getDate();

        let results = socialPosts.filter((post) => {

          /*all posts made within or before current year*/
          if (post.postedOn_year <= currentYear) {

            /* removes posts within current year, but beyond current month */
            if((post.postedOn_month <= currentMonth)) {

                /* exclude posts within current month, beyond current day*/
                if(post.postedOn_day > currentDay && !post.postedOn_month == currentMonth) {
                  return null;
                }

                else {
                  return post;
                }
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

      console.log('Retrieved ' +posts.length+ ' user posts for ' +user.userName);

        let d = new Date(),
            currentYear = d.getFullYear(),
            currentMonth = d.getMonth(),
            currentDay = d.getDate();

        let results = posts.filter((post) => {

          /*all posts made within or before current year*/
          if (post.postedOn_year <= currentYear) {

            /* removes posts within current year, but beyond current month */
            if((post.postedOn_month <= currentMonth)) {

                /* exclude posts within current month, beyond current day*/
                if(post.postedOn_day > currentDay && !post.postedOn_month == currentMonth) {
                  return null;
                }

                else {
                  return post;
                }
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
        // for(let i = results.length -1 ; i >= 0; i--) {
        //   reorder.push(results[i]);
        // }

      res.status(200).send(results)
    } 
})


app.get('/monthChart', verify, async (req, res) => {
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
      res.status(404) 		
      res.send({ error: "Post does not exist!" })
      console.log("here");
    }
});


app.patch('/updatePost', verify, async (req,res) => {
  
  const id = mongoose.Types.ObjectId(req.query.id);
  const updatedContent = {
    title: req.body.title,
    content: req.body.content,
    tags: req.body.tags
  }
  
  Posts.findByIdAndUpdate(id, updatedContent, {useFindandModify: false})
  .then(data => {
    if (!data) {
      res.status(404).send({message: "Error"});
    } else{
      res.status(200).send({message: "Post Updated"})
    }
  })
})


app.delete('/deletePost', verify, async(req,res) => {
  
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
        // console.log(data.content)

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

        res.status(200).send(true)
      }
  });
})


app.post('/comment/:type', verify, async(req, res)=> {

  const type = req.params.type;
  // console.log(req.body);

  if (type == 'getAll') {

    console.log('Getting comments for ' +req.body.parentID);
    let comments = await Comment.find({ parentID: mongoose.Types.ObjectId(req.body.parentID)} );
    // console.log(comments);
    res.status(200).send(comments);

  }
  else if(type == 'initial') {

    let newComment = new Comment({
      ownerUsername: req.body.ownerUsername,
      ownerID: req.body.ownerID,
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
          console.log(`comment ${newComment._id} was made to a post ${newComment.parentID}`);
          res.status(200).send(true);
        } else {
          console.log(`error in adding comment ${newComment._id} to post ${newComment.parentID}`);
        }
    })
  }
  else if(type == 'response') {

    let newComment = new Comment({
      ownerUsername: req.body.ownerUsername,
      ownerID: req.body.ownerID,
      parentID: req.body.parentID,
      content: req.body.content,
      postedOn_month: req.body.postedOn_month,
      postedOn_day: req.body.postedOn_day,
      postedOn_year: req.body.postedOn_year,
      commentNumber: req.body.commentNumber,
      replies: []
    })
    newComment.save();

    await Comment.findOneAndUpdate(
      {_id: mongoose.Types.ObjectId(req.body.parentID)},
      { $push: { replies: newComment } },
      [{upsert: true}, {useFindandModify: false}]).then((data) => {
        if(data) {
          console.log(`reply ${newComment._id} was made to comment ${newComment.parentID}`);
          console.log(data.replies)
          res.status(200).send(true);
        } else {
          console.log(`error in adding comment ${newComment._id} to comment ${newComment.parentID} replies`);
        }
    })

    // let originalComment = await Comment.findOne({_id: mongoose.Types.ObjectId(req.body.parentID)});
    // originalComment.replies.push(newComment);
    // Comment.markModified(originalComment);
    // originalComment.save();
    // console.log(originalComment.replies);
  }

})

module.exports = app;