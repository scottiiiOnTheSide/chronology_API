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

const getBuffer = upload.any();

module.exports = async function(req, res, next) {

	const processMedia = async () => {
		console.log(req.files[0].buffer);

		// will devise more sophisticated naming convention later
		const fileName = 'image2.jpg';
		const file = uploadMedia.file(fileName);
		const options = {
			resumable: false,
			metadata: {
				contentType: 'image/jpeg/png',
			}
		};
		await file.save(req.files[0].buffer, options);

		await uploadMedia.setMetadata({
		    enableRequesterPays: true,
		    website: {
		      mainPageSuffix: 'index.html',
		      notFoundPage: '404.html',
		    },
		});

		let cdnUrl;
		file.makePublic(async (err, response) => {
			cdnUrl = await file.getSignedUrl({
				action: 'read',
				expires: '01-01-2499',
			})

			console.log(cdnUrl);
		})
	}

	getBuffer(req, res, processMedia);
};