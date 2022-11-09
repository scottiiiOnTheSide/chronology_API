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
        return res.status(400).send("This email is not valid");
    }
    
    const passwordValid = await encrypt.compare(req.body.password, user.password);
    //decrpyt password
    if(!passwordValid) {
        return res.status(400).send("This password is invalid");
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

app.get('/getuser/:id', async (req,res) => {
  
      let _ID = mongoose.Types.ObjectId(req.params.id);
      let query = req.query.query;
      let singleUser = await User.findById(_ID).then((user) => {
      if(!user) {
         console.log("error retrieving user");
        } else {
          return user;
        }
      });
      let removalID = req.query.remove;
      
      let makeConnect = (userID) => {
        return User.findById(userID).then((user) => {
            if (!user) {
             console.log("Error in getting connection. maybe user has none?")
            } else {
              let result = {
                username: user.userName,
                id: user._id
              }
              return result;
            }
          });
      };
      
      if(query == 'sendConnects') {
        let connects = singleUser.connections;
        connects = await Promise.all(connects.map(async (user) => {
          return await makeConnect(user);
        }))
        console.log("generated user's connections");
        res.status(200).send(connects);
      } else if (query == 'removeConnect') {

        (async() => {
            let one = User.updateOne(
              { _id: _ID},
              {$pull: { 'connections': `${removalID}` }},
              function(err, val) {
                if(val) {
                  console.log(singleUser.connections);
                  console.log('removee disconnected from remover');
                  res.status(200).send("removed");
                } else {
                  console.log(err)
                }
              }
            )

            let two = User.updateOne(
                { _id:  mongoose.Types.ObjectId(removalID)},
                {$pull: {'connections': `${req.params.id}`}},
                function(err, val) {
                    if(val) {
                        console.log('remover disconnected from removee');
                    } else {
                        console.log(err)
                    }
                }
            )
        })
        


        
      } else {
        res.status(200).send(singleUser);
      }
})

app.get
('/search', verify, async(req, res) => {
  
  /*
    09. 25. 2022
    takes a query, so url is
    :3333/users/search?query=${userQuery}
  */
  
  try {
        let makeResult = (user) => {
          let value = {
            username: user.userName,
            name: `${user.firstName} ${user.lastName}`,
            id: user._id
          }
          return value
        }
        let results = await User.aggregate([
            {
                "$search": {
                    "index":"initial",
                    "autocomplete": {
                        "query": `${req.query.query}`,
                        "path": "userName",
                        "fuzzy": {
                            "maxEdits": 2,
                            "prefixLength": 3
                        }
                    }
                }
            }
        ]);
      
        results = results.map((user) => {
          return makeResult(user);
        })
        console.log(results);
        res.send(results);
    } catch (e) {
        res.status(500).send({ message: e.message });
    }
} )


app.post('/notif/:type', verify, async (req,res) => {

    let type = req.params.type,
        ID = req.query.id,
        tagRead = req.query.tagRead;

    if(ID && tagRead) {
      Notification.findByIdAndUpdate(
        ID, 
        { $set: {["tagAlert.read"]: "true"}},
        {useFindandModify: false}
      ).then((data) => {
          if(data) {
          console.log("tag alert now marked read");
          }
      });
    }

    if(type == 'connection') {
      
        let senderr = mongoose.Types.ObjectId(req.body.sender),
            recipientt = mongoose.Types.ObjectId(req.body.recipient);
      
        let sender = 
      await User.findById(senderr).then((user) => {
            if (user) {
              let result = {
                username: user.userName,
                id: user._id
              }
              return result;
            } else {
              console.log("Error in getting connection. maybe user has none?")
            }
      })
            
            
        let recipient = await User.findById(recipientt).then((user) => {
            if (user) {
              let result = {
                username: user.userName,
                id: user._id
              }
              return result;
            } else {
              console.log("Error in getting connection. maybe user has none?")
            }
        })
        
        if(req.body.status == 'sent') {

               /* User.findById sender and recipient
               so that their usernames can be added to the Notifs
               */
                try{
                    let connectReq = new Notification({
                        connectionRequest: {
                            sender: mongoose.Types.ObjectId(req.body.sender),
                            senderUsername: sender.username,
                            recipient: mongoose.Types.ObjectId(req.body.recipient),
                            recipientUsername: recipient.username,
                            status: req.body.status,
                            twinID: ''
                        }
                    })

                    let connectRec = new Notification({
                        connectionRequest: {
                            sender: mongoose.Types.ObjectId(req.body.sender),
                            recipient: mongoose.Types.ObjectId(req.body.recipient),
                            senderUsername: sender.username,
                            recipientUsername: recipient.username,
                            status: req.body.status,
                            twinID: ''
                        }
                    })

                    connectReq.connectionRequest.set('twinID', connectRec._id);
                    connectRec.connectionRequest.set('twinID', connectReq._id);

                    (async ()=> {
                        let oneOut = await User.findByIdAndUpdate(
                            mongoose.Types.ObjectId(req.body.sender),
                            {$push: {"notifications": connectReq}},
                            [{upsert: true}, {useFindandModify: false}],
                        ).then((res) => {
                                if(res) {
                                  console.log("notification added to sender's list")
                                }
                        })
                        // await oneOut.save();

                        let secondOut = await User.findByIdAndUpdate(
                            mongoose.Types.ObjectId(req.body.recipient),
                            {$push: {"notifications": connectRec}},
                            [{upsert: true}, {useFindandModify: false}],  
                        ).then((res) => {
                                if(res) {
                                  console.log("notification added to recipient's list")
                                }
                        })
                        // await secondOut.save();
                    })(); 

                    connectReq.save()
                    connectRec.save()
                    res.status(200).send({connectReq, connectRec, message: "request sent!"});
            }catch{
                res.status(404).send("something went wrong");
            }
            
        } else if (req.body.status == 'accepted') {

            let notifID = mongoose.Types.ObjectId(req.body.notifID);

            (async() => {

                let one = await Notification.deleteOne(
                    {_id: notifID}, 
                ).then((data) => {
                    if(data) {
                        // res.send(data)
                        console.log("independent notification doc of request to recipient, deleted");
                    } else {
                        console.log('Nothing to delete?')
                    }
                })

                let oneTwo = await User.findByIdAndUpdate(
                    {_id: recipientt}, 
                    {$pull: {"notifications": {"connectionRequest": {_id: mongoose.Types.ObjectId(req.body.notifID)}}}},
                    {useFindandModify: false}
                ).then((data) => {
                    if(data) {
                        // res.send(data)
                        console.log("notif in recipient's array, deleted");
                    } else {
                        console.log("notif in recipient's not found or deleted")
                    }
                })

                let two = await User.findByIdAndUpdate(
                    senderr,
                    {$push: {"connections": recipientt}},
                    {upsert: true}
                ).then((data) => {
                        if(data) {
                            // res.send(data)
                            console.log("recipient added to sender's connections");
                        }
                })

                //should include a check for whether entry already exists within user's
                //connection list
                let three = await User.findByIdAndUpdate(
                    recipientt,
                    {$push: {"connections": senderr}},
                    {upsert: true}
                ).then((data) => {
                    if(data) {
                        // res.send(data)
                        console.log("sender added to recipient's connections");
                    }
                })

                // let four = await Notification.findByIdAndRemove(
                //     {_id: mongoose.Types.ObjectId(req.body.twinID)},
                // ).then((data) => {
                //     if(data) {
                //         // res.send(data)
                //         console.log("original notif of sender's request, deleted");
                //     } else {
                //         console.log("nothing to delete?")
                //     }
                // })

                // let fourAndAHalf = await User.findByIdAndUpdate(
                //     senderr,
                //     {$pull: {"notifications": {"connectionRequest": {_id: mongoose.Types.ObjectId(req.body.twinID)}}}},
                //     { safe: true, upsert: true }
                // ).then((data) => {
                //     if(data) {
                //         console.log('Sender notif indicating they sent recipient a request, deleted');
                //     } else {
                //         console.log("unable to find doc - nothing to delete?");
                //     }
                // })

                let five = new Notification({
                        connectionRequest: {
                            sender: recipient.id, /*the original sender*/
                            accepter: recipient.username,
                            acceptee: sender.username,
                            status: 'accepted',
                            read: false
                        }
                })

                await five.save();

                let six = await User.findByIdAndUpdate(
                    senderr,
                    {$push: {"notifications": five}},
                    {upsert: true},
                ).then((data) => {
                    if(data) {
                        console.log("new notification added to recipient's list")
                    }
                })

                let seven = await User.findByIdAndUpdate(
                    recipientt,
                    {$push: {"notifications": five}},
                    {upsert: true},
                ).then((data) => {
                    if(data) {
                        console.log("new notification added to sender's list")
                    }
                })

                /* 10. 31. 2022
                    Okay, so, once a connectRequest with the status of accepted is sent,
                    the original sender becomes the recipient, 
                    and the original recipient becomes the sender
                */

                res.status(200)
                console.log(`connection made between ${sender.username} & ${recipient.username} !`)
            })();

        } else if (req.body.status == 'ignored') {

            Notification.findByIdAndUpdate(
                mongoose.Types.ObjectId(req.body.notifID),
                {$set: {['connectionRequest.status']: 'ignored'}},
                {useFindandModify: false}
            ).then(data => {
                if (!data) {
                  res.status(404).send({message: "Error"});
                } else{
                  res.status(200).send({message: "Post Updated"})
                }
            })

        }
    }
    else if (type == 'sendAll') {
      let id = mongoose.Types.ObjectId(req.body.sender);
      let user = await
      User.findById(id).then((user) => {
        if(user) {
          return user
        }
        else {
          console.log("issue finding user. might not exist");
        }
      })
      
      let notifs = user.notifications;
      console.log('user notifs' +`\n`+notifs)
      res.status(200).send(notifs);
    }
    
})


module.exports = app;

