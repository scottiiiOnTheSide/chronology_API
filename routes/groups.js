const express = require('express'),
      app = express.Router(),
      mongoose = require('mongoose'),
      {Posts, Content, Comment} = require('../models/posts'),
      {User, Notification} = require('../models/user'),
      {Groups} = require('../models/groups'),
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

    console.log(req.body);

    if(type == 'tag') {

        /*** Pre-existance Check ***/
        let alreadyExists = await Groups.findOne({name: req.body.name, type: req.body.type});
        if(alreadyExists) {
            console.log(alreadyExists);
            res.status(200).send({alreadyExists: `This ${req.body.type} already exists`, id: alreadyExists._id });
        } 
        else {

            let newTag = new Groups({
                type: req.body.type,
                name: req.body.name,
                hasAccess: [req.body.hasAccess]
            });

            if(req.body.isPrivate) {
                newTag.owner = _id;
                newTag.isPrivate = true;
            }

            newTag.save();
            res.status(200).send({confirm: true, name: newTag.name});
        }

    } else if (req.body.type == 'collection') {

        /*** Pre-existance Check ***/
        let alreadyExists = await Groups.findOne({name: req.body.name, type: req.body.type});
        if(alreadyExists) {
            res.status(200).send({alreadyExists: `This ${req.body.type} already exists` });
        } 
        else {

            let newCollection = new Groups({
                type: req.body.type,
                name: req.body.name,
                owner: _id,
                isPrivate: req.body.isPrivate = true ? true : false,
                posts: req.body.posts
            });

            newCollection.save();
            res.status(200).send({confirm: true, name: newCollection.name});
        }
    }
    else if(req.body.type == 'groups') {

        /*** Pre-existance Check ***/
        let alreadyExists = await Groups.findOne({name: req.body.name, type: req.body.type});
        if(alreadyExists) {
            res.status(200).send({alreadyExists: `This ${req.body.type} already exists` });
        } 
        else {
            req.body.admins.push(_id);

            let newGroup = new Groups({
                type: req.body.type,
                name: req.body.name,
                owner: _id,
                isPrivate: req.body.isPrivate = true ? true : false,
                admins: req.body.admins
            });

            newGroup.save();
            res.status(200).send({confirm: true, name: newGroup.name});
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
     * req.body.groupsID
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
            else if(type == 'collection' || type == 'groups') {

                let groups = Groups.find({name: req.body.name, type: req.body.type});
                let posts = Posts.find({ '_id': {$in: groups.posts}}).then(data => {
                    if(data) {
                        res.status(200).send(data);
                    } else {
                        res.status(400).send({message: "No posts in this collection"});
                    }
                })
            }
        }

        else if(req.params.action == 'addPost') {

            let groups = await Groups.findOne({id: req.body.groupsID, name: req.body.name})

            if(groups.type == 'tag') {

                if(groups.isPrivate) {
                    if(groups.owner == _id) {

                        groups.posts.push(req.body.postID);
                        groups.save();
                        res.status(200).send(true);
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
                else {
                    if(groups.hasAccess.contains(_id)) {

                        groups.posts.push(req.body.postID);
                        groups.save();
                        res.status(200).send(true);
                    }
                    else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }

            }
            else if(groups.type == 'collection') {

                if(_id == groups.owner) {

                    groups.posts.push(req.body.postID);
                    groups.save();
                    res.status(200).send(true);
                }
                else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }
            else if(groups.type == 'groups') {

                if(groups.admins.contains(_id) || groups.hasAccess.contains(_id)) {

                    groups.posts.push(req.body.postID);
                    groups.save();
                    res.status(200).send(true);
                } else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }

        }
        else if(req.params.actions == 'removePost') {
            let groups = await Groups.findOne({id: req.body.groupsID, name: req.body.name})

            if(groups.type == 'tag') {

                if(groups.isPrivate) {
                    if(groups.owner == _id) {

                        let newArray = groups.posts.filter((post) => post !== req.body.postID);
                        groups.posts = newArray;
                        groups.save()
                        res.status(200).send(true);
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
                else {
                    if(groups.hasAccess.contains(_id)) {
                        let newArray = groups.posts.filter((post) => post !== req.body.postID);
                        groups.posts = newArray;
                        groups.save()
                        res.status(200).send(true);
                    }
                    else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
            }
            else if(groups.type == 'collection') {

                if(_id == groups.owner) {

                    let newArray = groups.posts.filter((post) => post !== req.body.postID);
                    groups.posts = newArray;
                    groups.save()
                    res.status(200).send(true);
                }
                else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }
            else if(groups.type == 'groups') {

                if(groups.admins.contains(_id)) {

                    let newArray = groups.posts.filter((post) => post !== req.body.postID);
                    groups.posts = newArray;
                    groups.save()
                    res.status(200).send(true);
                } else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }
        }

        else if(req.params.action == 'getUserTags') {

            const topics = fs.readFileSync('./topics.txt').toString('utf-8').replace(/\r\n/g,'\n').split('\n');
            let userPosts = await Posts.find({owner: _id}).limit(50);
            let userTags = await Groups.find({hasAccess: _id})
            console.log(userTags);

            
            let userTopics = userPosts.filter(post => {
                for(let i = 0; i > topics.length; i++) {
                    if(post.tags.includes(topics[i])) {
                        return topics[i];
                    }
                    else {
                        return
                    }
                }
            })
            console.log(userTopics);


            // if(userTags.length > 0) {
            //     // userTags = userTags.map(tag => tag.name);
            //     res.status(200).send(userTags);
            // } else {
            //     res.status(200).send(false);
            // }
           
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

            let posts = await Posts.find({owner: _id, isPrivate: true}).sort({createdAt: -1});
            res.status(200).send(posts);
        }
        else if(req.params.action == 'getCollections') {

            /* retrieve list of names of all user's collections */

        }
        else if(req.params.action == 'getGroups') {

            /* retrieve list of names of all groupss user is in */
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
     * req.body.groupsID
     * req.body.name
     * req.body.userID
     * req.body.details 
     *  - for accessing private groups, details is an id from either
     *    owner or an admin
     */

    try {

        /***
         * if Groups, check whether user is an admin 
         */

        let groups = await Groups.findOne({id: req.body.groupsID, name: req.body.name})

        if(req.params.action == 'addUser') {

            if(groups.type == 'tag') { //for PUBLIC tags

                if(groups.isPrivate) {
            
                    if(groups.owner == req.body.details) {
                        groups.hasAccess.push(req.body.userID);
                        groups.save();
                        res.status(200).send(true);
                    } else {
                        res.status(403).send({message: 'noAccess', type: groups.type})
                    }
                } else {
                    groups.hasAccess.push(req.body.userID);
                    groups.save();
                    res.status(200).send({message: 'confirm', name: groups.name});
                }
            }
            else if(groups.type == 'collection') {// for PUBLIC collections

                if(groups.isPrivate) {
                    
                    if(groups.owner == req.body.details) {
                        groups.hasAccess.push(req.body.userID);
                        groups.save();
                        res.status(200).send(true);
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
                else {
                    groups.hasAccess.push(req.body.userID);
                    groups.save();
                    res.status(200).send(true);
                }

            }
            else if(groups.type == 'groups') {// for PUBLIC groupss
                if(groups.isPrivate) {
                    res.status(403).send({message: 'You do not have access'})

                    if(groups.admins.includes(req.body.details)) {
                        groups.hasAccess.push(req.body.userID);
                        groups.save();
                        res.status(200).send(true);
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
                else {
                    groups.hasAccess.push(req.body.userID);
                    groups.save();
                    res.status(200).send(true);
                }
            }
        }

        else if(req.params.action == 'removeUser') {

            if(groups.type == 'tag') {

                if(groups.hasAccess.includes(_id)) {

                    let newList = groups.hasAccess.filter((user) => user != _id);
                    groups.hasAccess = newList;
                    groups.save();
                    res.status(200).send(true);
                } else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }
            else if(groups.type == 'collection') {

                if(groups.hasAccess.includes(_id)) {

                    let newList = groups.hasAccess.filter((user) => user != _id);
                    groups.hasAccess = newList;
                    groups.save();
                    res.status(200).send(true);
                } else {
                    res.status(403).send({message: 'You do not have access'})
                }
            }
            if(groups.type == 'groups') {

                if(groups.hasAccess.includes(_id) || groups.admins.includes(_id)) {

                    let newList = groups.hasAccess.filter((user) => user != req.body.userID);
                    groups.hasAccess = newList;
                    groups.save();
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

        //         /* sends out request notif to all groups admins */
        //     }

        //     else if(req.body.type == 'update') {

        //         /* updates decision count for all admins */
        //     }

        //     else if(req.body.type == 'confirm') {}
        // }

        // else if(req.params.action == 'deleteGroups') {

        //     if(req.body.type == 'initial') {

        //         /* sends out request notif to all groups admins */
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