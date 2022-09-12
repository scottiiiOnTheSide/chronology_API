const express = require('express'),
      app = express.Router(),
      mongoose = require('mongoose'),
      {User, Notification} = require('../models/user'),
      encrypt = require('bcryptjs'),
      JWT = require('jsonwebtoken');
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
  try {
      let _ID = mongoose.Types.ObjectId(req.params.id);
      console.log(_ID);
      //.send(_ID);
      let singleUser = await User.findOne({_id: _ID});
      console.log(singlePost);
      res.send(singlePost);
    }
    catch {
      res.status(404) 		
      res.send({ error: "User doesn't exist!" })
    }
})

app.get('/notification/:type', async (req,res) => {

    let type = req.param.type;
    if(type == 'connnection') {
        if(req.body.status == 'sent') {

            let connectReq = new Notification({
                connectionRequest: {
                    sender: mongoose.Types.ObjectId(req.body.sender),
                    recipient: mongoose.Types.ObjectId(req.body.recipient),
                    status: req.body.status,
                    twinID: ''
                }
            })

            let connectRec = new Notification({
                connectionRequest: {
                    sender: mongoose.Types.ObjectId(req.body.sender)
                    recipient: mongoose.Types.ObjectId(req.body.recipient),
                    status: req.body.status,
                    twinID: ''
                }
            })

            connectReq.set('twinID', connectRec._id);
            connectRec.set('twinID', connectReq._id);
            connectReq.save()
            connectRec.save()

            (async ()=> {
                await User.findByIdAndUpdate(
                    mongoose.Types.ObjectId(req.body.sender),
                    {$push: {"notifications": connectReq}},
                    {upsert: true},
                    function(err,success) {
                        if(err) {
                          console.log(err)
                        } else {
                          console.log("notification added to sender's list")
                        }
                    }
                )

                await User.findByIdAndUpdate(
                    mongoose.Types.ObjectId(req.body.recipient),
                    {$push: {"notifications": connectRec}},
                    {upsert: true},
                    function(err,success) {
                        if(err) {
                          console.log(err)
                        } else {
                          console.log("notification added to recipient's list")
                        }
                    }
                )
            })(); 

        } else if (req.body.status == 'accepted') {

            Notification.findByIdAndUpdate(
                mongoose.Types.ObjectId(req.body.notifID),
                {$set: {['status': 'accepted'}},
                {useFindandModify: false}
            ).then(data => {
                User.findByIdAndUpdate(
                    mongoose.Types.ObjectId(req.body.recipient),
                    {$push: {"connnections": req.body.sender}},
                    {upsert: true}
                ).then(data => {
                    User.findByIdAndUpdate(
                        mongoose.Types.ObjectId(req.body.sender),
                        {$push: {"connnections": req.body.recipient}},
                        {upsert: true}
                    }).then(data => {
                         Notification.findByIdAndRemove(
                            mongoose.Types.ObjectId(req.body.twinID)
                        ).then(data => {
                            let confirmConnection = new Notification({
                                connectionRequest: {
                                    sender: mongoose.Types.ObjectId(req.body.recipient),
                                    recipient: mongoose.Types.ObjectId(req.body.sender),
                                    status: 'accepted',
                                }
                            })

                            confirmConnection.save();

                            (async ()=> {
                                await User.findByIdAndUpdate(
                                    mongoose.Types.ObjectId(req.body.sender),
                                    {$push: {"notifications": confirmConnection}},
                                    {upsert: true},
                                    function(err,success) {
                                        if(err) {
                                          console.log(err)
                                        } else {
                                          console.log("Connection made! Notification list's updated");
                                        }
                                    }
                                )
                            })();
                        })
                    })
            })

        } else if (req.body.status == 'ignored') {

            Notification.findByIdAndUpdate(
                mongoose.Types.ObjectId(req.body.notifID),
                {$set: {['status': 'ignored'}},
                {useFindandModify: false}
            ).then(data => {
                if (!data) {
                  res.status(404).send({message: "Error"});
                } else{
                  res.status(200).send({message: "Post Updated"})
                }
            })

        }

    } else if(type == 'tagAlert') {

    }
    /*
        09. 11. 2022
        Two kinds of notifications as of now:
        connection requests and tag alerts.
    */


})


module.exports = app;
