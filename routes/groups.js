const express = require('express'),
      app = express.Router(),
      mongoose = require('mongoose'),
      {Posts, Content, Comment} = require('../models/posts'),
      {User, Notification} = require('../models/user'),
      {Group} = require('../models/groups'),
      verify = require('../verifyUser'),
      encrypt = require('bcryptjs'),
      JWT = require('jsonwebtoken'),
      fs = require('fs');

require('dotenv').config();

app.post('/create', verify, async (req,res) => {

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
        let alreadyExists = await Group.findOne({name: req.body.name, type: req.body.type});
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

    /**
     * needed vars:
     * req.body.groupID
     * req.body.name
     * req.body.postID
     * req.body.type
     */

    try {

        if(req.params.action == 'getPosts') {

            if(type == 'tag') {

                let allPosts = Posts.find({tags: `${req.body.name}`}).then((data)=> {
                    if(data) {
                        res.status(200).send(data)
                    } else {
                        res.status(400).send({message: "No posts for this tag"});
                    }
                })
            }
            else if(type == 'collection' || type == 'group') {

                let group = Group.find({name: req.body.name, type: req.body.type});
                let posts = Posts.find({ '_id': {$in: group.posts}}).then(data => {
                    if(data) {
                        res.status(200).send(data);
                    } else {
                        res.status(400).send({message: "No posts in this collection"});
                    }
                })
            }
        }

        else if(req.params.action == 'addPost') {

            let group = await Group.findOne({id: req.body.groupID, name: req.body.name})

            if(group.type == 'tag') {

                if(group.isPrivate) {
                    if(group.owner == _id) {

                        group.posts.push(req.body.postID);
                        group.save();
                        res.status(200).send(true);
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
                else {
                    if(group.hasAccess.contains(_id)) {

                        group.posts.push(req.body.postID);
                        group.save();
                        res.status(200).send(true);
                    }
                    else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }

            }
            else if(group.type == 'collection') {

                if(_id == group.owner) {

                    group.posts.push(req.body.postID);
                    group.save();
                    res.status(200).send(true);
                }
                else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }
            else if(group.type == 'group') {

                if(group.admins.contains(_id) || group.hasAccess.contains(_id)) {

                    group.posts.push(req.body.postID);
                    group.save();
                    res.status(200).send(true);
                } else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }

        }
        else if(req.params.actions == 'removePost') {
            let group = await Group.findOne({id: req.body.groupID, name: req.body.name})

            if(group.type == 'tag') {

                if(group.isPrivate) {
                    if(group.owner == _id) {

                        let newArray = group.posts.filter((post) => post !== req.body.postID);
                        group.posts = newArray;
                        group.save()
                        res.status(200).send(true);
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
                else {
                    if(group.hasAccess.contains(_id)) {
                        let newArray = group.posts.filter((post) => post !== req.body.postID);
                        group.posts = newArray;
                        group.save()
                        res.status(200).send(true);
                    }
                    else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
            }
            else if(group.type == 'collection') {

                if(_id == group.owner) {

                    let newArray = group.posts.filter((post) => post !== req.body.postID);
                    group.posts = newArray;
                    group.save()
                    res.status(200).send(true);
                }
                else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }
            else if(group.type == 'group') {

                if(group.admins.contains(_id)) {

                    let newArray = group.posts.filter((post) => post !== req.body.postID);
                    group.posts = newArray;
                    group.save()
                    res.status(200).send(true);
                } else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }
        }

        else if(req.params.action == 'getUserTags') {

        }  
        else if(req.params.action == 'getSuggestions') {

            /* read topics from file & get user's tags
                to provide frontEnd with suggestions for tags
                during post
            */

            const topics = fs.readFileSync('./topics.txt').toString('utf-8').replace(/\r\n/g,'\n').split('\n');

            res.status(200).send(topics);
        }
        else if(req.params.action == 'getPrivatePosts') {

        }
        else if(req.params.action == 'getCollections') {

            /* retrieve list of names of all user's collections */
        }
        else if(req.params.action == 'getGroups') {

            /* retrieve list of names of all groups user is in */
        }            
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

    /**
     * needed vars:
     * req.body.groupID
     * req.body.name
     * req.body.userID
     * req.body.details 
     *  - for accessing private group, details is an id from either
     *    owner or an admin
     */

    try {

        /***
         * if Group, check whether user is an admin 
         */

        let group = await Group.findOne({id: req.body.groupID, name: req.body.name})

        if(req.params.action == 'addUser') {

            if(group.type == 'tag') { //for PUBLIC tags

                if(group.isPrivate) {
            
                    if(group.owner == req.body.details) {
                        group.hasAccess.push(req.body.userID);
                        group.save();
                        res.status(200).send(true);
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                } else {
                    group.hasAccess.push(req.body.userID);
                    group.save();
                    res.status(200).send(true);
                }
            }
            else if(group.type == 'collection') {// for PUBLIC collections

                if(group.isPrivate) {
                    
                    if(group.owner == req.body.details) {
                        group.hasAccess.push(req.body.userID);
                        group.save();
                        res.status(200).send(true);
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
                else {
                    group.hasAccess.push(req.body.userID);
                    group.save();
                    res.status(200).send(true);
                }

            }
            else if(group.type == 'group') {// for PUBLIC groups
                if(group.isPrivate) {
                    res.status(403).send({message: 'You do not have access'})

                    if(group.admins.includes(req.body.details)) {
                        group.hasAccess.push(req.body.userID);
                        group.save();
                        res.status(200).send(true);
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
                else {
                    group.hasAccess.push(req.body.userID);
                    group.save();
                    res.status(200).send(true);
                }
            }
        }

        else if(req.params.action == 'removeUser') {

            if(group.type == 'tag') {

                if(group.hasAccess.includes(_id)) {

                    let newList = group.hasAccess.filter((user) => user != _id);
                    group.hasAccess = newList;
                    group.save();
                    res.status(200).send(true);
                } else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }
            else if(group.type == 'collection') {

                if(group.hasAccess.includes(_id)) {

                    let newList = group.hasAccess.filter((user) => user != _id);
                    group.hasAccess = newList;
                    group.save();
                    res.status(200).send(true);
                } else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }
            if(group.type == 'group') {

                if(group.hasAccess.includes(_id) || group.admins.includes(_id)) {

                    let newList = group.hasAccess.filter((user) => user != req.body.userID);
                    group.hasAccess = newList;
                    group.save();
                    res.status(200).send(true);
                } else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }
        }

        //12. 15. 2023 - To Be Done
        // else if(req.params.action == 'addAdmin') {

        //     /* adds notification to added user's notifs */
        // }

        // else if(req.params.action == 'removeAdmin') {

        //     if(req.body.type == 'initial') {

        //         /* sends out request notif to all group admins */
        //     }

        //     else if(req.body.type == 'update') {

        //         /* updates decision count for all admins */
        //     }

        //     else if(req.body.type == 'confirm') {}
        // }

        // else if(req.params.action == 'deleteGroup') {

        //     if(req.body.type == 'initial') {

        //         /* sends out request notif to all group admins */
        //     }

        //     else if(req.body.type == 'update') {

        //         /* updates decision count for all admins */
        //     }

        //     else if(req.body.type == 'confirm') {}
        // }
    } 
    catch(err) {

        console.log(err);
        res.status(400).send({message: "An Error Has Occured. Please Try Again"});
    }
})



module.exports = app;