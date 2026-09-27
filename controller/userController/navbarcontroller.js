const productSchema = require('../../model/productSchema')
const categorySchema = require('../../model/categorySchema');
const userSchema =require('../../model/userSchema')
const mongoose = require('mongoose')

//----------------------------------- Home page render --------------------------------

const home = async (req, res) => {
  try {
    let user = null;

    if (req.session.user) {
      // Fetch full user object from DB (session stores only _id)
      user = await userSchema.findById(req.session.user);

      // Check if the user is blocked
      if (user && user.isBlocked) {
        console.log('User is blocked, redirecting to /account-blocked');
        req.session.user = null;
        req.flash('error', 'Your account has been blocked by the admin.');
        return res.redirect('/account-blocked');
      }
    }

    const products = await productSchema.find({ isActive: true });
    const categories = await categorySchema.find({ isDeleted: false });

    res.render('user/home', { categories, products, user });
  } catch (error) {
    console.log(`error while rendering home ${error}`);
  }
}

const showBlockedPage = (req, res) => {
  res.render('user/account-blocked', {
      errorMessage: 'Your account has been blocked by the admin. Please contact support for more information.'
  });
};





module.exports = { home ,showBlockedPage}

