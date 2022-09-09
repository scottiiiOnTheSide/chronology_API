const mongoose = require('mongoose');

const TagsSchema = new mongoose.Schema({
  name: {
      type: String,
      required: true,
  },
  //can we directly access User's connections array?
  haveAccess: [{
      type: mongoose.Schema.Types.ObjectID,
      ref: 'User'
  }],
  posts: [{
      type: mongoose.Schema.Types.ObjectID,
      ref: 'Posts'
  }],
  isPersonal: Boolean
});

module.exports = mongoose.model('Tags', TagsSchema);