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
        
        const data = JSON.parse(e);
        console.log('instant.js line 23')
        console.log(data);
        const recipients = data.recipients;

        //loop through all online user
        Object.keys(connections).forEach(user =>{

            //loop through all recipients per online user
            for(let i = 0; i < recipients.length; i++) {

                if(user == recipients[i]) {

                    if(data.senderID == recipients[i]) {
                        return
                    }
                    else if(data.action == 'updateNotifs') {
                        console.log('recievied' +data);
                        let notif = data;
                        notif.type = 'updateNotifs';
                        connections[user].send(JSON.stringify(notif));
                    }
                    else if(data.type == 'request' && data.message == 'connectionRequestRecieved') {
                        let notif = JSON.stringify({
                            type: 'request',
                            senderID: data.senderID,
                            senderUsername: data.senderUsername,
                            recipient: data.recipients[0],
                            recipientUsername: data.recipientUsername,
                            message: 'connectionRequestRecieved',
                            originalID: data.originalID,
                        })
                        connections[user].send(notif)
                        console.log(notif);
                    }
                    else if (data.type == 'request' && data.message == 'connectionAcceptedRecieved') {
                        let notif = JSON.stringify({
                            type: 'request',
                            senderUsername: data.senderUsername,
                            message: 'connectionAcceptedRecieved',
                            senderID: data.senderID,
                            recipients: data.recipients,
                        })
                        connections[user].send(notif);
                        console.log(notif);
                    }
                    else if(data.type == 'request' && data.message == 'subscriptionRequestRecieved') {
                        let notif = JSON.stringify(data);
                            // type: 'request',
                            // senderID: userID,
                            // senderUsername: username,
                            // recipients: [recipientID],
                            // recipientUsername: userInfo.userName,
                            // message: 'subscriptionRequestRecieved'
                        connections[user].send(notif);
                    }
                    else if(data.type == 'request' && data.message == 'subscriptionAccepted') {
                        let notif = JSON.stringify({
                            type: 'request',
                            senderUsername: data.senderUsername,
                            message: 'subscriptionAccepted',
                            senderID: data.senderID,
                            recipients: data.recipients,
                        })
                        connections[user].send(notif);
                    }
                    else if(data.type == 'request' && data.message == 'subscribed') {
                        let notif = JSON.stringify({
                            type: 'request',
                            senderUsername: data.senderUsername,
                            message: 'subscribed',
                            senderID: data.senderID,
                            recipients: data.recipients,
                        })
                        connections[user].send(notif);
                    }
                    else if(data.type == 'comment' && data.message == 'initial') {
                        let notif = data;
                        notif.message = 'initial-recieved';
                        connections[user].send(JSON.stringify(notif));
                        console.log(notif);
                    }
                    else if(data.type == 'comment' && data.message == 'response') {
                        let notif = data;
                        notif.message = 'response-recieved';
                        connections[user].send(JSON.stringify(notif));
                        console.log(notif);
                    }
                    else if(data.type == 'tagging') {
                        let notif = data;
                        notif.message = 'recieved';
                        connections[user].send(JSON.stringify(notif));
                        console.log(data);
                    }
                }
            }

            //if no recipients are part of current online users,
            //console.log message stating such
        })
    })
})

module.exports = app;