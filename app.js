const express = require('express'),
      app = express(),
      mongoose = require('mongoose'),
      router = express.Router(),
      db_link = "mongodb+srv://admin:codeforcandy@cluster0.j9uhp.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(db_link, {useNewUrlParser: true, useUnifiedTopology: true});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function () {
    console.log("Connected successfully");
});

app.use(router);

//Routes
const userRoutes = require('./routes/users');
app.use('/users', userRoutes);


app.listen(3333, '0.0.0.0', ()=> {
	console.log('API running . . . ');
});
