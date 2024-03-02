const mongoose = require('mongoose');

const GroupsSchema = new mongoose.Schema({
  type: {
    type: String, //'tag', 'collection', 'group'
    required: true
  },
  name: {
    type: String,
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectID,
    ref: 'User'
  },
  ownerUsername: { //is only for macros (tags, collections)
    type: String
  }, 
  admins: [{
    type: mongoose.Schema.Types.ObjectID,
    ref: 'User'
  }],
  hasAccess: [{
    type: mongoose.Schema.Types.ObjectID,
    ref: 'User'
  }],
  posts: [{
    type: mongoose.Schema.Types.ObjectID,
    ref: 'Posts'
  }],
  details: {    //to be JSON. For groups and collections, includes info
                //can also include tags or topics for groups
    type: String
  },
  isPrivate: Boolean,
})
GroupsSchema.add({ tags: [GroupsSchema] });

module.exports.Groups = mongoose.model('Groups', GroupsSchema);
module.exports.GroupsSchema = GroupsSchema;
/**
 * This schema is to used for 
 * TAGS , 
 * USER GROUPS , 
 * COLLECTIONS
 * 
 * ! if doc ONLY has OWNER ---> it is a COLLECTION
 *   - can be private or not. 
 *   - nonPrivate can be added 
 *   - private requires invitation
 * 
 * ! if doc has OWNER & ADMIN ---> it is a GROUP
 *   - group can have single owner and single admin as same user
 * 
 * ! if doc has NO OWNER & NOT PRIVATE ---> it is a (PUBLIC) TAG
 *   - if user attempts to create new public tag that already exists,
 *     they add prexisting public tag to their list
 *   - accessing said list shows ALL posts associated - user's own is 
 *     on left, everyone else's on right
 * 
 * ! if doc has OWNER & IS PRIVATE ---> it is a (PRIVATE) TAG
 *   - exists so users can organize posts without shared access.
 *   - posts with private tags don't appear publicly. Can only be 
 *     accessed with a link
 * 
 * ?? on post upload, check whether any tag used is private. 
 *    if so, make post private
 * 
 */
