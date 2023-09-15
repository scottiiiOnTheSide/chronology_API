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
})

// const CommentSchema = new mongoose.Schema({
// })

const PostsSchema = new mongoose.Schema({
  owner: {
      type: mongoose.Schema.Types.ObjectID,
      ref: 'User'
  }, 
  author: {
    type: String,
    required: true,
    index: true,
  },
  title: {
      type: String,
      required: true,
      index: true,
  },
  tags: [{
      type: String,
      ref: 'Tags'
  }],
  taggedUsers: [{
    type: String,
    ref: 'User',
  }],
  isPersonal: {
    type: Boolean,
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
}, {timestamps: true});


module.exports.Posts = mongoose.model('Posts', PostsSchema);
module.exports.Content = mongoose.model('Content', ContentSchema);