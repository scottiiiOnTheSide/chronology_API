const jwt = require('jsonwebtoken');

module.exports = function (req,res,next) {
    const token = req.header('auth-token');
    if(!token) {
      return res.status(401).send("You currently don't have access");
    }

    try {
        const verified = jwt.verify(token, process.env.TOKEN_SECRET);
        req.user = verified;
        next();
    }
    catch {
        res.status(400).send("Access Denied");
    }
}

//const verify = require('verifyUser');
//app.use('/makePost', verify, (req,res) => {})
