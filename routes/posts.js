const express = require('express'),
      app = express.Router(),
      mongoose = require('mongoose'),
      Posts = require('../models/posts'),
      Tags = require('../models/tags'),
      verify = require('../verifyUser');
      encrypt = require('bcryptjs'),
      JWT = require('jsonwebtoken');
require('dotenv').config();

app.use('/createPost', verify, async (req,res) => {
  
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
  })
  
  const tagsExists = req.body.tags;
  //res.send(tagsExists);
  tagsExists.forEach(async (tags) => {
      let check = await Tags.findOne({name: tags.name})
        if(check) {
          check.posts.push(newPost);
          check.save(done);
        } else {
          let newTag = new Tags({
            name: tags.name
          })
          newTag.posts.push(newPost);
          await newTag.save();
        }
      });
    newPost.tags = req.body.tags;
    await newPost.save();
    res.send(newPost);
  
    //for (let tags in tagsExists) {
    
});
    //apply parsing middleware to post.content
    /* 
        Check if Tag already exists.
        if not, create new Tag first.
        After successful save of post,
        in new Tag, add post.
        if tag already exists, save post
        to tag post list after.
        
        get userName and user._id 
        from req.header. Parse the JWT to extract the info
    */

//initially returns all posts. let frontEnd customize
app.use('/post/:id', verify, async (req,res) => {
    try {
      let singlePost = await Posts.findOne({_id: req.param.id});
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
