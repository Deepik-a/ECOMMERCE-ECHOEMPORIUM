require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../model/userSchema');

const clientID = (process.env.GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim().replace(/^["']|["']$/g, '');
const callbackURL = (process.env.GOOGLE_CALLBACK_URL || 'http://localhost:1233/auth/google/callback')
  .trim()
  .replace(/^["']|["']$/g, '');

if (!clientID || !clientSecret) {
  console.warn('Google OAuth: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing in .env');
}

passport.use(new GoogleStrategy({
  clientID,
  clientSecret,
  callbackURL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ email: profile._json.email });

    if (!user) {
      user = await User.create({
        googleId: profile.id,
        name: profile.displayName,
        email: profile._json.email,
        authMethod: 'google',
        is_verified: 1,
      });
    }

    return done(null, user);
  } catch (err) {
    console.error('Error in Google OAuth strategy:', err);
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
