const express = require('express'),
      app = express(),
      mongoose = require('mongoose'),
      User = require('../models/user');

//Simple 'create new  users' function
app.post('/newuser', async (request, response) => {
    const user = new User(request.body)

    try {
      await user.save();
      response.send(user)
    }
    catch (error) {
      response.status(500).send(error);
    }
});

//Simple return all users function
app.get('/users', async (request, response) => {
    const users = await User.find({});

    try {
      response.send(users)
    }
    catch {
      response.status(500).send(error);
    }
});


module.exports = app;
