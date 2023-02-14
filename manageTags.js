const Tags = require('./models/tags'),
      mongoose = require('mongoose');

module.exports = async function (req,res,next) {
  
  let tagsExist = req.body.tags.split(" ");
  // JSON.stringify(tagsExist);
  console.log(tagsExist);
   
  let parse = (tagsname) => {
    return Tags.findOne({name: tagsname})
    .then((tag) => {
      let value = tag.name;
      //console.log("line 29 "+ tag);
      console.log("line 30 "+ tag._id +`\n`+ tag.name);
      return {
        name: tag.name,
        id: tag.id,
      };
    })
    .catch((err) => {
      let newTag = new Tags({
        name: `${tagsname}`,
        posts: [],
      });
      newTag.save();
      let value = newTag.name;
      console.log('line 39 '+ newTag._id );
      return {
        name: newTag.name,
        id: newTag._id
      };
    })
  }
  
  if(tagsExist) {
    tagsExist = await Promise.all(tagsExist.map(async(tag) => {
      return await parse(tag);
    }));
  } else if (!tagsExist) {
    console.log("There were no tags...?")
  }
  
  
  req.body.tags = tagsExist;
  //console.log("line 36 "+ tagsExist);
  next();
}