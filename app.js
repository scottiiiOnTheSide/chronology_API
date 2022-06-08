const express = require('express');
const app = express();
const mongoose = require('mongoose');

app.listen(3333, '0.0.0.0', ()=> {
	console.log('API running . . . ');
});
