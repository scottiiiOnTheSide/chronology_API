const express = require('express'),
      app = express.Router(),
      mongoose = require('mongoose'),
      User = require('../models/user'),
      {User, Notification} = require('../models/user'),
      encrypt = require('bcryptjs'),
      JWT = require('jsonwebtoken');
require('dotenv').config();

let notif = new Notification ({
  connectionRequest: {
    sender: "convert user object id to string"
    recipient: "another user id"
    status: "sent"
  }
})

async notif.save().then(savedDoc => {
  if(savedDoc) {
    console.log("it save");
  }else {
    console.log("it no save");
  } // true
})