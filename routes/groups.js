const express = require('express'),
      app = express.Router(),
      mongoose = require('mongoose'),
      {Posts, Content, Comment} = require('../models/posts'),
      {User, Notification} = require('../models/user'),
      {Group} = require('../models/groups'),
      verify = require('../verifyUser'),
      encrypt = require('bcryptjs'),
      JWT = require('jsonwebtoken');

require('dotenv').config();

app.get('/create', verify, async (req,res) => {

  try {

    const auth = req.header('auth-token');
    const base64url = auth.split('.')[1];
    const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
    const {_id, _username} = decoded; 
    const type = req.body.type;
          name = req.body.name,
          owner = _id,
          admins = req.body.admins, //array of userIDs
          hasAccess = req.body.hasAccess,
          isPrivate = req.body.isPrivate;

    if(type == 'tag') {

        /*** Pre-existance Check ***/
        let alreadyExists = await Group.findOne({name: req.body.name, type: req.body.type});
        if(alreadyExists) {
            res.status(200).send({alreadyExists: `This ${req.body.type} already exists` });
        } 
        else {

            let newTag = new Group({
                type: req.body.type,
                name: req.body.name 
            });

            if(req.body.isPrivate) {
                newTag.owner = _id;
                newTag.isPrivate = true;
            }

            newTag.save();
            res.status(200).send(true);
        }

    } else if (req.body.type == 'collection') {

        /*** Pre-existance Check ***/
        let alreadyExists = await Group.findOne({name: req.body.name, type: req.body.type});
        if(alreadyExists) {
            res.status(200).send({alreadyExists: `This ${req.body.type} already exists` });
        } 
        else {

            let newCollection = new Group({
                type: req.body.type,
                name: req.body.name,
                owner: _id,
                isPrivate: req.body.isPrivate = true ? true : false,
                posts: req.body.posts
            });

            newCollection.save();
            res.status(200).send(true);
        }
    }
    else if(req.body.type == 'group') {

        /*** Pre-existance Check ***/
        let alreadyExists = await Group.findOne({name: req.body.name, type, req.body.type});
        if(alreadyExists) {
            res.status(200).send({alreadyExists: `This ${req.body.type} already exists` });
        } 
        else {
            req.body.admins.push(_id);

            let newGroup = new Group({
                type: req.body.type,
                name: req.body.name,
                owner: _id,
                isPrivate: req.body.isPrivate = true ? true : false,
                admins: req.body.admins
            });

            newGroup.save();
            res.status(200).send(true);
        }
    }
  } 
  catch(err) {

    console.log(err);
    res.status(400).send({message: "An Error Has Occured. Please Try Again"});
  }
});




app.get('/posts/:action', verify, async (req,res) => {

    const auth = req.header('auth-token');
    const base64url = auth.split('.')[1];
    const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
    const {_id, _username} = decoded; 
    const type = req.body.type;

    try {

        if(req.params.action == 'getPosts') {}
        else if(req.params.action == 'addPost') {}
        else if(req.params.actions == 'removePost') {}            
    } 
    catch(err) {

        console.log(err);
        res.status(400).send({message: "An Error Has Occured. Please Try Again"});
    }
});




app.get('/manage/:action', verify, async (req,res) => {

    const auth = req.header('auth-token');
    const base64url = auth.split('.')[1];
    const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
    const {_id, _username} = decoded; 
    const type = req.body.type;

    try {

        /***
         * if Group, check whether user is an admin 
         */
        if(req.params.action == 'addUser') {

            /* adds notification to added user's notifs */
        }
        else if(req.params.action == 'removeUser') {}
            
        else if(req.params.action == 'addAdmin') {

            /* adds notification to added user's notifs */
        }
        else if(req.params.action == 'removeAdmin') {

            if(req.body.type == 'initial') {

                /* sends out request notif to all group admins */
            }

            else if(req.body.type == 'update') {

                /* updates decision count for all admins */
            }

            else if(req.body.type == 'confirm') {}
        }

        else if(req.params.action == 'deleteGroup') {

            if(req.body.type == 'initial') {

                /* sends out request notif to all group admins */
            }

            else if(req.body.type == 'update') {

                /* updates decision count for all admins */
            }

            else if(req.body.type == 'confirm') {}
        }

        
    } 
    catch(err) {

        console.log(err);
        res.status(400).send({message: "An Error Has Occured. Please Try Again"});
    }
})