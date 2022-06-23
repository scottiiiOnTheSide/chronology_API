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
    tags: []
  })
  //await newPost.save(); 
  
  const tagsExists = req.body.tags;
  let upsertTags = [];
  JSON.stringify(tagsExists)
  //res.send(tagsExists[0]);
  
  tagsExists.map( async (tagsname)=> {
    Tags.findOne({
      name: tagsname
    },function (err, tag) {
      if(err) {
        console.log(err);
        return res.send(err);
      } else if(!tag) {
        let newTag = new Tags({
          name: tagsname,
          posts: []
        })
        newTag.posts.push(newPost._id);
        console.log(newTag._id);
        newTag.save()
      }
    });
  });
  tagsExists.map( async (tagsname)=> {
    Tags.findOne({
      name: tagsname
    },function (err, tag) {
      if(err) {
        console.log(err);
        return res.send(err);
      } else if (tag) {
        let result = tag._id.toString();
        console.log(result);
        newPost.tags.push(result);
        tag.posts.push(newPost._id);
        tag.save();
      } else if (!tag) {
        console.log(tagsname);
        upsertTags.push(tagsname);
      }
    });
  }) 
  
  //await newPost.save();
  try {
    let savedPost = await newPost.save();
    await res.status(200).send(savedPost);
  } catch (err) {
    console.log(err)
    next(err)
  }
  
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
