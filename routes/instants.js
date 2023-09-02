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
    /*let userID = parseInt(ws.upgradeReq.url.substring(1), 10);*/
    console.log(ws)

    // connections[userID] = ws;
    // console.log(userID);

      // 09. 01. 2023 @ 2245 Connection currently isn't being made??
      // ws.on('open', (userWS)=> { 

      //   console.log("a user has connected");

      //   let userID = parseInt(userWS.upgradeReq.url.substring(1), 10);
      //   connections[userID] = userWS;
      //   console.log(userID);

      // })

      // 09. 01. 2023 @ 2245 
      // message sent by frontend is recieved / acknowledged
    ws.on('message', (e)=> {
      console.log("a message recieved")
    })
})

module.exports = app;