const express=require('express')
const app=express()
const path=require("path")
const expressLayouts=require('express-ejs-layouts')
const flash = require('connect-flash')
const session=require('express-session')
const MongoStore = require('connect-mongo');
const passport = require('passport');
require("./services/passport")



const dotenv=require('dotenv').config()



const connectdb=require('./config/connection')
//--------------------- mongodb connection ---------------------

connectdb();




//----------------------- Requiring Routes -------------------------
const adminRoutes=require('./routes/adminRoute')
const userRoutes=require('./routes/userRoute')


//--------------------- Setting view engine --------------------
app.set('view engine','ejs')
app.set('views',path.join(__dirname,'views'))

//layout folder

//-----------------------public static files -------------------

app.use('/public',express.static(path.join(__dirname,'public')))


//------------------------- url encoded data -------------------
//--------------------------- middlewares -----------------------
app.use(express.json())
app.use(express.urlencoded({extended: true}))


app.use('/uploads', express.static('uploads'));



//--------------------------- session handling -----------------------
app.set('trust proxy', 1); // needed on Render / HTTPS proxies
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-echo-emporium-admin-persistent',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_CONNECTION_STRING, // Or hardcode it if env var differs
        collectionName: 'sessions'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days persistent session
    }
}));

app.use(passport.initialize());
app.use(passport.session());
  

// Flash setup
app.use(flash());

app.use(expressLayouts);
app.set('layout', 'layouts/layout');



const port=process.env.PORT || 3000


app.use('/',userRoutes)
app.use('/admin',adminRoutes)
app.get('*',(req,res) =>{
  res.render('user/404')
})

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  if (err && (err.name === 'MulterError' || err.code === 'LIMIT_FILE_SIZE')) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File too large! Maximum image size allowed is 5MB.'
      : (err.message || 'File upload error.');
    if (req.xhr || req.headers.accept?.includes('application/json') || req.is('multipart/form-data')) {
      return res.status(400).json({ success: false, message });
    }
    req.flash('error', message);
    return res.status(400).redirect('back');
  }
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
  res.status(err.status || 500).render('user/404');
});

app.listen(port,()=>{
console.log(`http://localhost:${port}`);
})