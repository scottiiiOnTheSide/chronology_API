const express = require('express'),
      app = express.Router(),
      mongoose = require('mongoose'),
      {User, Notification} = require('../models/user'),
      {Posts, Content, Comment} = require('../models/posts'),
      {Groups} = require('../models/groups'),
      encrypt = require('bcryptjs'),
      JWT = require('jsonwebtoken'),
      verify = require('../verifyUser'),
      path = require('path'),
      util = require('util'),
      multer = require('multer'),
      sharp = require('sharp'),
      {Storage} = require('@google-cloud/storage'),
      fs = require('fs');
require('dotenv').config();

/* for processing media content */
let storage = multer.memoryStorage(), //keeps data in RAM storage

    upload = multer({ storage: storage }), //sets target destination for uploads

    GCS = new Storage({ //sets GCS client globally - all paths can use this
      keyFilename: path.join(__dirname, '../logSeqMediaGCSaccess.json'),
      projectId: "aerobic-name-372620"
    }),
    uploadMedia = GCS.bucket('logseqmedia');



//Simple 'create new  users' function
app.post('/newuser', upload.any(), async (req,res) => {

    console.log(req.body)

    try {

        if(req.body.action == 'getReferrer') {

            let user = await User.find({'settings.referralCode': req.body.refCode});
            let object = {
                profilePic: user[0].profilePhoto,
                username: user[0].userName,
                firstName: user[0].firstName,
                lastName: user[0].lastName,
                _id: user[0]._id
            }
            res.status(200).send(object);
        }

        else if(req.body.action == 'userExistsCheck') {

            console.log('user exists check');
            const emailExist = await User.findOne({emailAddr: req.body.emailAddr});
            const usernameExist = await User.findOne({userName: req.body.userName});
            console.log(emailExist)
            console.log(usernameExist)

            if(emailExist && usernameExist) {
                res.status(400).send({confirm: false, message: "This email is already linked to an account using this username"})
            }
            else if(emailExist && !usernameExist) {
                res.status(400).send({confirm: false, message: "This email has already been used"});
            }
            else if(!emailExist && usernameExist) {
                res.status(400).send({confirm: false, message: "This username is currently in use"});
            }
            else {
                res.status(200).send({confirm: true});
            }
        }

        else if(req.body.action == 'getTopics') {
            console.log('sending topics')
            const topics = fs.readFileSync('./topics.txt').toString('utf-8').replace(/\r\n/g,'\n').split('\n');
            res.status(200).send(topics);
        }

        else if(req.body.action == 'create') {

            console.log(req.body)
            console.log(req.files[0])
            console.log(req.files.length)
            const userPass = req.body.password
            const salt = await encrypt.genSalt(10);
            const hashedPass = await encrypt.hash(userPass, salt);
            
            const selectedTopics = req.body.topics.split(',');
            console.log(selectedTopics);
            const user = new User({
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                emailAddr: req.body.emailAddr,
                userName: req.body.userName,
                password: hashedPass,
                isPrivate: req.body.privacyOption,
                interactionCount: 0
            });
            user.settings.topics = selectedTopics;

             /* Processes uploaded photo */
            if(req.files) {

                const d = new Date();
                const month = d.getMonth() + 1;
                const date = d.getDate();
                const year = d.getFullYear();
                const timeStamp = d.getTime();

                const fileNumber = req.files[0].fieldname;
                const fileName = `${fileNumber}_${req.body.userName}_${month}-${date}-${year}_${timeStamp}`;
                const file = uploadMedia.file(fileName);
                const options = {
                  resumable: false,
                  metadata: {
                    contentType: 'image/jpeg/png',
                  }
                };
                console.log(fileName)

                let fileBuffer = req.files[0].buffer;
                let fileSize = fileBuffer.length;
                let reducedFile = await sharp(fileBuffer).jpeg({ quality: 32, mozjpeg: true }).toBuffer();
                await file.save(reducedFile, options);

                await uploadMedia.setMetadata({
                    enableRequesterPays: true,
                      website: {
                        mainPageSuffix: 'index.html',
                        notFoundPage: '404.html',
                      },
                });

              
                const [cdnUrl] = await file.getSignedUrl({
                  action: 'read',
                  expires: '01-01-2499',
                });

                let title = `${fileNumber}`;
                user.profilePhoto = cdnUrl;
            }

            /* Saves user info */
            // await user.save();

            //Add admin0 and referring user
            user.connections.push('62bdb874448ee72b6b3b0203');
            user.connections.push(mongoose.Types.ObjectId(req.body.referrer));

            //create and add user's referral code
            let userIDtoString = user._id.toString()
            let refcode = '';
            // Loop through the string, incrementing by 3 each time
            for (let i = 2; i < userIDtoString.length; i += 3) {
                refcode += userIDtoString[i];
            }
            user.settings.referralCode = refcode;
            await user.save();

            /* Creates a BOOKMARKS collection for user */
            let newCollection = new Groups({
                type: 'collection',
                name: 'BOOKMARKS',
                admins: [user._id],
                adminUsernames: [user.username],
                hasAccess: [user._id],
                isPrivate: true,
            });
            await newCollection.save()

            console.log('new user created');
            console.log(user);
            res.status(200).send({confirm: true});
        }
        
    } catch(err) {

        console.log(err);
        res.status(400).send({message: "An Error Has Occured. Please Try Again"});
    }
});

