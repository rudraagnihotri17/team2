var express = require("express");
var router  = express.Router();
var bcrypt = require('bcryptjs');
var flash = require('connect-flash');
var async = require("async");
var shortid = require('shortid');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');
var nodemailer = require("nodemailer");
var crypto = require("crypto");
var multer = require("multer");
var path = require("path");
router.use(flash());
const http = require('http');
const server = http.createServer(router);
//Global vars for flash
router.use((req,res,next)=>{
   res.locals.currentUser = req.user;
   res.locals.success = req.flash('success');
   res.locals.error = req.flash('error');
   res.locals.success_msg = req.flash('success_msg');
   res.locals.error_msg = req.flash('error_msg');
   next();
});



//ensure Authentication
var {ensureAuthenticated} = require('../middleware/auth');

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


// Assignment picture upload

// Set Storage Engine
const storage = multer.diskStorage({
    destination: './public/assignment/',
    filename: function(req, file, cb){
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Initialize Upload 
const upload = multer({
    storage: storage,
    limits: {fileSize : 100000000000000}, //(in bytes)
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




// Solution upload

// Set Storage Engine
const solutionStorage = multer.diskStorage({
    destination: './public/solution/',
    filename: function(req, file, cb){
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Initialize Upload 
const solutionUpload = multer({
    storage: solutionStorage,
    limits: {fileSize : 100000000000}, //(in bytes)
    fileFilter: function(req, file, cb){
        checkSolutionFileType(file, cb);
    }
}).single('uploadFile');


// Check file type
function checkSolutionFileType(file, cb){
    // Allowed extensions
    const filetypes = /doc|docx|pdf/;
    // Check extension
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);

    if(mimetype && extname){
        return cb(null, true);
    } else {
        cb('Error: Doc / PDF Only!');
    }
}


// Adding database models
var User = require("../models/user");
var classroom = require("../models/classroom");
var ClassroomUser = require("../models/classroomuser");
var Assignment = require("../models/assignment");
// classroom Form Home Page
router.get("/",ensureAuthenticated, function(req, res){
    var user = dcryptUser(req.user); 
   var name = user.fname+' '+user.lname;
   res.render("classroom/classroomforms", {name:name, user: user});
});



// classroom Create Form Submission
router.post("/createclassroom",ensureAuthenticated, function(req, res){
   let errors = [];
   var classroomName = req.body.classroomPurpose.trim();
   var classroomCode = req.body.classroomCode.trim();
   var code = classroomCode;
   var host = {
       id: req.user._id,
       email: req.user.email
   };
   if(!classroomCode || !classroomName){
       errors.push({ msg: 'Please enter all the required fields!!'});
   }
   if (classroomCode.length < 8) {
       errors.push({ msg: 'classroom Code must be at least 8 characters'});
   }  
   if (errors.length > 0) {
        var user = dcryptUser(req.user); 
        var name = user.fname+' '+user.lname;
       res.render('classroom/classroomforms', {
           errors,name:name, user: user
       });
   } else {
       var classroomId = shortid.generate(12);
       var newclassroom = new classroom({
           classroomName:classroomName,
           classroomId:classroomId,
           classroomCode:classroomCode,
           host:host
       });
       bcrypt.genSalt(10,(err,salt)=>bcrypt.hash(newclassroom.classroomCode,salt,(err,hash)=>{
           if(err) throw err;
           newclassroom.classroomCode = hash;
            newclassroom.save()
                .then(classroom => {
                    async.waterfall([
                        function(done) {
                          crypto.randomBytes(20, function(err, buf) {
                            var token = buf.toString('hex');
                            done(err, token);
                          });
                        },
                        function(token,  done) {
                          var smtpTransport = nodemailer.createTransport({
                            service: 'Gmail', 
                            auth: {
                              user: process.env.GMAILACC,
                               pass: process.env.GMAILPW
                            }
                          });
                          var mailOptions = {
                            to: req.user.email,
                            from: process.env.GMAILACC,
                            subject: 'Redpositive classroom Details',
                            text: 'You are receiving this because you have requested to host a classroom.\n\n' +
                                  'Please share the following details to those whom you want to invite to your classroom.\n\n' +
                                  'classroom Name - ' + classroomName + '\n' + 'classroom Id - ' + classroomId + '\n' + 'classroom Code - ' + code + '\n\n' 
                          };
                          smtpTransport.sendMail(mailOptions, function(err) {
                            req.flash('success_msg', 'An e-mail has been sent to ' + req.user.email + ' with classroom details.');
                            done(err, 'done');
                          });
                        }
                      ], function(err) {
                        if (err) console.log(err);
                          req.flash('success_msg','Your Session details for classroom has been sent to your mail !');
                          res.redirect("/classroom");
                      });  
                })
                .catch(err=>console.log(err));
        }));
    }
});
 
// classroom Join Form Submission
router.post("/joinclassroom",ensureAuthenticated, function(req, res){
    let errors = [];
    classroom.findOne({classroomId:req.body.classroomId})
    .then(classroom => {
        if(!classroom){
            errors.push({ msg: 'There is no such classroom'});
            var user = dcryptUser(req.user); 
            var name = user.fname+' '+user.lname;
            return res.render('classroom/classroomforms', {
                errors,name:name, user: user
            });
        }
        var id = req.body.classroomId;
        // Match Password
        bcrypt.compare(req.body.classroomCode,classroom.classroomCode,(err,isMatch)=>{
            if(err) throw err;
            if(isMatch){
                var isAdmin = false;
                if(req.user.email == classroom.host.email){
                    isAdmin = true;
                } 
                var classroomUser = new ClassroomUser({
                    classroomId : classroom._id,
                    userId : req.user._id,
                    isAdmin : isAdmin
                });
                classroomUser.save();
                classroom.classroomUsers.push(req.user._id);
                classroom.save();
                res.redirect("/classroom/joinclassroom/" + id);
            } else {
                req.flash('error_msg','The classroom code is incorrect!');
                var user = dcryptUser(req.user); 
                var name = user.fname+' '+user.lname;
                res.render("classroom/classroomforms",{name:name, user: user});
            }
        });
    })
    .catch(err => console.log(err));
});





router.get("/joinclassroom/:id",ensureAuthenticated, (req, res) => {
    classroom = classroom.findOne({classroomId:req.params.id})
    res.render('classroom/classroomroom', {user: dcryptUser(req.user), vcroomId: req.params.id,room:classroom._id});
})
// ASSIGNMENT PICTURE ROUTE

router.post('/uploadassignment', ensureAuthenticated, (req, res) => {
    upload(req, res, (err) => {
        if(err) {
            //console.log('Failed to upload!');
            res.render('classroom/examroom', { msg: 'Upload Failed !!', user: dcryptUser(req.user),isAdmin:true});
        } else {
            if(req.file == undefined){
                res.render('classroom/examroom', { msg: 'No image selected!', user: dcryptUser(req.user) ,isAdmin:true});
            } else {
                var classroom = ClassroomUser.findOne({userId: req.user._id});
                var newAssignment = new Assignment({
                    class : classroom.classroomId,
                    assignment: req.file.filename
                });
 
                newAssignment.save()
                    .then(saved => {
                        if(saved) {
                            var isAdmin = false;
                            ClassroomUser.findOne({userId : req.user._id}).then(classroomUser =>{
                              if(classroomUser){
                                isAdmin = classroomUser.isAdmin;
                                res.render('classroom/examroom', { 'success_msg': 'Assignment uploaded!', user: dcryptUser(req.user),isAdmin :isAdmin, file: `assignment/${req.file.filename}`});
                              }
                           });
                            
                        }
                    })
                    .catch(err => {
                        console.log(err);
                        res.render('classroom/examroom', { 'error_msg': 'Upload failed!', user: dcryptUser(req.user) ,isAdmin: true });
                    });
            }
        }
    });
 });

 
// ASSIGNMENT SOLUTION ROUTE

router.post('/uploadsolution', ensureAuthenticated, (req, res) => {
    solutionUpload(req, res, (err) => {
        if(err) {
            // console.log('Failed to upload!');
            res.render('classroom/examroom', { msg: 'Failed to Upload !! Try Again', user: dcryptUser(req.user),isAdmin:false });
        } else {
            if(req.file == undefined){
                res.render('classroom/examroom', { msg: 'No document selected!', user: dcryptUser(req.user),isAdmin:false });
            } else {
                var classroom = ClassroomUser.findOne({userId: req.user._id});
                var solution = {
                  solutionId: req.user._id,
                  fileName: req.file.filename
                }
                Assignment.findOneAndUpdate({class: classroom.classroomId}, { solution: solution })
                    .then(assignment => {
                        if(assignment) {
                            res.render('classroom/examroom', { 'success_msg': 'Solution uploaded!', user: dcryptUser(req.user), isAdmin: false,file: `solution/${req.file.filename}`});
                        }
                    })
                    .catch(err => {
                        console.log(err);
                        res.render('classroom/examroom', { 'error_msg': 'Upload failed!', user: dcryptUser(req.user), isAdmin:false });
                    });
            }
        }
    });
 });

 // router.get("/chatbox/:id",ensureAuthenticated,function(req,res){
 //    ClassroomUser.findOne({userId: req.params.id}).then(classroomUser=>{
 //      var name = req.user.fname;
 //      // http://localhost:5000/classroom.html?username=kishan&room=123127
 //      // res.render("classroom/chatroom",{user:req.user,isAdmin:classroomUser.isAdmin,username:name,room:classroomUser.classroomId});
 //      const publicDirectoryPath = path.join(__dirname,'../public');
 //      res.render("chatroom.html?username="+name+"&room="+classroomUser.classroomId,{ root: publicDirectoryPath });
 //    });
 //   });

router.get("/exam",ensureAuthenticated, function(req, res){
    var user = dcryptUser(req.user);
    var name = user.fname+' '+user.lname;
   
     ClassroomUser.findOne({userId : req.user._id}).then(classroomUser =>{
      if(classroomUser){
        var isAdmin = classroomUser.isAdmin;
        // console.log(isAdmin);
        res.render("classroom/examroom", {name:name, user: user,isAdmin:isAdmin});
      }
   });
   
});




module.exports = router;


