const express = require('express'),
      app = express.Router(),
      multer = require('multer'),
      bodyParser = require('body-parser'),
      // busboy = require('connect-busboy'),
      mongoose = require('mongoose'),
      Posts = require('../models/posts'),
      Tags = require('../models/tags'),
      {User, Notification} = require('../models/user'),
      verify = require('../verifyUser'),
      manageTags = require('../manageTags'),
      encrypt = require('bcryptjs'),
      JWT = require('jsonwebtoken');
require('dotenv').config();

let storage = multer.memoryStorage(),
    upload = multer({ storage: storage })

app.post('/createPost', verify, manageTags, upload.any(), async (req,res) => {
  
  const auth = req.header('auth-token');
  const base64url = auth.split('.')[1];
  const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
  const {_id, _username} = decoded; 
  
  const d = new Date();
  const month = d.getMonth();
  const date = d.getDate();
  const year = d.getFullYear();
  
  let newPost = {};
  let tagslist = null;

  console.log(req.body);
  console.log(req.files[0].buffer);

  // let buffer = Buffer.from(req.files[0].buffer, 'binary');
  // console.log(buffer);


  // if(req.body.usePostedByDate == true) {
  //   console.log(month +' '+ date +' '+ year)
  //   newPost = new Posts({
  //     owner: _id,
  //     author: _username,
  //     title: req.body.title,
  //     content: req.body.content,
  //     tags: tagslist,
  //     taggedUsers: req.body.taggedUsers,
  //     postedOn_month: month,
  //     postedOn_day: date,
  //     postedOn_year: year
  //   })
  // } 
  // else if (req.body.usePostedByDate == false) {
  //   newPost = new Posts({
  //     owner: _id,
  //     author: _username,
  //     title: req.body.title,
  //     content: req.body.content,
  //     tags: tagslist,
  //     taggedUsers: req.body.taggedUsers,
  //     postedOn_month: req.body.postedOn_month,
  //     postedOn_day: req.body.postedOn_day,
  //     postedOn_year: req.body.postedOn_year
  //   })
  // }
  
  //console.log('line 29 '+ req.body.tags);

  // let tags;
  // if(req.body.tags) {
  //   tags = req.body.tags.split(/[, ]+/);
  //   tagslist = tags.map((tag) => tag.name)
  // }
  
  // // if(tags) {
  // //   tags.forEach((tag) => {
  // //     Tags.findByIdAndUpdate(
  // //       tag.id,
  // //       {$push: {"posts": newPost}},
  // //       {upsert: true},
  // //       function(err,success) {
  // //         if(err) {
  // //           console.log(err)
  // //         } else {
  // //           console.log("tag updated")
  // //         }
  // //       }
  // //     )
  // //   })
  // // }
  
  res.send({message: "Uploaded"});
});