//Simple return all users function
app.post('/login', async (req, res) => {

    try {

        const user = await User.findOne({emailAddr:req.body.emailAddr});
        if(!user) {
            return res.status(400).send({error: true, message: "This email is not valid"});
        }
        
        const passwordValid = await encrypt.compare(req.body.password, user.password);
        //decrpyt password
        if(!passwordValid) {
            return res.status(400).send({error: true, message: "This password is invalid"});
        }
        

        let JWTpayload = {
            '_id': user._id, 
            '_username': user.userName,
        };

        console.log(JWTpayload)

        const signature = JWT.sign(JWTpayload, process.env.TOKEN_SECRET);
        res.status(200).send({
            confirm: true, 
            JWT: signature, 
            profilePhoto: user.profilePhoto,
            privacySetting: user.privacySetting,
            settings: user.settings
        });
        //res.send(JWTpayload);
        //this info needs to be within user request headers whenever performing account operations.
        
    } catch(err) {

        console.log(err);
        res.status(400).send({message: "An Error Has Occured. Please Try Again"});
    } 
});

app.get('/user/:userID', async (req,res) => {

    try {

        const auth = req.header('auth-token');
        const base64url = auth.split('.')[1];
        const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
        const {_id, _username} = decoded;
        let removalID = req.query.remove;

        let singleUser;
        if(req.params.userID != _id) {
            console.log(req.params.userID)

            singleUser = await User.findById(mongoose.Types.ObjectId(req.params.userID)).then((user) => {
              if(!user) {
                 console.log("error retrieving user");
                } else {
                  return user;
                  console.log(user.userName)
                }
          });
        } else {

            singleUser = await User.findById(_id).then((user) => {
              if(!user) {
                 console.log("error retrieving user");
                } else {
                  return user;
                }
          });
        }
            
          
        if(req.query.query == 'getAllConnects') {

            //add isconnected and issubscribed

            let connects = singleUser.connections,
                subscribers = singleUser.subscribers,
                subscriptions = singleUser.subscriptions;

            connects = await User.find({'_id': {$in: connects }});
            subscribers = await User.find({'_id': {$in: subscribers }});
            subscriptions = await User.find({'_id': {$in: subscriptions }});

            let connectsList = [],
                subscribersList = [],
                subscriptionsList = [];

            connects.forEach((userInfo) => {
                let result = {
                    fullName: `${userInfo.firstName} ${userInfo.lastName}`,
                    userName: userInfo.userName,
                    _id: userInfo._id,
                    profilePhoto: userInfo.profilePhoto,
                    isConnection: true,
                    isSubscriber: false,
                    isSubscription: false
                }

                connectsList.push(result);
            })

            subscribers.forEach((userInfo) => {
                let result = {
                    fullName: `${userInfo.firstName} ${userInfo.lastName}`,
                    userName: userInfo.userName,
                    _id: userInfo._id,
                    profilePhoto: userInfo.profilePhoto,
                    isConnection: false,
                    isSubscriber: true,
                    isSubscription: false
                }

                subscribersList.push(result);
            })

            subscriptions.forEach((userInfo) => {
                let result = {
                    fullName: `${userInfo.firstName} ${userInfo.lastName}`,
                    userName: userInfo.userName,
                    _id: userInfo._id,
                    profilePhoto: userInfo.profilePhoto,
                    isConnection: false,
                    isSubscriber: false,
                    isSubscription: true
                }

                subscriptionsList.push(result);
            })

            let list = [...new Set([...connectsList, ...subscribersList, ...subscriptionsList])];

            res.status(200).send(list);

            //if singleUser._id == _id,
            //if connect connections, subscribers or subscriptions include current
            //user, add mutual: true to result
        } 

        else if (req.query.query == 'removeConnect') {

            (async() => {
                let one = User.updateOne(
                  { _id: _id},
                  {$pull: { 'connections': `${removalID}` }},
                  function(err, val) {
                    if(val) {
                      console.log(singleUser.connections);
                      console.log('removee disconnected from remover');
                      res.status(200).send(true);
                    } else {
                      console.log(err)
                    }
                  }
                )

                let two = User.updateOne(
                    { _id:  mongoose.Types.ObjectId(removalID)},
                    {$pull: {'connections': `${_id}`}},
                    function(err, val) {
                        if(val) {
                            console.log('remover disconnected from removee');
                        } else {
                            console.log(err)
                        }
                    }
                )
            })();    
        } 

        else if (req.query.query == 'removeSubTo') {

            (async() => {
                let one = User.updateOne(
                  { _id: _id},
                  {$pull: { 'subscriptions': `${removalID}` }},
                  function(err, val) {
                    if(val) {
                      console.log(singleUser.connections);
                      console.log('removee disconnected from remover');
                      res.status(200).send({confirm: true});
                    } else {
                      console.log(err)
                    }
                  }
                )

                let two = User.updateOne(
                    { _id:  mongoose.Types.ObjectId(removalID)},
                    {$pull: {'subscribers': `${_id}`}},
                    function(err, val) {
                        if(val) {
                            console.log('remover disconnected from removee');
                        } else {
                            console.log(err)
                        }
                    }
                )
            })();
        }

        else if (req.query.query == 'removeSubFrom') {
            (async() => {
                let one = User.updateOne(
                  { _id: _id},
                  {$pull: { 'subscribers': `${removalID}` }},
                  function(err, val) {
                    if(val) {
                      console.log(singleUser.connections);
                      console.log('user removed subscriber');
                      res.status(200).send({confirm: true});
                    } else {
                      console.log(err)
                    }
                  }
                )

                let two = User.updateOne(
                    { _id:  mongoose.Types.ObjectId(removalID)},
                    {$pull: {'subscriptions': `${_id}`}},
                    function(err, val) {
                        if(val) {
                            console.log('subscription removed from targeted user');
                        } else {
                            console.log(err)
                        }
                    }
                )
            })();
        }

        else if(req.query.query == 'singleUser') {

            if(req.params.userID == _id) {

                // let isSubscribed = singleUser.subscribers.includes(_id);
                // let isConnected = singleUser.connections.includes(_id);

                let posts = await Posts.find({ _id: {$in: singleUser.pinnedPosts}}).sort({createdAt: -1});
                let postCount = await Posts.countDocuments({
                    'owner': _id, 
                    'type': {$ne: "draft"}, 
                    // 'isPrivate': {$ne: true}
                    'isPrivate': false
                });
                let collections = await Groups.find(
                    {admins: {$elemMatch: {$eq: _id}},
                    name: {$ne: 'BOOKMARKS'}, 
                    type: 'collection'}
                );
                res.status(200).send({
                    user: singleUser, 
                    pinnedPosts: posts,
                    collections: collections,
                    postCount: postCount,
                    // isConnected: isConnected,
                    // isSubscribed: isSubscribed
                });
            }
            else {
                let user = await User.findById(req.params.userID);
                let isSubscribed = user.subscribers.includes(_id);
                let isConnected = user.connections.includes(_id);
                let posts = await Posts.find({ _id: {$in: user.pinnedPosts}}).sort({createdAt: -1});
                let postCount = await Posts.countDocuments({'owner': req.params.userID, 'type': {$ne: "draft"}})
                let collections = await Groups.find(
                    {admins: {$elemMatch: {$eq: req.params.userID}},
                    name: {$ne: 'BOOKMARKS'}, 
                    type: 'collection'}
                );

                res.status(200).send({
                    user: user, 
                    pinnedPosts: posts,
                    collections: collections,
                    postCount: postCount,
                    isConnected: isConnected,
                    isSubscribed: isSubscribed
                });
                // isConnected?
                // isSubscribed?
            }
        }

        else {
            res.status(200).send(singleUser);
        }
        
    } catch(err) {

        console.log(err);
        res.status(400).send({message: "An Error Has Occured. Please Try Again"});
    }
})

