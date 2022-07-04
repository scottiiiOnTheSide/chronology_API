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

app.use('/createPost', verify, manageTags, async (req,res) => {
  
  const auth = req.header('auth-token');
  const base64url = auth.split('.')[1];
  const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
 //res.send(decoded); ✔️ 
  const {_id, _username} = decoded; 
  
  let newPost = new Posts({
    owner: _id,
    author: _username,
    title: req.body.title,
    content: req.body.content,
    tags: req.body.tags
  })
  //await newPost.save(); 
  
  console.log('line 29 '+ req.body.tags);
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

app.use('/post/:id', verify, async (req,res) => {
    try {
      let _ID = mongoose.Types.ObjectId(req.params.id);
      console.log(_ID);
      //.send(_ID);
      let singlePost = await Posts.findOne({_id: _ID});
      console.log(singlePost);
      res.send(singlePost);
    }
    catch {
      res.status(404) 		
      res.send({ error: "Post doesn't exist!" })
    }
});

app.use('/returnPost', verify, (req,res) => {
});

app.use('/deletePost', verify, (req,res) => {
})

app.use('/updatePost', verify, (req,res) => {
})

module.exports = app;
