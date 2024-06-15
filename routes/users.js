const express = require('express'),
      app = express.Router(),
      mongoose = require('mongoose'),
      {User, Notification} = require('../models/user'),
      {Posts, Content, Comment} = require('../models/posts'),
      encrypt = require('bcryptjs'),
      JWT = require('jsonwebtoken'),
      verify = require('../verifyUser'),
      path = require('path'),
      util = require('util'),
      multer = require('multer'),
      {Storage} = require('@google-cloud/storage');
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
app.post('/newuser', async (req,res) => {

    try {

        const emailExist = await User.findOne({emailAddr:req.body.emailAddr})
        if(emailExist) {
            return res.status(400).send({error: true, message: "This email is already linked to an account"})
        }

        /* 09. 14. 2023
            Should also check whether username has already been taken
        */
        
        const userPass = req.body.password
        const salt = await encrypt.genSalt(10);
        const hashedPass = await encrypt.hash(userPass, salt);
        
        const user = new User({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            emailAddr: req.body.emailAddr,
            userName: req.body.userName,
            password: hashedPass
        });

        try {
          const savedUser = await user.save();
          //06.27.2022 Front End takes boolean to confirm signup
          console.log('new user created');
          res.send(true);
        }
        catch (error) {
          res.status(500).send(error);
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
            '_profilePhoto': user.profilePhoto
        };
        const signature = JWT.sign(JWTpayload, process.env.TOKEN_SECRET);
        //sets JWT within reponse header and returns 
        //it to the front end
        res.status(200).json({confirm: true, payload: signature});
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

        let singleUser = await User.findById(_id).then((user) => {
              if(!user) {
                 console.log("error retrieving user");
                } else {
                  return user;
                }
          });
          
        if(req.query.query == 'getAllConnects') {

            let connects = singleUser.connections;
            connects = await User.find({'_id': {$in: connects }});

            let list = []
            connects.forEach((userInfo) => {
                let result = {
                    fullName: `${userInfo.firstName} ${userInfo.lastName}`,
                    userName: userInfo.userName,
                    id: userInfo._id
                }

                list.push(result);
            })
            res.status(200).send(list);
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

        else if(req.query.query == 'singleUser') {
            if(req.params.userID == _id) {

                let posts = await Posts.find({ _id: {$in: singleUser.pinnedPosts}}).sort({createdAt: -1});
                res.status(200).send({user: singleUser, pinnedPosts: posts});
            }
            else {
                console.log('this one')
                let user = await User.findById(req.params.userID);
                console.log(user);
                let posts = await Posts.find({ _id: {$in: user.pinnedPosts}}).sort({createdAt: -1});
                res.status(200).send({user: user, pinnedPosts: posts});
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


        /* update original notif to be isRead = true */
        if(type == 'markRead') {

            let user = await User.findById(_id);
            let notif = user.notifications.filter((notif) => {
                if(notif[0]._id == req.body.notifID) {
                    return notif;
                }
            })
            notif[0][0].isRead = true;
            user.save({ suppressWarning: true });
            console.log(notif);
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

            // console.log(reordered)

            console.log(`sending ${user.userName} notifs`)

            res.status(200).send(reordered);
        }

        /** 
         * 10. 27. 2023
         * Notifs are currently in array, per each array entry (._ .)
         * will most likely be fixed once I create new profiles
         */
        else if(type == 'sendUnreadCount') {

            let user = await User.findById(_id).then((user) => {
                if(user) {
                  return user
                }
                else {
                  console.log("issue finding user. might not exist");
                }
            })

          let notifs = user.notifications;
          console.log(notifs)
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

            /* sender IS always be sender of request,
                recipient is who recieved initial request
            */
            let sender = await User.findById(mongoose.Types.ObjectId(req.body.senderID));
            sender = {
                username: sender.userName,
                id: sender._id
            }
            console.log(sender);

            let recipient = await User.findById(mongoose.Types.ObjectId(req.body.recipients[0]))
            recipient = {
                username: recipient.userName,
                id: recipient._id
            }
            console.log(recipient);

            /**
             * 10. 13. 2023
             * use senderID and recipient and message: ignored, to check whether there's an ignored
             * request. Can then send user mesage 'you already sent a request!'
             */

            /* initial request */
            if(req.body.message == "sent") {

                // console.log('processing a connection request');

                // try {
                    let requestTwo = new Notification({
                        senderUsername: sender.username,
                        recipients: [recipient.id],
                        type: req.body.type,
                        isRead: false,
                        sender: sender.id,
                        message: 'recieved'
                    });

                    let requestOne = new Notification({
                        type: req.body.type,
                        isRead: true,
                        sender: sender.id,
                        senderUsername: sender.username,
                        recipients: [recipient.id],
                        recipientUsername: recipient.username,
                        message: 'sent'
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

                    // requestOne.save()
                    // requestTwo.save()
                    console.log('line 324');
                    console.log(requestTwo);
                    res.status(200).send(requestOne);
            }

             /* if accepted */
            else if(req.body.message == 'accept') {

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
                        recipientUsername: recipient.username,
                        message: 'accept'
                });
                let acceptedTwo = new Notification({
                        type: req.body.type,
                        isRead: false,
                        sender: sender.id,
                        senderUsername: sender.username,
                        recipients: recipient.id,
                        recipientUsername: recipient.username,
                        message: 'accept'
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
                console.log( `${sender.username} is now connected with ${recipient.username}` );
                res.status(200).send(true);
            }

            /* if ignored */
            else if(req.body.message == 'ignore') {

                /* if request is ignored, req.body should include the ._id of the
                    connectRequest notif, so that it can be modified

                    sender in req.body NEEDS to be sender of request
                    recipient is ID of user ignoring the request
                */
                let originalRequest = 
                Notification.findByIdAndUpdate(mongoose.Types.ObjectId(req.body.originalID), 
                    {message: 'ignore', isRead: true},
                    (err, doc)=> {
                        if(err) {
                            console.log(err)
                            console.log('unable to find original notification to modify');
                        }
                        else {
                            console.log('connection request ignored')
                        }
                    })
                console.log({message:`${sender.username}'s original request to ${recipient.username} has been ignored`})
                res.status(200).send(true);      
            }
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
                            message: 'initial',
                            recipients: [recip.id],
                            details: req.body.details
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
                        details: req.body.details
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

        else if(type == 'invite') {

            /***
             * Necessary Variables
             * type: request, accepted, ignore
             * sender: userID of requester
             * senderUsername: userName
             * recipients: array has one owner or many admins
             * 
             * details: 
             *   - req.body.details should include
             *     groupName:
             *     groupID:
             * 
             * acceptance or ignore done on frontEnd
             * 
             * for ignore:
             * req.body.details = original request notif ID
             */

            if(req.body.message == "request") {

                /**
                 * A L G O
                 * create and add invite notif to invitee-user's notif list
                 * 
                 * requester -> owner
                 * or
                 * owner -> invitee
                 */

                let request = new Notification({
                        type: req.body.type, //invite
                        isRead: false,
                        sender: req.body.userID,
                        senderUsername: req.body.userName,
                        recipients: req.body.recipients, 
                        recipientUsername: recipient.username,
                        message: 'request',
                        details: req.body.details
                    });

                //if
                (async()=> {
                    let updateSenderList = await User.update(
                        { _id: { $in: [req.body.recipients]}},
                        {$push: {"notifications": request}},
                        [{upsert: true}, {useFindandModify: false}, {multi: true}],
                    ).then((res) => {
                        if(res) {
                            console.log("notification of invite added to recipient's list")
                        }
                    });
                })();

                res.status(200).send(request);
            }

            else if(req.body.message == "accepted") {

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
                        sender: req.body.userID,
                        senderUsername: req.body.userName,
                        recipients: req.body.recipients, 
                        recipientUsername: recipient.username,
                        message: 'accepted',
                        details: req.body.details
                    });

                (async()=> {
                    let updateSenderList = await User.findByIdAndUpdate(
                        mongoose.Types.ObjectId(req.body.userID),
                        {$push: {"notifications": request}},
                        [{upsert: true}, {useFindandModify: false}],
                    ).then((res) => {
                        if(res) {
                            console.log("notification of invite added to recipient's list")
                        }
                    });
                })();

                res.status(200).send(request);
            }

            else if(req.body.message == "ignore") {
                
                /**
                 * A L G O
                 * marks recipient notification as read 
                 */

                (async()=> {

                    let user = await User.findById(_id);
                    let notifs = user.notifications;

                    let indexOfEditted = notifs.findIndex((notif)=> notif._id == req.body.details);
                    notifs[indexOfEditted].isRead = true;
                    user.save();
                })();

                res.status(200).send(true);
            }                
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
    const user = await User.findById(_id);

    console.log(req.body)
    console.log(req.files)

    try {

        if(req.body.option == 'getUserSettings') {
            
            let settings = {
                profilePhoto: user.profilePhoto,
                biography: user.bio,
                privacy: user.isPrivate,
                invites: user.invites.length
            }
            res.status(200).send(settings);
        }

        if(req.body.option == 'username') {

                let check = await User.findOne({userName: req.body.newUsername});
                console.log(check)
                if(check) {
                    res.status(200).send({confirmation: false, message: "This username is taken"})
                }
                else {
                    let thisUser = User.findByIdAndUpdate(_id, 
                        {username: req.body.newUsername}, (err, data)=> {
                            if(err) {
                                res.status(400).send({message: "An Error Has Occured. Please Try Again"})
                            }
                            else {
                                res.status(200).send({confirmation: true, message: `Username changed to ${req.body.newUsername}`});
                            }
                    })
                }
        }

        else if(req.body.option == 'profilePhoto') {

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

                await Posts.update(
                    {owner: _id},
                    { $set: {profilePhoto: cdnUrl}},
                    {multi: true}
                );

                await Comment.update(
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
                { $set: {isPrivate: req.body.state}},
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
    }
    catch(err) {
        console.log(err);
        res.status(400).send({message: "An Error Has Occured. Please Try Again"});
    }
})

module.exports = app;
