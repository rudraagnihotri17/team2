var User = require("../models/user");
var express = require("express");
var router  = express.Router();
var multer = require("multer");
var path = require("path");
var flash = require('connect-flash');
var crypto = require("crypto");
//ensure Authentication
var {ensureAuthenticated} = require('../middleware/auth');

router.use(flash());

// Profile picture upload

// Set Storage Engine
const storage = multer.diskStorage({
    destination: './public/profilepic/',
    filename: function(req, file, cb){
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Initialize Upload 
const upload = multer({
    storage: storage,
    limits: {fileSize : 10000000000}, //(in bytes)
    fileFilter: function(req, file, cb){
        checkFileType(file, cb);
    }
}).single('uploadImage');


// Check file type
function checkFileType(file, cb){
    // Allowed extensions
    const filetypes = /jpeg|jpg|png|gif/;
    // Check extension
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);

    if(mimetype && extname){
        return cb(null, true);
    } else {
        cb('Error: Images Only!');
    }
}
function dcryptUser(user){
    var id = user._id;
    var key = id.toString();
    var fdcipher = crypto.createDecipher('aes-256-cbc',key);
    var ldcipher = crypto.createDecipher('aes-256-cbc',key);
    var contactdcipher = crypto.createDecipher('aes-256-cbc',key);
    var genderdcipher = crypto.createDecipher('aes-256-cbc',key);
    var fnameDcrypted = fdcipher.update(user.fname,'hex','utf8');
    var lnameDcrypted = ldcipher.update(user.lname,'hex','utf8');
    if(user.contact != null){
        var contactDcrypted = contactdcipher.update(user.contact,'hex','utf8');
        var genderDcrypted = genderdcipher.update(user.gender,'hex','utf8');
        contactDcrypted += contactdcipher.final('utf8');
        genderDcrypted += genderdcipher.final('utf8');
        user.contact = contactDcrypted;
        user.gender = genderDcrypted;
        contactDcrypted = null;
        genderDcrypted = null;
    }
    fnameDcrypted += fdcipher.final('utf8');
    lnameDcrypted += ldcipher.final('utf8');      
    user.fname = fnameDcrypted;
    user.lname = lnameDcrypted;
    fnameDcrypted = null;
    lnameDcrypted = null;
    return user;
}


router.get("/:id", ensureAuthenticated, (req, res) => res.render("profile", { user: dcryptUser(req.user)}));


// PROFILE PICTURE ROUTE

router.post('/:id', ensureAuthenticated, (req, res) => {
    upload(req, res, (err) => {
        if(err) {
            // console.log('Failed to upload!');
            res.render('profile', { msg: 'Upload Failed !!', user: dcryptUser(req.user) });
        } else {
            if(req.file == undefined){
                res.render('profile', { msg: 'No image selected!', user: dcryptUser(req.user) });
            } else {
                User.findOneAndUpdate({ email: req.user.email}, { userImage: req.file.filename })
                    .then(user => {
                        if(user) {
                            res.render('profile', { 'success_msg': 'Profile picture updated! Refresh the page to see changes', user: dcryptUser(req.user), file: `profilepic/${req.file.filename}`});
                        }
                    })
                    .catch(err => {
                        console.log(err);
                        res.render('profile', { 'error_msg': 'Upload failed!', user: dcryptUser(req.user) });
                    });
            } 
        }
    });
});



// PROFILE EDIT ROUTE

router.get('/:id/edit', ensureAuthenticated, (req, res) => {
    res.render("editprofile", { user: dcryptUser(req.user) });
});

router.put('/:id', ensureAuthenticated, (req, res) => {
    var id = req.params.id;
    var key = id.toString();
    var fcipher = crypto.createCipher('aes-256-cbc',key);
    var lcipher = crypto.createCipher('aes-256-cbc',key);
    var concipher = crypto.createCipher('aes-256-cbc',key);
    var gencipher = crypto.createCipher('aes-256-cbc',key);
    var genCrypted = gencipher.update(req.body.gender,'utf8','hex');
    var fnameCrypted = fcipher.update(req.body.fname,'utf8','hex');
    var lnameCrypted = lcipher.update(req.body.lname,'utf8','hex');
    var contactCrypted = concipher.update(req.body.contact,'utf8','hex');
    fnameCrypted += fcipher.final('hex');
    lnameCrypted += lcipher.final('hex');
    contactCrypted += concipher.final('hex');
    genCrypted += gencipher.final('hex');
    const editedProfile = {fname: fnameCrypted, lname: lnameCrypted, contact: contactCrypted, gender: genCrypted };
    fnameCrypted = null;
    lnameCrypted = null;
    contactCrypted = null;
    genCrypted = null;    
    User.findByIdAndUpdate(req.params.id, editedProfile, (err, updatedUser) => {
        if(err){
            console.log(err);
            res.redirect('back');
        } else {
            req.flash('success_msg','Details updated!');
            res.redirect('/profile/' + req.params.id);
        }
    });
});


module.exports = router;