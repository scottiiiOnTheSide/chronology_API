app.post('/notif/:type', verify, async(req, res)=> {

    /* 09. 05. 2023
        New Notification Model & request object model

        type: string | "request", "commentInitial", "commentResponse", "tagging"
        isRead: boolean
        sender: string | userID
        recipients: string | userID(s)
        url: string | url for post OR original notif ID
        message: string | *sent, *accept, *ignore


        type:request - connection requests
    */

    const auth = req.header('auth-token');
    const base64url = auth.split('.')[1];
    const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
    const {_id, _username} = decoded;
    /* Get ID for removing connection, update notification */
    const accessID = req.query.ID,
          isRead = req.query.isRead



    /* update original notif to be isRead = true */
    if(isRead == true) {}

    if(type == 'sendAll') {
      let user = await User.findById(_id).then((user) => {
        if(user) {
          return user
        }
        else {
          console.log("issue finding user. might not exist");
        }
      })
      
      let notifs = user.notifications;
      console.log(`sending ${user.userName} notifs`)
      res.status(200).send(notifs);
    }  

    /* if connection request */
    if(type == 'request') {
        /* sender IS always be sender of request,
            recipient is who recieved initial request
        */
        let sender = await User.findById(mongoose.Types.ObjectId(req.body.sender)).then((err, user) => {
            if (user) {
              let result = {
                username: user.userName,
                id: user._id
              }
              return result;
            } else {
              console.log(err)
            }
        })
        let recipient = await User.findById(mongoose.Types.ObjectId(req.body.recipients[0])).then((err, user) => {
            if (user) {
              let result = {
                username: user.userName,
                id: user._id
              }
              return result;
            } else {
              console.log(err)
            }
        })


        /* initial request */
        if(req.body.message == "sent") {

            try {

                let requestOne = new Notification({
                    type: req.body.type,
                    isRead: true,
                    sender: req.body.sender,
                    recipients: req.body.recipients[0],
                    message: 'sent'
                })

                let requestTwo = new Notification({
                    type: req.body.type,
                    isRead: false,
                    sender: req.body.sender,
                    recipients: req.body.recipients[0],
                    message: 'sent'
                })


                (async ()=> {
                    let updateSenderList = await User.findByIdAndUpdate(
                        mongoose.Types.ObjectId(req.body.sender),
                        {$push: {"notifications": request}},
                        [{upsert: true}, {useFindandModify: false}],
                    ).then((res) => {
                        if(res) {
                            console.log("notification of connection request added to sender's list")
                        }
                    })

                    let updateRecipientList = await User.findByIdAndUpdate(
                        mongoose.Types.ObjectId(req.body.recipients[0]),
                        {$push: {"notifications": requestTwo}},
                        [{upsert: true}, {useFindandModify: false}],
                    ).then((res) => {
                        if(res) {
                            console.log("notification of connection request added to sender's list")
                        }
                    })
                })();

                // request.save()
                res.status(200).send(true)
            }
            catch {
                res.status(404).send({message: "something went wrong"});
            }
        }

         /* if accepted */
        else if(req.body.message == 'accept') {


            let addSenderToReciever = await User.findByIdAndUpdate(sender._id,
                {$push: {"connections": recipient._id}},
                {upsert: true}
            ).then((data)=> {
                if(data) {
                    console.log("recipient added to sender's list of connections")
                }
            })

            let addRecieverToSender = await User.findByIdAndUpdate(recipient._id,
                {$push: {"connections": sender._id}},
                {upsert: true}
            ).then((data)=> {
                if(data) {
                    console.log("sender added to recipient's list of connections")
                }else {
                    console.log("error in adding sender to recipient's list")
                }
            })

            /* make new notif confirming connection between users, save them to
                each other's notif lists */
            let accepted = new Notification({
                    type: req.body.type,
                    isRead: false,
                    sender: req.body.sender,
                    recipients: req.body.recipients[0],
                    message: 'accept'
                })

            (async ()=> {
                    let updateSenderList = await User.findByIdAndUpdate(
                        mongoose.Types.ObjectId(sender._id),
                        {$push: {"notifications": accepted}},
                        [{upsert: true}, {useFindandModify: false}],
                    ).then((res) => {
                        if(res) {
                            console.log(`notif of acceptance added to ${sender.userName}'s list`)
                        }else {
                            console.log("error in adding notif to sender's list")
                        }
                    })

                    let updateRecipientList = await User.findByIdAndUpdate(
                        mongoose.Types.ObjectId(recipients[0].userName),
                        {$push: {"notifications": accepted}},
                        [{upsert: true}, {useFindandModify: false}],
                    ).then((res) => {
                        if(res) {
                            console.log(`notif of acceptance added to ${recipient[0].userName}'s list`)
                        }else {
                            console.log("error in adding notif to recipient's list")
                        }
                    })
            })();

            // accepted.save()
            console.log( `${sender.userName} is now connected with ${recipient.userName}` );
            res.status(200).send( {message: `${sender.userName} is now connected with ${recipient.userName}`} );
        }

        /* if ignored */
        else if(req.body.message == 'ignore') {

            /* if request is ignored, req.body should include the ._id of the
                connectRequest notif, so that it can be modified

                sender in req.body NEEDS to be sender of request
                recipient is ID of user ignoring the request
            */
            let originalRequest = 
            Notification.findByIdAndUpdate(mongoose.Types.ObjectId(req.body.message), 
                {message: 'ignore'; isRead: true},
                (err, doc)=> {
                    if(err) {
                        console.log(err)
                        console.log('unable to find original notification to modify');
                    }
                    else {
                        console.log('connection request ignored')
                    }
                })

            let sendersRequest = Notification.findOneAndUpdate(
                {sender: sender._id, recipient: recipient._id, message: 'request'},
                {$set: {message: ignored}}, (err, doc)=> {
                    if(doc) {
                        console.log(`${sender.userName}'s original request to ${recipient.userName} has been ignored`);
                    }
                    else{
                        console.log(`error in finding original sender's request`)
                    }
                });

            res.status(200).send({message:`${sender.userName}'s original request to ${recipient.userName} has been ignored`})         
        }
    }
       
    /* notif of being tagged in post or comment */
    if(type == 'commentInitial') {}

    /* notif of comment on post, reshare, flagging, etc */
    if(type == 'commentResponse') {}

    /* notif of user being tagged in a post or comment(?) */
    if(type == 'tagging') {}
})

/* algo for getting older notifs:
    after initial pull, frontEnd sends back amount of notifs
    it currently has. 
    Subtract TOTAL notifs with CURRENTamount on front end,
    have i = difference in loop, so that it gets notifs 
    starting with one after the last sent
*/
     

