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

app.post('/notif/:type', verify, async (req,res) => {

    let type = req.params.type;

    if(type == 'connection') {
        if(req.body.status == 'sent') {

                try{
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
                            sender: mongoose.Types.ObjectId(req.body.sender),
                            recipient: mongoose.Types.ObjectId(req.body.recipient),
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

            let notifID = mongoose.Types.ObjectId(req.body.notifID),
                sender = mongoose.Types.ObjectId(req.body.sender),
                recipient = mongoose.Types.ObjectId(req.body.recipient);

            (async() => {

                let one = await Notification.findByIdAndUpdate(
                    notifID, 
                    { $set: {["connectionRequest.status"]: "accepted"}},
                    {useFindandModify: false}
                ).then((data) => {
                    if(data) {
                        // res.send(data)
                        console.log("original notif to recipient updated");
                    }
                })

                let two = await User.findByIdAndUpdate(
                    sender,
                    {$push: {"connections": recipient}},
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
                    recipient,
                    {$push: {"connections": sender}},
                    {upsert: true}
                ).then((data) => {
                    if(data) {
                        // res.send(data)
                        console.log("sender added to recipient's connections");
                    }
                })

                let four = await Notification.findByIdAndRemove(
                    mongoose.Types.ObjectId(req.body.twinID),
                ).then((data) => {
                    if(data) {
                        // res.send(data)
                        console.log("original notif of sender's request, deleted");
                    } else {
                        console.log("nothing to delete?")
                    }
                })

                let five = new Notification({
                        connectionRequest: {
                            sender: mongoose.Types.ObjectId(req.body.recipient),
                            recipient: mongoose.Types.ObjectId(req.body.sender),
                            status: 'accepted',
                        }
                })

                await five.save();

                let six = await User.findByIdAndUpdate(
                    sender,
                    {$push: {"notifications": five}},
                    {upsert: true},
                ).then((data) => {
                    if(data) {
                        console.log("new notification added to sender's list")
                    }
                })

                res.status(200)
                console.log(`connection made between ${sender} & ${recipient} !`)
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

    } else if(type == 'tagAlert') {

    }
    /*
        09. 11. 2022
        Two kinds of notifications as of now:
        connection requests and tag alerts.
    */

})


module.exports = app;

