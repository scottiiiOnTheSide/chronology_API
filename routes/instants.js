/*
      Route Dedicated to Events utilizing Web Sockets
      for instant updates on front & back end
*/

const express = require('express'),
      app = express.Router();
const expressWS = require('express-ws')(app);

let connections = {}

app.ws('/', (ws, req)=> {

    console.log('a user has connected');
    let userID = req.url;
    userID = userID.substring(12)
    connections[userID] = ws;
    console.log(userID);

    ws.on('message', (e)=> {
        console.log('message recieved')
      console.log(e);
    })
})

module.exports = app;