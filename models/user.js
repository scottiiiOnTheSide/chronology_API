const mongoose = require('mongoose'),
      uniqueValidator = require('mongoose-unique-validator'),
      encrypt = require('bcryptjs'); //replace with scrypt
     
const NotificationSchema = new mongoose.Schema({
  // connectionRequest: {
  //   type: Map,
  //   of: String
  // },
  // tagAlert: {
  //   type: Map,
  //   of: String
  // }
  type: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    required: true
  },
  sender: {
    type: String,
    required: true
  },
  recipients: [{
    type: String,
    required: true
  }],
  url: {
    type: String,
    required: false
  },
  message: {
    type: String,
    required: false
  }
});

const UserSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, "This field is necessary"], 
        match: [/^[a-zA-Z0-9]+$/, "Invalid entry"],
        index: true,
    },
    lastName: {
        type: String,
        required: [true, "This field is necessary"], 
        match: [/^[a-zA-Z0-9]+$/, "Invalid entry"],
        index: true,
    },
    userName: {
        type: String,
        unique: true,
        required: [true, "This field is necessary"], 
        match: [/^[a-zA-Z0-9]+$/, "Invalid entry"],
        index: true,
    },
    emailAddr: {
        type: String,
        unique: true,
        required: [true, "This field is necessary"], 
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Invalid entry"],
        index: true,
    },
    password: {
      type: String,
      required: [true, "This field is necessary "]
    },
    connections: [{
        type: mongoose.Schema.Types.ObjectID,
        ref: 'Users',
    }],
    notifications: [{
      type: [NotificationSchema]
    }]
},{timestamps: true});

/*
let newConnectionRequest = new Notification ({
  connectionRequest: {
    sender: senderID,
    reciepient: reciepientID,
    status:
  }
})

status: sent, ignored, accepted
*/

/*UserSchema.method('password', async (password) => {
    UserSchema[password].required = true;
    const salt = await encrypt.genSalt(20);
    const hash = await encrypt.hash(password, salt);
    return hash;
}); */
UserSchema.plugin(uniqueValidator, {message: 'This is already taken'});
module.exports.User = mongoose.model('User', UserSchema);
module.exports.Notification = mongoose.model('Notification', NotificationSchema);

