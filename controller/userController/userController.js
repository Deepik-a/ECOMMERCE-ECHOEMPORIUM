const userSchema = require("../../model/userSchema");
const categorySchema=require('../../model/categorySchema')
const productSchema=require('../../model/productSchema')

const bcrypt = require("bcrypt");

const sendOTP = require("../../services/emailSender");
const generateotp = require("../../services/otpgenerator");

const passport = require('passport')
const auth = require('../../services/passport')



const signup = (req, res) => {
  try {
    if (req.session.user) {
      res.render("user/Landingpage");
    } else {
      res.render("user/signup", {
        title: "Please Signup",
        user: req.session.user,
      });
    }
  } catch (error) {
    console.log(`error while renderin the page ${error}`);
  }
};

const signupPost = async (req, res) => {
  console.log(req.body);

  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const name = (req.body.name || '').trim();
    const phone = (req.body.phone || '').trim();

    if (!email || !name || !phone || !req.body.password) {
      return res.render('user/signup', {
        title: 'Please Signup',
        user: null,
        error: 'All fields are required.',
      });
    }

    const existingUser = await userSchema.findOne({ email });

    if (existingUser) {
      return res.render('user/signup', {
        title: 'Please Signup',
        user: null,
        error: 'An account with this email already exists. Please log in instead.',
      });
    }

    const otp = generateotp();
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    req.session.otp = otp;
    req.session.otpTime = Date.now();
    req.session.email = email;
    req.session.name = name;
    req.session.phone = phone;
    req.session.password = hashedPassword;
    req.session.otpMailWarning = false;

    console.log(`Session OTP set: ${req.session.otp}`);

    // Send email in background — never block redirect to OTP page
    sendOTP(email, otp).catch((mailErr) => {
      console.error('Failed to send OTP email:', mailErr.message);
      req.session.otpMailWarning = true;



      
    });



    return req.session.save((err) => {
      if (err) {
        console.error('Session save failed:', err);
        return res.status(500).render('user/signup', {
          title: 'Please Signup',
          user: null,
          error: 'Could not start verification. Please try again.',
        });
      }
      return res.redirect('/otp');
    });
  } catch (error) {
    console.error(`Error during signup: ${error}`);
    return res.status(500).render('user/signup', {
      title: 'Please Signup',
      user: null,
      error: 'Something went wrong. Please try again.',
    });
  }
};


const otp = (req, res) => {
  try {
    if (!req.session.otp || !req.session.email) {
      return res.redirect('/signup');
    }

    const mailWarning = req.session.otpMailWarning;
    req.session.otpMailWarning = null;

    return res.render('user/otp', {
      title: 'OTP Verification',
      email: req.session.email,
      otpTime: req.session.otpTime,
      mailWarning,
    });
  } catch (error) {
    console.error('Error rendering OTP page:', error);
    return res.redirect('/signup');
  }
};



//------------------------------------ verify the otp -------------------------------

const OTP_DURATION_MS = 2 * 60 * 1000;

const otppost=async(req,res)=>{
  try{
    console.log("entered try");
    console.log(`Body OTP: ${req.body.otp} | Session OTP: ${req.session.otp}`);

    if (!req.session.otp || !req.session.otpTime) {
      return res.redirect('/signup');
    }

    if (Date.now() - req.session.otpTime > OTP_DURATION_MS) {
      console.log('OTP expired');
      return res.redirect('/otp');
    }

    if(req.body.otp===req.session.otp){
      console.log("OTP matched");
      // ⚠️ req.session.password is already bcrypt-hashed from signupPost — do NOT hash again
      const details = {
        name: req.session.name,
        email: req.session.email,
        password: req.session.password,
        phone: Number(req.session.phone),
      };
      await userSchema.insertMany([details]);
      console.log(`New user registered successfully`);
      // Clear sensitive session data after successful signup
      req.session.otp = null;
      req.session.otpTime = null;
      req.session.password = null;
      return res.redirect('/login');
    } else {
      console.log('OTP mismatch');
      return res.redirect('/otp');
    }
  } catch (error) {
    console.log(`Error while verifying OTP: ${error}`);
    res.status(500).send('Server Error');
  }
}


//-------------------------------------- Otp Resent ---------------------------------

const otpResend=async(req,res)=>{
  try{
    const email=req.session.email
    if(!email){
      return res.redirect('/signup')
    }
    const otp=generateotp()
    req.session.otp=otp
    req.session.otpTime=Date.now()
    try {
      await sendOTP(email,otp)
    } catch (mailErr) {
      console.error('Failed to resend OTP email:', mailErr.message)
      req.session.otpMailWarning = true
    }
    console.log("OTP resent (check email or server console)");
    res.redirect('/otp')
  }catch(error){
    console.log(`error while resend otp ${error}`)
    res.redirect('/otp')
  }
}


// GET login page
const login = async (req, res) => {
  try {
    const categories = await categorySchema.find({ isDeleted: false });

    if (req.session.user) {
      return res.redirect('/');
    }

    const errorMap = {
      userNotFound: 'No account found with that email.',
      blocked: 'Your account has been blocked.',
      invalidPassword: 'Incorrect password.',
      useGoogle: 'This account uses Google Sign-In. Please continue with Google.',
      googleAuthFailed: 'Google sign-in failed. Please try again.',
      serverError: 'Something went wrong. Please try again.',
    };

    res.render('user/login', {
      title: 'Login',
      user: null,
      alertMessage: errorMap[req.query.error] || '',
      categories,
    });
  } catch (error) {
    console.error(`Error in GET /login: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
};

// POST login form handler
const loginpost = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userSchema.findOne({ email });
    if (!user) {
      return res.redirect('/login?error=userNotFound');
    }

    if (user.isBlocked) {
      return res.redirect('/login?error=blocked');
    }

    // Google-only accounts have no local password
    if (!user.password) {
      return res.redirect('/login?error=useGoogle');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.redirect('/login?error=invalidPassword');
    }

    req.session.user = user._id;
    return res.redirect('/');
  } catch (error) {
    console.error(`Error during login: ${error.message}`);
    res.redirect('/login?error=serverError');
  }
};


const logout = (req, res) => {
  try {
    req.session.destroy(error => {
      if (error) {
        console.log(`error while logout ${error}`)
      }
    })
    res.redirect('/')
  } catch (error) {
    console.log(`error while logout user ${error}`)
  }
}


// //-------------------------------------- google auth -----------------------------------

// const googleAuth = (req, res) => {
 
//   try {
//     passport.authenticate('google', {
//       scope: ['email', 'profile']
//     })
//   } catch (err) {
//     console.log(`Error on google authentication ${err}`)
//   }
// }


// //----------------------------------- google auth callback  ----------------------------

// const googleAuthCallback = (req, res, next) => {
//   console.log("googleAuthCallback") 
//     passport.authenticate('google', { failureRedirect: '/' }),
//     (req, res) => {
//       res.render("user/home");
//     };
// }






module.exports = {

  signup,
  signupPost,
  otp,
  otppost,
otpResend,
login,
loginpost,
logout,
// googleAuth ,
// googleAuthCallback
};
