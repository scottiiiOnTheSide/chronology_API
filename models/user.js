const mongoose = require('mongoose'),
      uniqueValidator = require('mongoose-unique-validator'),
      encrypt = require('bcryptjs'), //replace with scrypt
    UserSchema = new mongoose.Schema({
    firstName: {
        type: String,
        uppercase: true,
        required: [true, "This field is necessary"], 
        match: [/^[a-zA-Z0-9]+$/, "Invalid entry"],
        index: true,
    },
    lastName: {
        type: String,
        uppercase: true,
        required: [true, "This field is necessary"], 
        match: [/^[a-zA-Z0-9]+$/, "Invalid entry"],
        index: true,
    },
    userName: {
        type: String,
        uppercase: true,
        unique: true,
        required: [true, "This field is necessary"], 
        match: [/^[a-zA-Z0-9]+$/, "Invalid entry"],
        index: true,
    },
    emailAddr: {
        type: String,
        uppercase: true,
        unique: true,
        required: [true, "This field is necessary"], 
        match: [/^[a-zA-Z0-9]+$/, "Invalid entry"],
        index: true,
    }
},{timestamps: true});

UserSchema.method('password', async (password) => {
    UserSchema[password].required = true;
    const salt = await encrypt.genSalt(20);
    const hash = await encrypt.hash(password, salt);
    return hash;
});
UserSchema.plugin(uniqueValidator, {message: 'This is already taken'});
module.exports = mongoose.model('User', UserSchema);
