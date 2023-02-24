/*
	02. 21. 2023
	Purpose of middleware is to intercept images during post upload,
	upload them to GCS and return the provided media links, which
	will replace the original images within the req.body 
*/

const path = require('path'),
	  util = require('util')
	  multer = require('multer'),
	  storage = multer.memoryStorage(),
      upload = multer({ storage: storage }),
	  {Storage} = require('@google-cloud/storage');

/* the object values need to be put into a ENV file for security */
const GCS = new Storage({
		keyFilename: path.join(__dirname, 'logSeqMediaGCSaccess.json'),
		projectId: "aerobic-name-372620"
	}),
	uploadMedia = GCS.bucket('logseqmedia');

// let uploadImages = multer({
// 		storage: multer.MemoryStorage,
// 	}).array("multi-files", 10);
	
// uploadImages = util.promisify(uploadImages);

module.exports = GCS;