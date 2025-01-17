const express = require('express'),
      app = express(),
      bodyParser = require('body-parser'),
      mongoose = require('mongoose'),
      router = express.Router(),
      cors = require('cors'),
      {User, Notification} = require('./models/user'),
      {Posts} = require('./models/posts');
require('dotenv').config();
const expressWS = require('express-ws')(app);

mongoose.connect(process.env.DB_LINK, {useNewUrlParser: true, useUnifiedTopology: true});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function () {
    console.log("Connected successfully");
});

app.use(router);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true})) //necessary?
app.use(cors({
  origin: '*'
}));

//Routes
const userRoutes = require('./routes/users');
app.use('/users', userRoutes);

const postRoutes = require('./routes/posts');
app.use('/posts', postRoutes);

const groupRoutes = require('./routes/groups');
app.use('/groups', groupRoutes);

const instantRoutes = require('./routes/instants');
app.use('/', instantRoutes);


app.use('/publicStats', async(req, res)=> {
    //return amount of users, total posts 
    let userCount = await User.countDocuments();
    let postCount = await Posts.countDocuments();

    res.status(200).send({
        userCount: userCount,
        postCount: postCount
    })
})


app.listen(3333, '0.0.0.0', ()=> {
	console.log('API running . . . ');
});

//this works as intended
// GCS.getBuckets().then(data => console.log(data));
