const express = require('express'),
      app = express.Router(),
      mongoose = require('mongoose'),
      User = require('../models/user'),
      encrypt = require('bcryptjs'),
      JWT = require('jsonwebtoken');
require('dotenv').config();

//Simple 'create new  users' function
app.post('/newuser', async (req,res) => {

    const emailExist = await User.findOne({emailAddr:req.body.emailAddr})
    if(emailExist) {
        return res.status(400).send("This email is already linked to an account")
    }

    const user = new User({
        firstName: res.body.firstName,
        lastName: res.body.lastName,
        emailAddr: res.body.emailAddr,
        userName: res.body.userName,
        password: res.body.password
    });

    try {
      const savedUser = await user.save();
      res.send(savedUser)
    }
    catch (error) {
      response.status(500).send(error);
    }
});

//Simple return all users function
app.get('/login', async (req, res) => {
    const emailExist = await User.findOne({emailAddr:req.body.emailAddr});
    if(!emailExist) {
        return res.status(400).send("This email is not valid");
    }

    const passwordValid = await encrypt.compare(req.body.password, user.password);
    //decrpyt password
    if(!passwordValid) {
        return res.status(400).send("This password is invalid");
    }

    const user = [emailExist];
    const userName = user.userName;
    const token = JWT.sign(
      {
        _id: user._id, 
        _username: userName
      }, process.env.TOKEN_SECRET);

    //sets JWT within reponse header and returns 
    //it to the front end
    res.header('auth-token', token).send();
    //this info needs to be within user request headers whenever performing account operations. 
});


module.exports = app;
