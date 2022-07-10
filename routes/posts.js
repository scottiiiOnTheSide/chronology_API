const express = require('express'),
      app = express.Router(),
      mongoose = require('mongoose'),
      Posts = require('../models/posts'),
      Tags = require('../models/tags'),
      verify = require('../verifyUser');
      manageTags = require('../manageTags');
      encrypt = require('bcryptjs'),
      JWT = require('jsonwebtoken');
require('dotenv').config();

app.post('/createPost', verify, manageTags, async (req,res) => {
  
  const auth = req.header('auth-token');
  const base64url = auth.split('.')[1];
  const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
  const {_id, _username} = decoded; 
  
  const d = new Date();
  const month = d.getMonth();
  const date = d.getDate();
  const year = d.getFullYear();
  
  let newPost = {};
  //await newPost.save();
  if(req.body.usePostedByDate == true) {
    console.log(month +' '+ date +' '+ year)
    newPost = new Posts({
      owner: _id,
      author: _username,
      title: req.body.title,
      content: req.body.content,
      tags: req.body.tags,
      postedOn_month: month,
      postedOn_day: date,
      postedOn_year: year
    })
  } else {
    newPost = new Posts({
      owner: _id,
      author: _username,
      title: req.body.title,
      content: req.body.content,
      tags: req.body.tags
    })
  }
  
  //console.log('line 29 '+ req.body.tags);
  let tags = req.body.tags;
  
  tags.forEach((tag) => {
    Tags.findByIdAndUpdate(
      tag,
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
      
  console.log('line 44'+ newPost);
  await newPost.save();
  res.send(newPost);
});

app.get('/log', verify, async (req,res) => {
  
  const auth = req.header('auth-token');
  const base64url = auth.split('.')[1];
  const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
  const {_id, _username} = decoded; 
  
  try {
    /*console.log(_id +`\n`+ _username);
    console.log(req.query.month)
    console.log(req.query.year)
    res.send("👍🏾")*/
    Posts.find({
      owner: _id,
      postedOn_month: req.query.month,
      postedOn_year: req.query.year
    }, (err, posts) => {
      if (err) {
        res.send(err)
      } else {
        console.log(posts +`\n`+ typeof(posts))
        res.status(200).json(posts);
        //res.send(posts);//sends an array
      }
    })
    
  } catch (err) {
    res.status(404);
    res.send(
      { error: "Post does not exist!" }
    )
    console.log("I am unsure what failed");
  }
})
//redesign this controller to take a query
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

app.use('/deletePost', verify, (req,res) => {
})

app.use('/updatePost', verify, (req,res) => {
})

module.exports = app;
