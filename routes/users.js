const express = require('express'),
      app = express.Router(),
      mongoose = require('mongoose'),
      {User, Notification} = require('../models/user'),
      encrypt = require('bcryptjs'),
      JWT = require('jsonwebtoken'),
      verify = require('../verifyUser');
require('dotenv').config();

//may need to change how I import notification 
// might be {User, Notification} instead

//Simple 'create new  users' function
app.post('/newuser', async (req,res) => {

    const emailExist = await User.findOne({emailAddr:req.body.emailAddr})
    if(emailExist) {
        return res.status(400).send("This email is already linked to an account")
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
});

//Simple return all users function
app.post('/login', async (req, res) => {
  
    const user = await User.findOne({emailAddr:req.body.emailAddr});
    if(!user) {
        return res.status(400).send({message: "This email is not valid"});
    }
    
    const passwordValid = await encrypt.compare(req.body.password, user.password);
    //decrpyt password
    if(!passwordValid) {
        return res.status(400).send({message: "This password is invalid"});
    }
    
    const userName = user.userName;
    let JWTpayload = {
        '_id': user._id, 
        '_username': userName
    };
    const signature = JWT.sign(JWTpayload, process.env.TOKEN_SECRET);
    //sets JWT within reponse header and returns 
    //it to the front end
    res.status(200).json(signature);
    //res.send(JWTpayload);
    //this info needs to be within user request headers whenever performing account operations. 
});

app.get('/user', async (req,res) => {
  
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

    else {
        res.status(200).send(singleUser);
    }
})

app.get('/search', verify, async(req, res) => {
  
  /*
    09. 25. 2022
    takes a query, so url is
    :3333/users/search?query=${userQuery}
  */

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
});

app.post('/notif/:type', verify, async(req, res)=> {

    /* 09. 05. 2023
        New Notification Model & request object model

        type: string | "request", "commentInitial", "commentResponse", "tagging"
        isRead: boolean
        sender: string | userID
        recipients: string | userID(s)
        url: string | url for post OR original notif ID
        message: string | *sent, *recieved, *accept, *ignore
    */

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

        // let notif = await Notification.findByIdAndUpdate({_id: req.body.notifID}, {isRead: true});
        // console.log('notif is read?' + notif.isRead);
        // console.log(notif);
        // res.status(200).send(notif.isRead);
        // User.findById({_id: req.body.userID}).then((user)=> {
        //     let notif = user.notifications.id(req.body.notifID);
        //     notif['isRead'] = true;
        //     user.save();
        // });
        // res.status(200).send(true);
        //, notifications: {$elemMatch: {_id: req.body.notifID}}
        // User.findOneAndUpdate({_id: req.body.userID, 'notifications._id': req.body.notifID},
        //                       {set: {'notifications.$.isRead': true}},
        //                       {'new': true, 'safe': true, 'upsert': true});
        // res.status(200).send(true);

        // console.log(req.body)
        // (async()=> {
        //     let user = await User.findById({_id: req.body.userID});
        //     let notif = user.notifications.find(notif => { return notif._id == req.body.notifID} );
        //     // console.log(notif);
        //     console.log(user);
        // })();
        /***
         * 10. 28. 2023
         * Due to the weird way in which notifications are currently stored,
         * this implementation is most efficient ...
         */
        let user = await User.findById(_id);
        let notif = user.notifications.filter((notif) => {
            if(notif[0]._id == req.body.notifID) {
                return notif;
            }
        })
        notif[0][0].isRead = true;
        user.save();
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

        // console.log('line 256')
        // console.log(req.body)
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

                requestOne.save()
                requestTwo.save()
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
        console.log(req.body);

        let recipients = [];
        console.log('line 520');
        console.log(req.body.recipients);
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

        await Promise.all(
            recipients.map(async(recip) => {

                if(recip == _id) {
                    return
                } else {
                    let newNotif = new Notification({
                        type: 'comment',
                        isRead: false,
                        sender: req.body.senderID,
                        senderUsername: req.body.senderUsername,
                        url: req.body.postURL,
                        message: 'initial',
                        recipients: [recip.id]
                    });

                    newNotif.save();

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
        res.status(200).send(true);
    }

    /* notif of comment on post, reshare, flagging, etc */
    else if(type == 'commentResponse') {

    }

    /* notif of user being tagged in a post or comment(?) */
    else if(type == 'tagging') {

        console.log(req.body);
        let recipients = req.body.recipients;

        await Promise.all(
            recipients.map(async(recip) => {

                let newNotif = new Notification({
                    type: 'tagging',
                    isRead: false,
                    sender: req.body.senderID,
                    senderUsername: req.body.senderUsername,
                    url: req.body.postURL,
                    message: 'recieved',
                    recipients: [recip]
                });

                newNotif.save();

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
        res.status(200).send(true);

    }
})


module.exports = app;
