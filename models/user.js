const mongoose = require('mongoose'),
      uniqueValidator = require('mongoose-unique-validator'),
      encrypt = require('bcryptjs'); //replace with scrypt
     
const NotificationSchema = new mongoose.Schema({
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
  senderUsername: {
    type: String,
    required: true,
  },
  recipients: [{
    type: String,
    required: true
  }],
  recipientUsername: {
    type: String,
    required: false,
  },
  url: {
    type: String,
    required: false
  },
  message: {
    type: String,
    required: false
  },
  details: {
    type: String,
    required: false
  }
});

// const GroupSchema = new mongoose.Schema ({});

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
    settings: {
      data: mongoose.Schema.Types.Mixed,
    },
    connections: [{
        type: mongoose.Schema.Types.ObjectID,
        ref: 'Users',
    }],
    notifications: [{
      type: [NotificationSchema]
    }]
},{timestamps: true});

/**
 * 10. 13. 2023
 * access user setting with: User.settings.data
 * data: {
  * settingName: settingValue
 * }
 */

UserSchema.plugin(uniqueValidator, {message: 'This is already taken'});
module.exports.User = mongoose.model('User', UserSchema);
module.exports.Notification = mongoose.model('Notification', NotificationSchema);

