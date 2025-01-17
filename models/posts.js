const { GroupsSchema } = require('./groups.js')

const mongoose = require('mongoose');

let ContentSchema = new mongoose.Schema({
  place: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true
  }
});

const CommentSchema = new mongoose.Schema({
  ownerUsername: {
    type: String,
    required: true
  },
  ownerID: {
    type: String,
    required: true
  },
  profilePhoto: {
    type: String
  },
  parentPost: {
    type: String,
  },
  parentComment: {
      type: mongoose.Schema.Types.ObjectID,
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectID,
    ref: 'Comment'
  }],
  content: {
    type: String,
    required: true
  },
  topLevel: Boolean,
  postedOn_month: Number,
  postedOn_day: Number,
  postedOn_year: Number
}, {timestamps: true});

// CommentSchema.add({ replies: [CommentSchema]});

const PostsSchema = new mongoose.Schema({
  type: {
    type: String //draft, event, entry, rePost or quote
  },
  originalPost: {
    type: mongoose.Schema.Types.ObjectID,  // Reference to the original post
    ref: 'Posts',
    default: null  // Only filled when it's a repost
  },
  owner: {
      type: mongoose.Schema.Types.ObjectID,
      ref: 'User',
      required: true
  }, 
  author: { //owner username (T-T )
    type: String,
    required: true,
    index: true,
  },
  profilePhoto: {
    type: String
  },
  title: {
      type: String,
      index: true,
  },
  taggedUsers: [{
    _id: { 
      type: mongoose.Schema.Types.ObjectID,
      ref: 'User'
    },
    username: String
  }],
  isPrivate: {
    type: Boolean,
  },
  /*
      allows post to be restricted based on user's privacy setting
      not the same as isPrivate - which is ALWAYS private
      "On" means anyone
      "half" is only for subscribers
  */
  privacyToggleable: { 
    type: String
  },
  setEvent_Year: {
    type: Number,
  },
  setEvent_Month: {
    type: Number,
  },
  setEvent_Date: {
    type: Number,
  },
  usePostedByDate: {
    type: Boolean,
  },
  postedOn_month: {
    type: Number,
  },
  postedOn_day: {
    type: Number,
  },
  postedOn_year: {
    type: Number,
  },
  content: [ContentSchema],
  comments: [CommentSchema],
  commentCount: {
    type: Number
  },
  isPinned: {
    type: Boolean
  },
  tags: [{
    name: String,
    _id: mongoose.Schema.Types.ObjectID
  }],
  location: {
    lon: String,
    lat: String, //longitude, latitude - convert on frontEnd
    city: String,
    state: String
  },
}, {timestamps: true});



module.exports.Posts = mongoose.model('Posts', PostsSchema);
module.exports.Content = mongoose.model('Content', ContentSchema);
module.exports.Comment = mongoose.model('Comment', CommentSchema);