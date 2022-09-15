const express = require('express'),
      app = express(),
      mongoose = require('mongoose'),
      router = express.Router(),
      cors = require('cors'),
      {User, Notification} = require('./models/user');
     // require('dotenv').config(),
require('dotenv').config();

mongoose.connect(process.env.DB_LINK, {useNewUrlParser: true, useUnifiedTopology: true});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function () {
    console.log("Connected successfully");
});

app.use(router);
app.use(express.json());
app.use(cors({
  origin: '*'
}));

//Routes
const userRoutes = require('./routes/users');
app.use('/users', userRoutes);

const postRoutes = require('./routes/posts');
app.use('/posts', postRoutes);

app.listen(3333, '0.0.0.0', ()=> {
	console.log('API running . . . ');
});