app.get('/search', verify, async(req, res) => {

    try {

        let makeResult = (user) => {
        let value = {
            username: user.userName,
            fullname: `${user.firstName} ${user.lastName}`,
            id: user._id
          }
          return value
        }
  
        try {

            let list = [];
            let username = req.query.userName;
            
            const aggSettings = [
                {
                    $search: {
                        autocomplete: {
                            query: username,
                            path: 'userName',
                            fuzzy:{
                                maxEdits: 2

                            }
                        }
                    }
                },
                {
                    $limit: 10
                }
                // {
                //     $project: {
                //         //can include / exclude fields from returned doc, using 
                //         //fieldname as key and 1 to have it, 0 to exclude it
                //     }
                // }
            ]

            let response = await User.aggregate(aggSettings);

            // console.log(response);
                  
            list = response.map((user) => {
                return makeResult(user);
            })
            res.status(200).send(list);

        } catch (e) {
            res.status(500).send({ message: e.message });
        }
        
    } catch(err) {

        console.log(err);
        res.status(400).send({message: "An Error Has Occured. Please Try Again"});
    }
});

app.post('/notif/:type', verify, async(req, res)=> {

    /* 09. 05. 2023
        New Notification Model & request object model

        type: string | "request", "commentInitial", "commentResponse", "tagging"
        isRead: boolean
        sender: string | userID
        recipients: Array | userID(s)
        url: string | url for post OR original notif ID
        message: string | *sent, *recieved, *accept, *ignore

    */

    try {

        const auth = req.header('auth-token');
        const base64url = auth.split('.')[1];
        const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
        const {_id, _username} = decoded;
        /* Get ID for removing connection, update notification */
        const accessID = req.query.ID,
              isRead = req.query.isRead,
              type = req.params.type;

        /*
            09. 26. 2024
            make sure all notifs are saved directly within an array
            not nested any deeper
            then fix 'mark read' subroute
        */


        /* update original notif to be isRead = true */
        if(type == 'markRead') {

            let user = await User.findById(_id);
            let notif = user.notifications.filter((notif) => {
                if(notif[0]._id == req.body.notifID) {
                    return notif;
                }
            })
            notif[0][0].isRead = true;

            // let notif = user.notifications.filter((notif) => {
            //     if(notif._id == req.body.notifID) {
            //         return notif;
            //     }
            // })
            // notif.isRead = true;
            user.save({ suppressWarning: true });
            // console.log(notif);
            res.status(200).send(true);
        }

        else if(type == 'sendAll') {

            let user = await User.findById(_id).then((user) => {
                if(user) {
                  return user
                }
                else {
                  console.log("issue finding user. might not exist");
                }
            })
          

            let notifs = user.notifications,
                reordered = [];

            for(let i = notifs.length-1; i >= 0; i--) {
                reordered.push(notifs[i][0]);
            }

            console.log(`sending ${user.userName}'s' notifications`)
            res.status(200).send(reordered);
        }

        else if(type == 'sendUnreadCount') {
        /** 
         * 10. 27. 2023
         * Notifs are currently in array, per each array entry (._ .)
         * will most likely be fixed once I create new profiles
         */
            let user = await User.findById(_id).then((user) => {
                if(user) {
                  return user
                }
                else {
                  console.log("issue finding user. might not exist");
                }
            })

          let notifs = user.notifications;
          let count = 0;
          for(let i = 0; i < notifs.length; i++) {
            if(notifs[i][0].isRead == false) {
                count++;
            }
          }
          console.log(`${user.userName} has ${count} unread notifications`);
          res.status(200).send(count.toString());
        }  

        /* if connection request */
        else if(type == 'request') {

            let check;
            let userToCheck = await User.findById(req.body.recipients[0]);
            let notif = userToCheck.notifications.filter((notif) => {
                if(notif[0].sender == _id && notif[0].type == 'request') {
                  
                    if(notif[0].message.includes('sub') || notif[0].isRead == true) {
                        return;
                    }
                    else {
                        check = true;
                        return notif;
                        console.log(notif)
                    }
                }
            })
            // if(!req.body.message.includes('sub') && check == true) {
            //     console.log(notif);
            //     console.log(`${_username} has already sent this user a request`);

            //     // 10.16.2024
            //     // create and send a message depending on which check is true
            //     // groupRequest, connection or subscription

            //     res.status(200).send({confirmation: false}) 
            // }

            // else { 

                let sender = await User.findById(mongoose.Types.ObjectId(req.body.senderID));
                sender = {
                    username: sender.userName,
                    id: sender._id
                }

                let recipient = await User.findById(mongoose.Types.ObjectId(req.body.recipients[0]))
                let connectionCheck;
                recipient = {
                    username: recipient.userName,
                    id: recipient._id
                }

                /**
                 * 10. 13. 2023
                 * use senderID and recipient and message: ignored, to check whether there's an ignored
                 * request. Can then send user mesage 'you already sent a request!'
                 */

                /* initial request */
                if(req.body.message == "connectionRequestSent") {

                        let requestTwo = new Notification({
                            senderUsername: sender.username,
                            recipients: [recipient.id],
                            type: req.body.type,
                            isRead: false,
                            sender: sender.id,
                            message: 'connectionRequestRecieved'
                        });

                        //requester's notification
                        let requestOne = new Notification({
                            type: req.body.type,
                            isRead: false,
                            sender: sender.id,
                            senderUsername: sender.username,
                            recipients: [recipient.id],
                            recipientUsernames: [recipient.username],
                            message: 'connectionRequestSent'
                        });

                        
                        (async()=> {
                            let updateSenderList = await User.findByIdAndUpdate(
                                mongoose.Types.ObjectId(sender.id),
                                {$push: {"notifications": requestOne}},
                                [{upsert: true}, {useFindandModify: false}],
                            ).then((res) => {
                                if(res) {
                                    console.log("notification of connection request added to sender's list")
                                }
                            });

                            let updateRecipientList = await User.findByIdAndUpdate(
                                mongoose.Types.ObjectId(recipient.id),
                                {$push: {"notifications": requestTwo}},
                                [{upsert: true}, {useFindandModify: false}],
                            ).then((res) => {
                                if(res) {
                                    console.log("notification of connection request added to recipient's list")
                                }
                            });
                        })();

                        requestOne.save()
                        requestTwo.save()
                        // console.log('line 324');
                        // console.log(requestTwo);
                        // res.status(200).send(requestOne);
                        res.status(200).send({confirm: true, message: 'connectionRequestSent', originalID: requestTwo._id});
                } //message: request

                 /* if accepted */
                else if(req.body.message == 'connectionAcceptedSent') {

                    console.log('accepting connection...');

                    // if(userToCheck.connections.includes(sender.id)) {
                    //     res.status(200).send({confirmation: false})
                    // } else {

                        (async ()=> {
                            let addSenderToReciever = await User.findByIdAndUpdate(sender.id,
                                {$push: {"connections": recipient.id}},
                                {upsert: true}
                            ).then((data)=> {
                                if(data) {
                                    console.log("recipient added to sender's list of connections")
                                }
                            })

                            let addRecieverToSender = await User.findByIdAndUpdate(recipient.id,
                                {$push: {"connections": sender.id}},
                                {upsert: true}
                            ).then((data)=> {
                                if(data) {
                                    console.log("sender added to recipient's list of connections")
                                }else {
                                    console.log("error in adding sender to recipient's list")
                                }
                            })
                        })()

                        /* make new notif confirming connection between users, save them to
                            each other's notif lists */
                        let acceptedOne = new Notification({
                                type: req.body.type,
                                isRead: false,
                                sender: sender.id,
                                senderUsername: sender.username,
                                recipients: recipient.id,
                                recipientUsernames: [recipient.username],
                                message: 'connectionAcceptedRecieved'
                        });
                        let acceptedTwo = new Notification({
                                type: req.body.type,
                                isRead: false,
                                sender: sender.id,
                                senderUsername: sender.username,
                                recipients: recipient.id,
                                recipientUsernames: [recipient.username],
                                message: 'connectionAcceptedSent'
                        });

                        (async ()=> {
                                let updateSenderList = await User.findByIdAndUpdate(
                                    mongoose.Types.ObjectId(sender.id),
                                    {$push: {"notifications": acceptedOne}},
                                    [{upsert: true}, {useFindandModify: false}],
                                ).then((res) => {
                                    if(res) {
                                        console.log(`notif of acceptance added to ${sender.userName}'s list`)
                                    }else {
                                        console.log("error in adding notif to sender's list")
                                    }
                                })

                                let updateRecipientList = await User.findByIdAndUpdate(
                                    mongoose.Types.ObjectId(recipient.id),
                                    {$push: {"notifications": acceptedTwo}},
                                    [{upsert: true}, {useFindandModify: false}],
                                ).then((res) => {
                                    if(res) {
                                        console.log(`notif of acceptance added to ${recipient.userName}'s list`)
                                    }else {
                                        console.log("error in adding notif to recipient's list")
                                    }
                                })
                        })();

                        acceptedOne.save()
                        acceptedTwo.save()

                        //update user's interaction count
                        let ids = [sender.id, recipient.id];
                        let newPoint = await User.updateMany({ _id: {$in: ids }}, {$inc: {interactionCount: 1}});

                        console.log( `${sender.username} is now connected with ${recipient.username}` );
                        res.status(200).send({confirm: true, message: 'connectionAcceptedSent', originalID: acceptedOne._id});
                    // }
                } //message: connectionAccepted

                else if(req.body.message == "accessRequested") {

                    /**
                     * A L G O
                     * create and add invite notif to the invited's notif list
                     * 
                     * requester -> owner
                     * or
                     * owner -> invitee
                     */

                    //09. 26. 2024
                    // for preexisting check
                    // need: senderID, message as accessRequested and isRead as false
                    console.log(req.body)
                    let request = new Notification({
                            type: req.body.type, //invite
                            isRead: false,
                            sender: _id,
                            senderUsername: _username,
                            recipients: [req.body.recipients], 
                            recipientUsername: [recipient.username],
                            message: 'accessRequested',
                            details: {
                                groupID: req.body.groupID,
                                groupName: req.body.groupName
                            }
                        });

                    //if
                    (async()=> {
                        let updateRecipientNotifs = await User.update(
                            { _id: { $in: [req.body.recipients]}}, //in order to update multiple recipients / admins
                            {$push: {"notifications": request}},
                            [{upsert: true}, {useFindandModify: false}, {multi: true}],
                        ).then((res) => {
                            if(res) {
                                console.log("notification of request added to recipient's list")
                            }
                        });
                    })();

                    res.status(200).send({confirmation: true, message: 'accessRequested'});
                } //message: accessRequested

                else if(req.body.message == "accessGranted") {

                    /**
                     * A L G O
                     * create and add invite notif to invitee-user's notif list
                     * 
                     * owner doesn't recieve notification of acceptance,
                     * only invitee or requester
                     */

                    let request = new Notification({
                            type: req.body.type, //invite
                            isRead: false,
                            sender: _id,
                            senderUsername: _username,
                            recipients: req.body.recipients[0], //original requester 
                            recipientUsername: recipient.username,
                            message: 'accessGranted',
                            details: {
                                groupID: req.body.groupID,
                                groupName: req.body.groupName
                            }
                        });

                    (async()=> {
                        let updateSenderList = await User.findByIdAndUpdate(
                            mongoose.Types.ObjectId(req.body.recipients[0]),
                            {$push: {"notifications": request}},
                            [{upsert: true}, {useFindandModify: false}],
                        ).then((res) => {
                            if(res) {
                                console.log("notification of access added to recipient's list")
                            }
                        });
                    })();

                    console.log(req.body)
                    let group = await Groups.findOne({_id: req.body.groupID})
                    console.log(group);
                    group.hasAccess.push(req.body.recipients[0]);
                    await group.save();

                    //update users' interactionCount
                    let ids = [_id, req.body.recipients[0]];
                    let newPoint = await User.updateMany({ _id: {$in: ids }}, {$inc: {interactionCount: 1}});

                    let user = await User.findById(_id);
                    let notif = user.notifications.filter((notif) => {
                        if(notif[0]._id == req.body.originalID) {
                            return notif;
                        }
                    })
                    notif[0][0].isRead = true;
                    await user.save({ suppressWarning: true });

                    res.status(200).send({confirmation: true, data: request}); //message: accessGranted
                } //message: accessGranted

                else if(req.body.message == "subscriptionRequestSent") {
                    //request notif in recipient's list

                    //originalRecipient
                    let requestTwo = new Notification({
                            senderUsername: sender.username,
                            recipients: [recipient.id],
                            type: req.body.type,
                            isRead: false,
                            sender: sender.id,
                            message: 'subscriptionRequested'
                        });

                    //original sender
                        let requestOne = new Notification({
                            type: req.body.type,
                            isRead: true,
                            sender: sender.id,
                            senderUsername: sender.username,
                            recipients: [recipient.id],
                            recipientUsernames: [recipient.username],
                            message: 'subscriptionRequest'
                        });

                        
                        (async()=> {
                            let updateSenderList = await User.findByIdAndUpdate(
                                mongoose.Types.ObjectId(sender.id),
                                {$push: {"notifications": requestOne}},
                                [{upsert: true}, {useFindandModify: false}],
                            ).then((res) => {
                                if(res) {
                                    console.log("notification of connection request added to sender's list")
                                }
                            });

                            let updateRecipientList = await User.findByIdAndUpdate(
                                mongoose.Types.ObjectId(recipient.id),
                                {$push: {"notifications": requestTwo}},
                                [{upsert: true}, {useFindandModify: false}],
                            ).then((res) => {
                                if(res) {
                                    console.log("notification of connection request added to recipient's list")
                                }
                            });
                        })();

                        requestOne.save()
                        requestTwo.save()

                        res.status(200).send({confirm: true, message: 'subscriptionRequestSent', _id: requestTwo._id});
                } //message: subscriptionRequested

                // when message is subAccepted, original reciever becomes sender - it gets flipped
                // when message is subscribed, original sender is subscriber
                else if(req.body.message == "subscriptionAccepted" || req.body.message == 'subscribed') {
      
                    //sender of acceptance notif is user being add

                    (async ()=> {

                        let first = req.body.message == 'subscriptionAccepted' ? sender.id : recipient.id,
                            second = req.body.message == 'subscriptionAccepted' ? recipient.id : sender.id;

                        let addSenderToReciever = await User.findByIdAndUpdate(first,
                            {$push: {"subscribers": second}},
                            {upsert: true}
                        ).then((data)=> {
                            if(data) {
                                console.log("recipient added to sender's list of subscriptions")
                            }
                        })

                        let addRecieverToSender = await User.findByIdAndUpdate(second,
                            {$push: {"subscriptions": first}},
                            {upsert: true}
                        ).then((data)=> {
                            if(data) {
                                console.log("sender added as recipient's list of subscriber")
                            }else {
                                console.log("error in adding sender to recipient's list")
                            }
                        })
                    })()

                    //original recipient of initial request
                    let acceptedOne = new Notification({
                            // type: req.body.message == 'subscriptionAccepted' ? req.body.type : 'confirmation',
                            type: 'request', //should be the same regardless whether auto sub or not
                            isRead: false,
                            sender: sender.id,
                            senderUsername: sender.username,
                            recipients: recipient.id,
                            recipientUsernames: [recipient.username],
                            // message: req.body.message == 'subscriptionAccepted' ? 'subscriptionAccepted' : 'subscribed'
                            message: 'subscriptionAccepted'
                    });

                    //original sender of request
                    let acceptedTwo = new Notification({
                            //type: req.body.type, //request
                            type: 'confirmation',
                            isRead: false,
                            sender: sender.id,
                            senderUsername: sender.username,
                            recipients: recipient.id,
                            recipientUsernames: [recipient.username],
                            message: 'subscribed'
                    });

                    (async ()=> {
                            let updateSenderList = await User.findByIdAndUpdate(
                                mongoose.Types.ObjectId(sender.id),
                                {$push: {"notifications": acceptedOne}},
                                [{upsert: true}, {useFindandModify: false}],
                            ).then((res) => {
                                if(res) {
                                    console.log(`notif of acceptance added to ${sender.userName}'s list`)
                                }else {
                                    console.log("error in adding notif to sender's list")
                                }
                            })

                            let updateRecipientList = await User.findByIdAndUpdate(
                                mongoose.Types.ObjectId(recipient.id),
                                {$push: {"notifications": acceptedTwo}},
                                [{upsert: true}, {useFindandModify: false}],
                            ).then((res) => {
                                if(res) {
                                    console.log(`notif of acceptance added to ${recipient.userName}'s list`)
                                }else {
                                    console.log("error in adding notif to recipient's list")
                                }
                            })
                    })();

                    acceptedOne.save()
                    acceptedTwo.save()

                    //update user's interaction count
                    let ids = [sender.id, recipient.id];
                    let newPoint = await User.updateMany({ _id: {$in: ids }}, {$inc: {interactionCount: 1}});

                    console.log( `${sender.username} is now subscribed to ${recipient.username}` );
                    res.status(200).send({
                        confirm: true, 
                        message: req.body.message == 'subscriptionAccepted' ? 'subscriptionAccepted' : 'subscribed',
                        _id: acceptedTwo._id 
                    });
                } //message: subscriptionAccepted

            // }//else for initial request check
        }
           
        /* notif of being tagged in post or comment */
        else if(type == 'comment') {

            /**
                - get initial sender (comment poster) and recipient (post author)
                - create notif to add to recipients notifList
                - update recipient's notif list 
                - send res status 200, send true
            **/

            let recipients = [];
            await Promise.all(
                req.body.recipients.map(async(recipient) => {
                    let request = await User.findById(mongoose.Types.ObjectId(recipient));
                    let user = {
                        username: request.userName,
                        id: request._id
                    };
                    recipients.push(user);
                })
            )

            let response;
            await Promise.all(
                recipients.map(async(recip) => {

                    if(recip.id == _id) {
                        response = true;
                        return
                    } else {
                        let newNotif = new Notification({
                            type: 'comment',
                            isRead: false,
                            sender: req.body.senderID,
                            senderUsername: req.body.senderUsername,
                            url: req.body.postURL,
                            message: req.body.message,
                            recipients: [recip.id],
                            details: {
                                postTitle: req.body.postTitle,
                                postOwner: req.body.postOwner,
                                commentID: req.body.commentID
                            }
                        });

                        newNotif.save();
                        response = newNotif._id
                        console.log(newNotif._id)

                        let updateSenderList = await User.findByIdAndUpdate(
                                {_id: mongoose.Types.ObjectId(recip.id)},
                                {$push: {"notifications": newNotif}},
                                [{upsert: true}, {useFindandModify: false}],
                            ).then((res) => {
                                if(res) {
                                    console.log(`notification of ${req.body.senderUsername}'s comment added to recipients's list`);
                                }
                            });
                    }
                })
            );
            // res.status(200).send(JSON.stringify({_id: response}));
            res.status(200).send(response)
        }

        /* notif of user being tagged in a post or comment(?) */
        else if(type == 'tagging') {

            // console.log(req.body);
            console.log('notif made: tagging');
            let recipients = req.body.recipients;

            let notifID;
            await Promise.all(
                recipients.map(async(recip) => {

                    let newNotif = new Notification({
                        type: 'tagging',
                        isRead: false,
                        sender: req.body.senderID,
                        senderUsername: req.body.senderUsername,
                        url: req.body.url,
                        message: 'recieved',
                        recipients: [recip],
                        details: {
                            postTitle: req.body.postTitle
                        }
                    });

                    newNotif.save();
                    notifID = newNotif._id;

                    let updateRecipientList = await User.findByIdAndUpdate(
                            mongoose.Types.ObjectId(recip),
                            {$push: {"notifications": newNotif}},
                            [{upsert: true}, {useFindandModify: false}],
                        ).then((res) => {
                            if(res) {
                                console.log(`notification of ${req.body.senderUsername}'s post added to recipients's list`);
                            }
                        });
                })
            );
            res.status(200).send(notifID);
        }
        
    } catch(err) {

        console.log(err);
        res.status(400).send({message: "An Error Has Occured. Please Try Again"});
    }
})

