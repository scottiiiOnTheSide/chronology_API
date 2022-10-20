const express = require('express'),
      app = express.Router(),
      mongoose = require('mongoose'),
      Posts = require('../models/posts'),
      Tags = require('../models/tags'),
      {User, Notification} = require('../models/user'),
      verify = require('../verifyUser'),
      manageTags = require('../manageTags'),
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
  let tagslist = req.body.tags.map((tag) => tag.name)
  //await newPost.save();
  if(req.body.usePostedByDate == true) {
    console.log(month +' '+ date +' '+ year)
    newPost = new Posts({
      owner: _id,
      author: _username,
      title: req.body.title,
      content: req.body.content,
      tags: tagslist,
      taggedUsers: req.body.taggedUsers,
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
      tags: tagslist,
      taggedUsers: req.body.taggedUsers,
    })
  }
  
  //console.log('line 29 '+ req.body.tags);
  let tags = req.body.tags;
  
  //might have to edit this
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
  
  console.log('line 44'+ newPost);
  await newPost.save();

  console.log(req.body.taggedUsers);

  
  //10.19.2022 currently not sure if this actually makes sense ?!?
  let usersTagged;
  if(req.body.taggedUsers) {
    usersTagged = JSON.parse(JSON.stringify((req.body.taggedUsers)));
  }
  JSON.stringify(usersTagged);

  // console.log(usersTagged);

  let notifyUser = async(user) => {

    let tagAlert = new Notification({
      tagAlert: {
        postID: newPost._id,
        postTitle: newPost.title,
        sender: _username,
        /*
           On front end, have the title in bold and quotation marks, 
           the username in blue, perhaps.
        */
      }
    })
    await tagAlert.save();

    let userID = await User.findOne({userName: user}).then((data) => data);
    // console.log(userID._id)

    let addTagAlertToNotifs = await User.findByIdAndUpdate(
        userID._id,
        {$push: {"notifications": tagAlert}},
        {upsert: true}
      ).then((data) => {
        if(data) {
          console.log('user notified of them being tagged')
        } else {
          console.log('updating user notifs didnt work')
        }
    })
  }

  if(usersTagged) {
    usersTagged.forEach((user) => {
      console.log(user);
      notifyUser(user);
    })
  }

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
        console.log(`Log of posts from ${req.query.month} . ${req.query.year} from user: ${_username}`);
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

app.get('/socialLog', verify, async (req, res) => {
  
  const auth = req.header('auth-token');
  const base64url = auth.split('.')[1];
  const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
  const {_id, _username} = decoded;
  let id = mongoose.Types.ObjectId(_id);
  
  const month = req.query.month,
        year = req.query.year,
        user = await User.findById(_id)
        .then(res => res.toJSON());
        connections = user.connections;
        
  console.log(user.connections);
  
  let allPosts = await Posts.find({
    'owner': {$in: connections},
    'postedOn_month': req.query.month,
    'postedOn_year': req.query.year
  }).then(res => res);
  console.log(allPosts);
  
  res.status(200).send(allPosts);
})

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