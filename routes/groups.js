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

    if(req.body.type == 'tag') {

        console.log('making new tag...')
        let alreadyExists = await Groups.findOne({
            name: req.body.name, 
            type: req.body.type,
            'admins.0': _id,
        }).then(data => {

            if(data) {
                console.log('this is the existing group' +data)
                res.status(200).send({alreadyExists: `This ${req.body.type} already exists` });
            }
            else {

                let newGroup = new Groups({
                    type: req.body.type,
                    name: req.body.name,
                    admins: [_id],
                    adminUsernames: [_username],
                    hasAccess: [_id],
                    isPrivate: req.body.isPrivate = true ? true : false
                });
                newGroup.save();
                res.status(200).send({confirm: true, name: newGroup.name});
            }
        })
    } 
    else if (req.body.type == 'collection') {

        console.log('making collection...')
        let alreadyExists = await Groups.findOne({
            name: req.body.name, 
            type: req.body.type,
            'admins.0': _id,
        }).then(data => {

            if(data) {
                console.log('this is the existing group' +data)
                res.status(200).send({alreadyExists: `This ${req.body.type} already exists` });
            }
            else {

                let newGroup = new Groups({
                    type: req.body.type,
                    name: req.body.name,
                    admins: [_id],
                    adminUsernames: [_username],
                    hasAccess: [_id],
                    isPrivate: req.body.isPrivate = true ? true : false
                });
                newGroup.details.description = req.body.details;
                newGroup.save();
                res.status(200).send({confirmation: true, name: newGroup.name});
            }
        })
    }
    else if(req.body.type == 'groups') {

        /*** Pre-existance Check ***/
        let alreadyExists = await Groups.findOne({
            name: req.body.name, 
            type: req.body.type,
            'admins.0': _id,
        }).then(data => {
            if(data) {
                console.log('this is the existing group' +data)
                res.status(200).send({alreadyExists: `This ${req.body.type} already exists` });
            }
            else {
                req.body.admins.push(_id);

                let newGroup = new Groups({
                    type: req.body.type,
                    name: req.body.name,
                    admins: [_id],
                    adminUsernames: [_username],
                    hasAccess: [_id],
                    isPrivate: req.body.isPrivate = true ? true : false
                });

                newGroup.save();
                res.status(200).send({confirm: true, name: newGroup.name});
            }
        }) 
    }
  } 
  catch(err) {

    console.log(err);
    res.status(400).send({message: "An Error Has Occured. Please Try Again"});
  }
});