app.post('/settings', verify, upload.any(), async(req, res)=> {

    const auth = req.header('auth-token');
    const base64url = auth.split('.')[1];
    const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
    const {_id, _username} = decoded; 
    let user = await User.findById(_id);

    console.log(req.body)
    // console.log(req.files)

    try {

        if(req.body.option == 'getUserSettings') {
            
            let settings = {
                profilePhoto: user.profilePhoto,
                biography: user.bio,
                privacy: user.privacySetting,
                invites: user.invites.length
            }
            res.status(200).send(settings);
        }

        else if(req.body.option == 'logout') {}

        else if(req.body.option == 'username') {

                let check = await User.findOne({userName: req.body.newUsername});
                console.log(check)
                if(check) {
                    res.status(200).send({confirmation: false, message: "This username is taken"})
                }
                else {
                    await User.findByIdAndUpdate(_id, {username: req.body.newUsername})

                    await Posts.updateMany(
                        {owner: _id},
                        { $set: {author: req.body.newUsername}},
                        {multi: true}
                    );

                    await Comment.updateMany(
                        {owner: _id},
                        { $set: {author: req.body.newUsername}},
                        {multi: true}
                    );

                    res.status(200).send({confirmation: true, message: `Username changed to ${req.body.newUsername}`});
                }
        }

        else if(req.body.option == 'profilePhoto') {

                console.log(req.body)
                console.log(req.files)
                const d = new Date();
                const month = d.getMonth();
                const mm = month + 1;
                const date = d.getDate();
                const year = d.getFullYear();
                const timeStamp = d.getTime();

                /* Processes uploaded photo */
                const fileNumber = req.files[0].fieldname;
                const fileName = `${fileNumber}_${_username}_${mm}-${date}-${year}_${timeStamp}`;
                const file = uploadMedia.file(fileName);
                const options = {
                  resumable: false,
                  metadata: {
                    contentType: 'image/jpeg/png',
                  }
                };

                await file.save(req.files[0].buffer, options);

                await uploadMedia.setMetadata({
                    enableRequesterPays: true,
                      website: {
                        mainPageSuffix: 'index.html',
                        notFoundPage: '404.html',
                      },
                });

              
                const [cdnUrl] = await file.getSignedUrl({
                  action: 'read',
                  expires: '01-01-2499',
                });

                let title = `${fileNumber}`;

                // req.body[title] = cdnUrl;

                user.profilePhoto = cdnUrl;
                await user.save();

                await Posts.updateMany(
                    {owner: _id},
                    { $set: {profilePhoto: cdnUrl}},
                    {multi: true}
                );

                await Comment.updateMany(
                    {ownerID: _id},
                    { $set: {profilePhoto: cdnUrl}},
                    {multi: true}
                );

                res.status(200).send({
                    confirmation: true, 
                    message: 'Profile Photo Updated !', 
                    updatedPhoto: cdnUrl
                })
        }

        else if(req.body.option == 'biography') {

            user.bio = req.body.biography
            await user.save()
            res.status(200).send({confirmation: true})
        }

        else if(req.body.option == 'changePassword') {
        
            const passwordValid = await encrypt.compare(req.body.currentPassword, user.password);

            if(!passwordValid) {
                res.status(200).send({error: true, message: "This password is incorrect"});
            }
            else {

                const salt = await encrypt.genSalt(10);
                const hashedPass = await encrypt.hash(req.body.newPassword, salt);
                user.password = hashedPass;
                await user.save();
                res.status(200).send({confirmation: true});
            }
        }

        else if(req.body.option == 'privacy') {

            await User.update(
                {_id: _id},
                { $set: {privacySetting: req.body.state}},
                {multi: true}
            );

            await Posts.update(
                {owner: _id},
                { $set: {privacyToggleable: req.body.state}},
                {multi: true}
            );
            res.status(200).send({confirmation: true})
        }

        else if(req.body.option == 'invitationCount') {
        }

        else if(req.body.option == 'updateLocation') {

            let newData = {
                city: req.body.name,
                lonLat: req.body.lonLat
            }

            await User.updateOne(
                {_id: _id},
                {
                    $set: {'settings.preferredLocation': newData }
                },
                {multi: true}
            );
            res.status(200).send({confirmation: true})
        }

        else if(req.body.option == 'searchLocationDetails') {

            const placeId = req.body.placeID;
            const apiKey = process.env.GCS_PLACES_API_KEY;
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}&fields=geometry`;            

            const response = await fetch(url);
            const data = await response.json();

            console.log(data);

            let lonLat;

            if(data.status === 'OK' && data.result.geometry) {
                lonLat = [data.result.geometry.location.lng, data.result.geometry.location.lat]
            }

            res.status(200).send({lonLat: lonLat});
        }

        else if(req.body.option == 'searchLocation') {

            //subroute proxy for GCS Places API
            const query = req.body.query;
            const apiKey = process.env.GCS_PLACES_API_KEY;
            const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&types=(regions)`;

            const response = await fetch(url);
            const data = await response.json();

            const filtered = data.predictions.map(place => {
                const placeParts = place.description.split(','); // Split "New York, NY, USA"
                const cleanedName = placeParts.length > 2
                  ? `${placeParts[0]}, ${placeParts[placeParts.length - 1]}` // Keep city & country only
                  : place.description; // If no state abbreviation, keep as-is

                return {
                    description: cleanedName.trim(),
                    place_id: place.place_id
                }
            })

                

            if (data.status !== 'OK') {
                return res.status(500).json({ error: 'Google API error', details: data });
            }

            res.status(200).send(filtered);
        }

        else if(req.body.option == 'pinnedPosts') {

            if(req.body.type == 'check') {

                let check = user.pinnedPosts.some(post => post == req.body.postID);
                res.status(200).send({confirmation: check == true ? true : false});
            }
            else if(req.body.type == 'add') {

                user.pinnedPosts.push(req.body.postID);
                await user.save();
                res.status(200).send({confirmation: true})
            }   
            else if(req.body.type == 'remove') {
                let newArray = user.pinnedPosts.filter(post => !req.body.content.includes(post));
                user.pinnedPosts = newArray;
                await user.save();
                res.status(200).send({confirmation: true});
            }
        }

        else if(req.body.option == 'pinnedMedia') {

            if(req.body.type == 'add') {

                // 06. 09. 2024
                // change check so that it
                // Filter out any duplicates from req.body.postID already
                // within user.pinnedMedia, AND add new ones

                let itemCheck = user.pinnedMedia.filter(item => {
                    for(let i = 0; i < req.body.content.length; i++) {

                        if(item.url == req.body.content[i].url) {
                            return item;
                        }
                        else {
                            return;
                        }
                    }
                })
                if(itemCheck.length > 0) {
                    res.status(200).send({confirmation: false, message: 'Some selected content is already in Pinned Media'})
                } 
                else {
                    req.body.content.forEach(item => {
                        user.pinnedMedia.push(item);
                    })
                    await user.save();
                    res.status(200).send({confirmation: true});
                }
            }
            else if(req.body.type == 'remove') {

                // let newArray = user.pinnedMedia.map(item => item.toString())
                // req.body.content = req.body.content.map(item => item.url);
                // let newArray = user.pinnedMedia.filter(item => item.url != req.body.content.includes(item.url));
                let newArray = user.pinnedMedia.filter(item => req.body.content.every(url => url != item.url));
                user.pinnedMedia = newArray;
                console.log(user.pinnedMedia)
                user.save();
                res.status(200).send({confirmation: true})
            }
        }

        else if(req.body.action == 'addTopics') {

            await User.updateOne(
                {_id: _id},
                {$addToSet: {"settings.topics": { $each: req.body.topics }}
            });
            res.status(200).send({confirmation: true});
        }

        else if(req.body.action == 'removeTopics') {
            await User.updateOne(
                {_id: _id},
                {$pull: {"settings.topics": { $in: req.body.topics }}
            });
            res.status(200).send({confirmation: true});
        }

        else if(req.body.action == 'saveCustomLog') {

            //adds log to user's list if it's array location doesn't exist
            //replaces log in array if it's prexisting


            //if this is a NEW log
            if(user.settings.customLogs.log[req.body.logNumber].hasOwnProperty(req.body.number) == false) {

                Users.updateOne(
                    {_id: _id},
                    {
                        $push: {"settings.customLogs.log": {
                            title: req.body.title,
                            logNumber: req.body.logNumber,
                            connections: req.body.selectedConnections,
                            subscriptions: req.body.selectedSubscriptions,
                            topics: req.body.selectedTopics,
                            tags: req.body.selectedTags,
                            locations: req.body.selectedLocations
                        } }
                    }
                )

                res.status(200).send({confirmation: true})
            }

            //if this is a prexisting log
            else if(user.settings.customLogs.log[req.body.logNumber] !== undefined) {

                Users.updateOne(
                    {_id: _id},
                    {
                        $set: { [`settings.customLogs.log.${req.body.logNumber}`]: {
                            title: req.body.title,
                            connections: req.body.selectedConnections,
                            subscriptions: req.body.selectedSubscriptions,
                            topics: req.body.selectedTopics,
                            tags: req.body.selectedTags,
                            locations: req.body.selectedLocations
                        }}
                    }
                )

                res.status(200).send({confirmation: true})
            }
        } 

        else if(req.body.action == 'getCustomLog') {

            let customLog = user.settings.customLogs.log[req.body.logNumber];
            res.status(200).send({customLog: customLog});
        }

        else if(req.body.action == 'setCurrentLog') {

            User.updateOne(
                {_id: _id},
                {
                    $set: {"settings.customLogs.currentLog": req.body.currentLog}
                }
            )

            res.status(200).send({confirmation: true});
        }   

        else if(req.body.action == 'deleteCustomLog') {

            user.settings.customLogs.logs.splice(req.body.indexToDelete, 1);
            await user.save();
            res.status(200).send({confirmation: true});
        }

        else if(req.body.action == 'getLogAmount') {

            let length = user.settings.customLogs.logs.length;
            res.status(200).send(length ? length : 0);

        }     
    }
    catch(err) {
        console.log(err);
        res.status(400).send({message: "An Error Has Occured. Please Try Again"});
    }
})

module.exports = app;
