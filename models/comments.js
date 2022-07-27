const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  post: {
      type: mongoose.Schema.Types.ObjectID,
      ref: 'Posts'
  }, 
  replies: [{
    type: mongoose.Schema.Types.ObjectID,
    ref: 'Comments'
  }],
  content: {
    type: String,
    required: true
  }
  postedOn_month: Number,
  postedOn_day: Number,
  postedOn_year: Number
}, {timestamps: true});

module.exports = mongoose.model('Comments', CommentsSchema);