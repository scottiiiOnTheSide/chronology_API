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

	const auth = req.header('auth-token');
  	const base64url = auth.split('.')[1];
  	const decoded = JSON.parse(Buffer.from(base64url, 'base64'));
  	const {_id, _username} = decoded;
  	const date = new Date();
  	const mm = date.getMonth() + 1;
  	const dd = date.getDate();
  	const yy = date.getFullYear();
  	const timeStamp = date.getTime();

  	let imagesArray = [];

	const processMedia = async () => {

		//loops through all files sent...
		for (let i = 0; i < req.files.length; i++) {
			// console.log(req.files[i].buffer);

			const fileNumber = req.files[i].fieldname;
			const fileName = `${fileNumber}_${_username}_${mm}-${dd}-${yy}_${timeStamp}`;
			const file = uploadMedia.file(fileName);
			const options = {
				resumable: false,
				metadata: {
					contentType: 'image/jpeg/png',
				}
			};

			await file.save(req.files[i].buffer, options);

			await uploadMedia.setMetadata({
			    enableRequesterPays: true,
				    website: {
				      mainPageSuffix: 'index.html',
				      notFoundPage: '404.html',
				    },
			});

		
			const [cdnUrl] = await file.getSignedUrl({
				action: 'read',
				expires: '01-01-2499',
			});

			let title = `image_${fileNumber}`;

			imagesArray.push({
				[title]: cdnUrl
			})

		}//end of loop

		req.body.media = imagesArray;

		//for testing
		console.log(req.body);
	}

	/* Runs media processing algo */
	getBuffer(req, res, processMedia);
};