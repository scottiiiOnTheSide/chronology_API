const mongoose = require('mongoose');

const TagsSchema = new mongoose.Schema({
   name: {
      type: String,
      required: true,
  },
  //can we directly access User's connections array?
  haveAccess: [{
      type: Schema.Types.ObjectID,
      ref: 'User'
  }],
  posts: [{
      type: Schema.Types.ObjectID,
      ref: 'Posts'
  }],
  private: boolean,
});

module.exports = mongoose.model('Tags', TagsSchema);