app.use('/posts', verify, async (req,res) => {

    const auth = req.header('auth-token');
    const base64url = auth.split('.')[1];
    const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
    const {_id, _username} = decoded; 

    const action = req.body.action;
    const groupID = req.body.groupID;
    let postID = req.body.postID;


    /**
     * needed vars:
     * groupsID
     * postID
     * action
     * 
     * As of 02. 20. 2024 should only need
     * req.body.groupID
     * 
     */

    try {

        /* 
            02. 20. 2024
            change the top conditionals (if action) to utilize this top, initially searched
            group.
            remove the individual 'groups' from each 

            02. 22. 2024
            Have check for whether groupID is actually a topic by filtering it against the 
            topics. if not, then run .findOne.

            if it is a suggestion, need to run DB search which gets all posts with said topic
        */    

        // } else { // M A I N   R O U T E 
            // const topics = fs.readFileSync('./topics.txt').toString('utf-8').replace(/\r\n/g,'\n').split('\n');
            // let group; 
            // // if(!topics.some((topic) => topic == groupID)) {  //if groupID IS NOT a topic
            // let isTag = topics.some((topic) => topic == groupID)
            // if(isTag == true) {
            //     group = await Groups.findOne({_id: groupID});
            // } else {
            //     group = undefined;
            // }
            const user = await User.findById(_id);

            if(action == 'getTagInfo') {

                if(groupID == 'topic') {

                    let hasAccess;
                    if(user.settings.topics.includes(req.body.groupName)) {
                        // hasAccess = [_id];
                        hasAccess = true;
                    } 
                    else {
                        hasAccess = false;
                    }

                    res.status(200).send({response:'topic', hasAccess: hasAccess});
                }
                else {
                    let group = await Groups.findOne({_id: groupID});
                    res.status(200).send(group);
                }
            }

            else if(action == 'getPosts') {

                if(groupID == 'topic') {

                    let allPosts = await Posts.find({'tags.name': `${req.body.groupName}`, 'type': {$ne: "draft"}});

                    allPosts.filter(post => {
                                if(post.owner != _id) {

                                    if(post.isPrivate == true) {
                                        return null;
                                    }
                                    else if(post.privacyToggleable == 'On') {
                                        return null;
                                    }
                                    if(post.privacyToggleable == 'Half') {
                                        if(user.connections.includes(post.owner) ||
                                            user.subscriptions.includes(post.owner)) {
                                            return post;
                                        }
                                        else {
                                            return null;
                                        }
                                    }
                                    else {
                                        return post;
                                    }
                                }
                    })

                    allPosts.sort((a,b) => {

                              const dateA = new Date(a.postedOn_year, a.postedOn_month, a.postedOn_day),
                                    dateB = new Date(b.postedOn_year, b.postedOn_month, b.postedOn_day);

                              if (dateA > dateB) return -1;
                              if (dateA < dateB) return 1;
                              return 0;
                    })

                    res.status(200).send(allPosts);
                }
                else {
                    
                    let group = await Groups.findOne({_id: groupID});
                    if(group.type == 'tag') {

                    let group = await Groups.findOne({_id: groupID});
                    let allPosts = await Posts.find({"tags.name": `${group.name}`, 'type': {$ne: "draft"}}).sort({createdAt: -1})

                    allPosts.filter(post => {
                                if(post.owner != _id) {

                                    if(post.isPrivate == true) {
                                        return null;
                                    }
                                    else if(post.privacyToggleable == 'On') {
                                        return null;
                                    }
                                    else if(post.privacyToggleable == 'Half') {
                                        if(user.connections.includes(post.owner) ||
                                            user.subscriptions.includes(post.owner)) {
                                            return post;
                                        }
                                        else {
                                            return null;
                                        }
                                    }
                                    else {
                                        return post;
                                    }
                                }
                    })

                    allPosts.sort((a,b) => {

                              const dateA = new Date(a.postedOn_year, a.postedOn_month, a.postedOn_day),
                                    dateB = new Date(b.postedOn_year, b.postedOn_month, b.postedOn_day);

                              if (dateA > dateB) return -1;
                              if (dateA < dateB) return 1;
                              return 0;
                    })

                    res.status(200).send(allPosts);

                    console.log('here');
                    }
                    else if(group.type == 'collection' || group.type == 'groups') {

                        let group = await Groups.findOne({_id: groupID});
                        let posts = await Posts.find({ _id: {$in: group.posts}, 'type': {$ne: "draft"}}).sort({createdAt: -1})

                        posts.filter(post => {
                                    if(post.owner != _id) {

                                        if(post.isPrivate == true) {
                                            return null;
                                        }
                                        else if(post.privacyToggleable == 'On') {
                                            return null;
                                        }
                                        if(post.privacyToggleable == 'Half') {
                                            if(user.connections.includes(post.owner) ||
                                                user.subscriptions.includes(post.owner)) {
                                                return post;
                                            }
                                            else {
                                                return null;
                                            }
                                        }
                                        else {
                                            return post;
                                        }
                                    }
                        })

                        posts.sort((a,b) => {

                                  const dateA = new Date(a.postedOn_year, a.postedOn_month, a.postedOn_day),
                                        dateB = new Date(b.postedOn_year, b.postedOn_month, b.postedOn_day);

                                  if (dateA > dateB) return -1;
                                  if (dateA < dateB) return 1;
                                  return 0;
                        })

                        res.status(200).send(posts);
                    }
                }
                // else if(group.type == 'tag') {

                //     let group = await Groups.findOne({_id: groupID});
                //     let allPosts = await Posts.find({"tags.name": `${group.name}`, 'type': {$ne: "draft"}}).sort({createdAt: -1})

                //     allPosts.filter(post => {
                //                 if(post.owner != _id) {

                //                     if(post.isPrivate == true) {
                //                         return null;
                //                     }
                //                     else if(post.privacyToggleable == 'On') {
                //                         return null;
                //                     }
                //                     else if(post.privacyToggleable == 'Half') {
                //                         if(user.connections.includes(post.owner) ||
                //                             user.subscriptions.includes(post.owner)) {
                //                             return post;
                //                         }
                //                         else {
                //                             return null;
                //                         }
                //                     }
                //                     else {
                //                         return post;
                //                     }
                //                 }
                //     })

                //     allPosts.sort((a,b) => {

                //               const dateA = new Date(a.postedOn_year, a.postedOn_month, a.postedOn_day),
                //                     dateB = new Date(b.postedOn_year, b.postedOn_month, b.postedOn_day);

                //               if (dateA > dateB) return -1;
                //               if (dateA < dateB) return 1;
                //               return 0;
                //     })

                //     res.status(200).send(allPosts);

                //     console.log('here');
                // }
                // else if(group.type == 'collection' || group.type == 'groups') {

                //     let group = await Groups.findOne({_id: groupID});
                //     let posts = await Posts.find({ _id: {$in: group.posts}, 'type': {$ne: "draft"}}).sort({createdAt: -1})

                //     posts.filter(post => {
                //                 if(post.owner != _id) {

                //                     if(post.isPrivate == true) {
                //                         return null;
                //                     }
                //                     else if(post.privacyToggleable == 'On') {
                //                         return null;
                //                     }
                //                     if(post.privacyToggleable == 'Half') {
                //                         if(user.connections.includes(post.owner) ||
                //                             user.subscriptions.includes(post.owner)) {
                //                             return post;
                //                         }
                //                         else {
                //                             return null;
                //                         }
                //                     }
                //                     else {
                //                         return post;
                //                     }
                //                 }
                //     })

                //     posts.sort((a,b) => {

                //               const dateA = new Date(a.postedOn_year, a.postedOn_month, a.postedOn_day),
                //                     dateB = new Date(b.postedOn_year, b.postedOn_month, b.postedOn_day);

                //               if (dateA > dateB) return -1;
                //               if (dateA < dateB) return 1;
                //               return 0;
                //     })

                //     res.status(200).send(posts);
                // }
            }

            else if(action == 'addPost') {

                // let groups = await Groups.findOne({id: req.body.groupsID, name: req.body.name})

                //10.06.2024 Adding a post to a tag isnt an operation on the frontEnd...
                if(group.type == 'tag') {

                    if(group.isPrivate) {
                        if(group.owner == _id) {

                            group.posts.push(postID);
                            group.save();
                            res.status(200).send(true);
                        } else {
                            res.status(403).send({message: 'You do not have access'})
                        }
                    }
                    else {
                        if(group.hasAccess.contains(_id)) {

                            group.posts.push(postID);
                            group.save();
                            res.status(200).send(true);
                        }
                        else {
                            res.status(403).send({message: 'You do not have access'})
                        }
                    }
                }
                else if(group.type == 'collection') {

                    if(_id == group.admins[0]) {

                        group.posts.push(postID);
                        group.save();

                        //update user's interactionCounts if user is not postOwner
                        if(_id != req.body.postOwner) {
                            let ids = [_id, req.body.postOwner];
                            let newPoint = await User.updateMany({ _id: {$in: ids }}, {$inc: {interactionCount: 1}});
                        }

                        res.status(200).send({confirmation: true, groupName: group.name});
                    }
                    else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
                else if(group.type == 'groups') {

                    if(group.admins.contains(_id) || group.hasAccess.contains(_id)) {

                        group.posts.push(post);
                        group.save();
                        res.status(200).send(true);
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
            }

            else if(action == 'removePost') {

                if(group.type == 'tag') {

                    if(group.isPrivate) {
                        if(group.owner == _id) {

                            // let newArray = group.posts.filter((post) => post !== postID);
                            let newArray = group.posts.map(item => item.toString())
                            newArray = newArray.filter(post => !postID.includes(post));
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

                    // console.log(postID)
                    // console.log(group.posts)
                    console.log(postID)
                    if(_id == group.owner) {

                        (async()=> {
                            let newArray = group.posts.map(item => item.toString())
                            newArray = newArray.filter(post => !postID.includes(post));
                            console.log(newArray)
                            group.posts = newArray;
                            await group.save()
                            res.status(200).send({confirmation: true, groupName: group.name});
                        })();   
                    }
                    else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
                else if(group.type == 'groups') {

                    if(group.admins.contains(_id)) {

                        // let newArray = group.posts.filter((post) => post !== postID);
                        // let newArray = group.posts.filter(post => !postID.includes(post));
                        let newArray = group.posts.map(item => item.toString())
                        newArray = newArray.filter(post => !postID.includes(post));
                        group.posts = newArray;
                        group.save()
                        res.status(200).send({confirmation: true, groupName: group.name});
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
            }

            else if(action == 'getUserTags') {

                let userTags = await Groups.find({hasAccess: _id, type: 'tag'});

                userTags = userTags.map(tag => {
                    return {
                        hasAccess: tag.hasAccess,
                        name: tag.name,
                        type: tag.type,
                        _id: tag._id,
                        isPrivate: tag.isPrivate
                    }
                })

                if(userTags.length > 0) {
                    res.status(200).send(userTags);
                } else {
                    res.status(200).send(false);
                }
            }  

            else if(action == 'getSuggestions') {

                /* read topics from file & get user's tags to provide frontEnd 
                   with topics as suggestions for tags during post
                */
                const topics = fs.readFileSync('./topics.txt').toString('utf-8').replace(/\r\n/g,'\n').split('\n');
                res.status(200).send(topics);
            }

            else if(action == 'allTagsUsed') {

                /* rewrite this route so that we get:
                    users 32 most recent posts
                    all their topics from their settings
                    all their tags, saved docs

                    first filter their recent posts for tags.
                    then add in the remainder.
                */

                let allTags = [];
                let topics = fs.readFileSync('./topics.txt').toString('utf-8').replace(/\r\n/g,'\n').split('\n');
                const userPosts = await Posts.find({owner: _id}).limit(50);
                const userTags = await Groups.find({hasAccess: _id, type: 'tag'});
                const userTopics = user.settings.topics;

                /* Gathers all tags used within most recent posts */
                userPosts.forEach(post => {
                    if(post.tags) {
                        post.tags.forEach(tag => {
                            allTags.push(tag);
                        })
                    }
                })

                /* 
                    marks topics as such 
                    removes tags user's have used but no longer have access to
                */
                allTags = allTags.map(element => {

                    /* if userTags has tag used in a post, include it */
                    if (userTags.includes(element.name)) {
                        return ({
                            name: element.name,
                            _id: element._id,
                            type: 'tag'
                        }) 
                    } 

                    /* if a topic is identified, add it if it's also in user's topics */
                    else if(topics.includes(element.name)) {
                        if(userTopics.includes(element.name)) {
                            return ({
                                name: element.name,
                                type: 'topic',
                                _id: 'topic'
                            })
                        }
                        else return false  
                    } 
                    else return false
                })

                /* if allTags includes tag user has access to but hasnt' used */
                userTags.forEach(tag => {
                    if(!allTags.includes(tag.name)) {
                        allTags.push({
                            name: tag.name,
                            _id: tag._id,
                            type: 'tag'
                        })
                    }
                })

                userTopics.forEach(topic => {
                    if(!allTags.includes(topic)) {
                        allTags.push({
                            name: topic,
                            type: 'topic'
                        })
                    }
                })

                console.log(allTags)

                /* Remove any duplicates */
                let removeDups = (array) => {
                    let seenItems = new Set();
                    return array.filter(item => {
                        let isDup = seenItems.has(item.name);
                        seenItems.add(item.name);
                        return !isDup;
                    })
                }
                allTags = removeDups(allTags);

                
                res.status(200).send(allTags);
            }

            else if(action == 'getPrivatePosts') {

                let posts = await Posts.find({owner: _id, isPrivate: true}).sort({createdAt: -1});
                res.status(200).send(posts);
            }

            else if(action == 'getCollections') {

                /* retrieve list of names of all user's collections */
                let userCollections = await Groups.find(
                    {admins: {$elemMatch: {$eq: _id}}, 
                    type: 'collection'}
                );

                if(userCollections.length > 0) {

                    let bookmarks = userCollections.filter(col => col.name == 'BOOKMARKS')[0];
                    userCollections = userCollections.filter(col => col.name != 'BOOKMARKS');
                    userCollections.unshift(bookmarks);
                //     res.status(200).send(userCollections);
                } 
                // else {

                //     // res.status(200).send(false);
                // }
                res.status(200).send(userCollections);
            }

            else if(action == 'getGroups') {

                /* retrieve list of names of all groupss user is in */
            }

        // }
                     
    } 
    catch(err) {

        console.log(err);
        res.status(400).send({message: "An Error Has Occured. Please Try Again"});
    }
});




app.post('/manage/:action', verify, async (req,res) => {

    const auth = req.header('auth-token');
    const base64url = auth.split('.')[1];
    const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
    const {_id, _username} = decoded; 
    const type = req.body.type;

    /**
     * needed vars:
     * req.body.groupID
     * req.body.name
     * req.body.details 
     *  - for accessing private groups, details is an id from either
     *    owner or an admin
     */

    try {

        /***
         * if Groups, check whether user is an admin 
         */

        let group = await Groups.findOne({_id: req.body.groupID})
        console.log(group);

        if(req.params.action == 'addUser') {

            if(req.body.topic) {
                await User.updateOne(
                    {_id: _id},
                    {$push: {'settings.topics': req.body.topic}}
                );
                res.status(200).send({confirmation: true});
            }
            else if(group.type == 'tag') { //for PUBLIC tags

                if(group.isPrivate) {
            
                    if(group.owner == req.body.details) {

                        group.hasAccess.push(_id);
                        group.save();
                        res.status(200).send({confirmation: true});
                    } else {
                        res.status(403).send({message: 'noAccess', type: group.type})
                    }   
                } 

                else {
                    group.hasAccess.push(_id);
                    group.save();
                    res.status(200).send({confirmation: true}); 
                }
            }
            else if(group.type == 'collection') {// for PUBLIC collections

                if(group.isPrivate) {
                    
                    if(group.owner == req.body.details) {
                        group.hasAccess.push(req.body.userID);
                        group.save();
                        res.status(200).send({confirmation: true});
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
                else {
                    group.hasAccess.push(req.body.userID);
                    group.save();
                    res.status(200).send({confirmation: true});
                }
            }
            else if(group.type == 'groups') {// for PUBLIC groupss
                if(group.isPrivate) {
                    res.status(403).send({message: 'You do not have access'})

                    if(group.admins.includes(req.body.details)) {
                        group.hasAccess.push(req.body.userID);
                        group.save();
                        res.status(200).send({confirmation: true});
                    } else {
                        res.status(403).send({message: 'You do not have access'})
                    }
                }
                else {
                    group.hasAccess.push(req.body.userID);
                    group.save();
                    res.status(200).send({confirmation: true});
                }
            }
        }

        else if(req.params.action == 'removeUser') {

            if(req.body.topic) {
                await User.updateOne(
                    {_id: _id},
                    {$pull: {'settings.topics': req.body.topic}}
                );
                res.status(200).send({confirmation: true});
            }
            else if(group.type == 'tag') {

                if(group.hasAccess.includes(_id)) {

                    let newList = group.hasAccess.filter((user) => user != _id);
                    group.hasAccess = newList;
                    group.save();
                    res.status(200).send({confirmation: true});
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
            else if(group.type == 'groups') {

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

        //         /* sends out request notif to all groups admins */
        //     }

        //     else if(req.body.type == 'update') {

        //         /* updates decision count for all admins */
        //     }

        //     else if(req.body.type == 'confirm') {}
        // }

        else if(req.params.action == 'renameGroup') {

            group.name = req.body.newName;
            group.save()
            res.status(200).send(true);
        }

        else if(req.params.action == 'deleteGroup') {

            if(group.type == 'tag') {

                if(group.isPrivate == true && group.owner == _id) {
                    (async()=> {
                        await Groups.deleteOne({_id: group._id});
                        res.status(200).send({confirmation: true, groupName: group.name});
                    })();
                } 
                else {
                    (async()=> {
                        let newHasAccess = group.hasAccess.filter(id => id != _id);
                        group.hasAccess = newHasAccess;
                        group.save()
                        res.status(200).send({confirmation: true, groupName: group.name});
                    })();
                }
            }

            else if (group.type == 'collection') {

                if(group.name == 'BOOKMARKS') {
                    group.posts = [];
                    group.save(); 
                    res.status(200).send({confirmation: true, groupName: group.name});

                } else {
                    await Groups.deleteOne({_id: group._id});
                    res.status(200).send({confirmation: true, groupName: group.name});
                }

                
            }

            else if(req.body.type == 'initial') {

                /* sends out request notif to all groups admins */
            }

            else if(req.body.type == 'update') {

                /* updates decision count for all admins */
            }

            else if(req.body.type == 'confirm') {}
        }

        else if(req.params.action == 'privatizeGroup') {

            group.isPrivate = req.body.isPrivate;
            group.save();
            res.status(200).send({confirmation: true, 
                    isPrivate: req.body.isPrivate == true ? 'private' : 'public'});

            //01. 31. 2024 gotta write it out :D
            //02. 14. 2024 
            //as this route should only be accessible by an individual owner
            //checks for tag or collection shouldn't be necessary
            //private tags or collections merely require the user to make
            //a request of the owner

            // if(req.params.type == 'tag') {}

            // else if (req.params.type == 'collection') {

            // }
        }
    } 
    catch(err) {

        console.log(err);
        res.status(400).send({message: "An Error Has Occured. Please Try Again"});
    }
})



module.exports = app;