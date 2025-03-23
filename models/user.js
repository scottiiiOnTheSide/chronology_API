const mongoose = require('mongoose'),
      uniqueValidator = require('mongoose-unique-validator'),
      encrypt = require('bcryptjs'); //replace with scrypt
     
const NotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: false
  },
  isRead: {
    type: Boolean,
    required: false
  },
  sender: {
    type: String,
    required: false
  },
  senderUsername: {
    type: String,
    required: false,
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectID,
    required: true
  }],
  recipientUsernames: [{
    type: String,
    required: false,
  }],
  url: {
    type: String,
    required: false
  },
  message: {
    type: String,
    required: false
  },
  details: { 
    postTitle: String,
    postID: mongoose.Schema.Types.ObjectID,
    postOwner: mongoose.Schema.Types.ObjectID,
    ownerUsername: String,
    groupName: String,
    groupID: mongoose.Schema.Types.ObjectID,
    info: String,
    commentID: mongoose.Schema.Types.ObjectID
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
    isAvailable: Boolean,
    profilePhoto: String,
    bio: String,
    pinnedPosts: [String],
    pinnedMedia: [mongoose.Schema.Types.Mixed],
    settings: {
      referralCode: String,
      topics: [String],
      preferredLocation: {
        lonLat: [Number],
        city: String //
      }
    },
    notifications: [{
      type: [NotificationSchema]
    }],
    connections: [{
        type: mongoose.Schema.Types.ObjectID,
        ref: 'Users',
    }],
    subscribers: [{
        type: mongoose.Schema.Types.ObjectID,
        ref: 'Users',
    }],
    subscriptions: [{
        type: mongoose.Schema.Types.ObjectID,
        ref: 'Users',
    }],
    customLogs: {
        currentLog: Boolean, //0 is userOnly
        log: [{
          title: String,
          connections: [{
              type: mongoose.Schema.Types.ObjectID,
              ref: 'Users',
          }],
          subscriptions: [{
              type: mongoose.Schema.Types.ObjectID,
              ref: 'Users',
          }],
          groups: [{
              type: mongoose.Schema.Types.ObjectID,
              ref: 'Groups',
          }],
          topics: [String],
          tags: [{
              type: mongoose.Schema.Types.ObjectID,
              ref: 'Groups',
          }],
          locations: [String]
        }]
    },
    interactionCount: Number,
    privacySetting: String,
    invites: [{
        type: mongoose.Schema.Types.ObjectID,
        ref: 'Users',
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