app.get('/log', verify, async (req,res) => {
  
  const auth = req.header('auth-token');
  const base64url = auth.split('.')[1];
  const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
  const {_id, _username} = decoded;
  const user = await User.findById(_id)
        .then(res => res.toJSON());
  const connections = user.connections;

  let social = req.query.social;
  
  if(social == 'true') {

    let socialPosts = await Posts.find({
      'owner': {$in: connections},
    });

    console.log('Retrieved social posts for ' +user.userName+ " " +socialPosts.length);

        let d = new Date(),
            currentYear = d.getFullYear(),
            currentMonth = d.getMonth(),
            currentDay = d.getDate();

        let results = socialPosts.filter((post) => {

          /*all posts made within or before current year*/
          if (post.postedOn_year <= currentYear) {

            /* removes posts within current year, but beyond current month */
            if((post.postedOn_month <= currentMonth && post.postedOn_year <= currentYear) ||
                (post.postedOn_year <= currentYear)) {

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
                  dateB = new Date(a.postedOn_year, a.postedOn_month, a.postedOn_day);

            if (dateA > dateB) return -1;
            if (dateA < dateB) return 1;
            return 0;
          })
        }

        sortByDate(results);

        let reorder = [];
        for(let i = results.length; i >= 0; i--) {
          reorder.push(results[i]);
        }
        reorder.splice(0, 1);

        res.status(200).send(reorder);
  }

  else if (social == 'false') {
    let posts = await Posts.find({owner: _id})

    console.log('Retrieved user posts for ' +user.userName+ " " +posts.length);

        let d = new Date(),
            currentYear = d.getFullYear(),
            currentMonth = d.getMonth(),
            currentDay = d.getDate();

        let results = posts.filter((post) => {

          /*all posts made within or before current year*/
          if (post.postedOn_year <= currentYear) {

            /* removes posts within current year, but beyond current month */
            if((post.postedOn_month <= currentMonth && post.postedOn_year <= currentYear) ||
                (post.postedOn_year <= currentYear)) {

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
                  dateB = new Date(a.postedOn_year, a.postedOn_month, a.postedOn_day);

            if (dateA > dateB) return -1;
            if (dateA < dateB) return 1;
            return 0;
          })
        }

        sortByDate(results);

        let reorder = [];
        for(let i = results.length; i >= 0; i--) {
          reorder.push(results[i]);
        }
        reorder.splice(0, 1);

        res.status(200).send(reorder);
  }
})

app.get('/socialLog', verify, async (req, res) => {
  
  const auth = req.header('auth-token');
  const base64url = auth.split('.')[1];
  const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
  const {_id, _username} = decoded;
  let id = mongoose.Types.ObjectId(_id);
  
  const user = await User.findById(_id)
        .then(res => res.toJSON());
        connections = user.connections;
        
  // console.log(user.connections);
  
  let allPosts = await Posts.find({
    'owner': {$in: connections},
  }).then((err, posts) => {
      if(err) {

        res.status(400).send(err);

      } else {

        let d = new Date(),
            currentYear = d.getFullYear(),
            currentMonth = d.getMonth(),
            currentDay = d.getDate();

        let result = posts.filter((post) => {

          /*all posts made within or before current year*/
          if (post.postedOn_year <= currentYear) {

            /* removes posts within current year, but beyond current month */
            if((post.postedOn_month <= currentMonth && post.postedOn_year <= currentYear) ||
                (post.postedOn_year <= currentYear)) {

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
        res.status(200).send(result);
      }
  });

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

        let postsPerMonth = []
  
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


app.get('/id', verify, async (req,res) => {
    try {
      let _ID = mongoose.Types.ObjectId(req.query.id);
      console.log(_ID);
      //.send(_ID);
      let singlePost = await Posts.findOne({_id: _ID});
      console.log(singlePost);
      res.send(singlePost +`\n`+ singlePost.createdAt);
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

  Posts.findByIdAndRemove(id, function(err,data) {
    if (!data) {
      res.status(404).send({message: "Error"});
    } else{
      res.status(200).send(true)
    }
  })
})

module.exports = app;

//10.19.2022 currently not sure if this actually makes sense ?!?
  // let usersTagged;
  // if(req.body.taggedUsers) {
  //   usersTagged = JSON.parse(JSON.stringify((req.body.taggedUsers)));
  // }
  // JSON.stringify(usersTagged);

  // // console.log(usersTagged);

  // let notifyUser = async(user) => {

  //   let tagAlert = new Notification({
  //     tagAlert: {
  //       postID: newPost._id,
  //       postTitle: newPost.title,
  //       sender: _username,
  //       /*
  //          On front end, have the title in bold and quotation marks, 
  //          the username in blue, perhaps.
  //       */
  //     }
  //   })
  //   await tagAlert.save();

  //   let userID = await User.findOne({userName: user}).then((data) => data);
  //   // console.log(userID._id)

  //   let addTagAlertToNotifs = await User.findByIdAndUpdate(
  //       userID._id,
  //       {$push: {"notifications": tagAlert}},
  //       {upsert: true}
  //     ).then((data) => {
  //       if(data) {
  //         console.log('user notified of them being tagged')
  //       } else {
  //         console.log('updating user notifs didnt work')
  //       }
  //   })
  // }

  // if(usersTagged) {
  //   usersTagged.forEach((user) => {
  //     console.log(user);
  //     notifyUser(user);
  //   })
  // }