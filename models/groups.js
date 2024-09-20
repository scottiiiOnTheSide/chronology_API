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
  admins: [{
    type: mongoose.Schema.Types.ObjectID,
    ref: 'User'
  }],
  adminUsernames: [{
    type: String
  }], 
  hasAccess: [{
    type: mongoose.Schema.Types.ObjectID,
    ref: 'User'
  }],
  posts: [{
    type: mongoose.Schema.Types.ObjectID,
    ref: 'Posts'
  }],
  details: {
    description: String
  },
  isPrivate: Boolean,
})
GroupsSchema.add({ tags: [GroupsSchema] });

module.exports.Groups = mongoose.model('Groups', GroupsSchema);
module.exports.GroupsSchema = GroupsSchema;
/**
 *  09. 07. 2024
 * 
 *  For private tags, posts within them can be seen without access,
 *  but following them requires access (?)
 * 
 *   
 */




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
