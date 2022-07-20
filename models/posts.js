const mongoose = require('mongoose');

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
  content: {
      type: String,
      required: false,
      index: true, 
  },
  tags: [{
      type: String,
      ref: 'Tags'
  }],
  isPersonal: Boolean,
  setEvent_Year: String,
  setEvent_Month: String,
  setEvent_Date: String,
  usePostedByDate: Boolean,
  postedOn_month: Number,
  postedOn_day: Number,
  postedOn_year: Number
}, {timestamps: true});


module.exports = mongoose.model('Posts', PostsSchema);