const mongoose = require('mongoose');

const Post = new mongoose.Schema({
  owner: {
      type: Schema.Types.ObjectID,
      ref: 'User'
  }
  author: {
    type: String,
    required: true,
    index: true,
  }
  title: {
      type: String,
      required: true,
      index: true,
  },
  content: {
      type: String,
      required: true,
      index: true, 
  },
  tags: [{
      type: Schema.Types.ObjectID,
      ref: 'Tags'
  }]
  isPersonal: boolean,
  setEvent_Year: String,
  setEvent_Month: String,
  setEvent_Day: String,
}, {timestamps: true});


module.exports = mongoose.model('Posts', PostsSchema);