const userSchema = require("../../model/userSchema");
const addressSchema = require("../../model/addressSchema");

//-------------------------------------------Rendering  profile Page----------------------------------------------

const profile = async (req, res) => {
  try {
    console.log("profile session user:", req.session.user);

    if (!req.session.user) {
      return res.redirect("/login");
    }

    // session.user may be the full user object (from loginpost) or just an _id (from Google OAuth)
    const userId = req.session.user._id || req.session.user;

    const userDetail = await userSchema.findById(userId);

    if (!userDetail) {
      return res.redirect("/login");
    }

    res.render("user/userprofile", { userDetail });
  } catch (error) {
    console.log(`Error during profile page render: ${error}`);
    res.status(500).send("Server Error");
  }
};


//------------------------------------------- update profile(Only name and phone) ----------------------------------------------
// Backend check for Google-authenticated users (already included)
const updatedProfile = async (req, res) => {
  try {
    const userId = req.session.user._id || req.session.user;
    const userDetail = await userSchema.findById(userId);
    
    // Check if the user is logged in via Google
    if (userDetail.authMethod === 'google') {
      return res.redirect(`/userprofile?status=error&message=You cannot edit your profile when logged in via Google authentication.`);
    }
    
    const { name, phone } = req.body;
    
    // Update the profile if not a Google-authenticated user
    const profileUpdate = await userSchema.findByIdAndUpdate(userId, { name, phone });
    
    if (profileUpdate) {
      res.redirect(`/userprofile?status=success&message=Profile updated successfully`);
    } else {
      res.redirect(`/userprofile?status=error&message=Could not update profile, please try again`);
    }
  } catch (error) {
    console.log(`Error during updating the user profile: ${error}`);
    res.redirect(`/userprofile?status=error&message=An error occurred. Please try again later.`);
  }
};



//------------------------------- Add address management-----------------------------

const addAddress = async (req, res) => {
  try {
    const userAddress = {
      building: req.body.building,
      street: req.body.street,
      city: req.body.city,
      phone: req.body.phone,
      pincode: req.body.pincode,
      landmark: req.body.landmark,
      state: req.body.state,
      country: req.body.country,
    };

    const userId = req.session.user._id || req.session.user;
    const user = await userSchema.findById(userId);
    user.address.push(userAddress);
    await user.save();

    console.log("success", "Address added");
    res.redirect("/userprofile");
  } catch (error) {
    req.flash("error", "Error while adding new address, please try later");
    console.log(`Error during adding the user address: ${error}`);
    res.redirect("/userprofile");
  }
};

//-------------------------------------- Remove Address ---------------------------------

const removeAddress = async (req, res) => {
  try {
    const userId = req.session.user._id || req.session.user;
    const index = parseInt(req.params.index, 10);

    const user = await userSchema.findById(userId);

    if (!user) {
      console.log("User not found");
      req.flash("error", "User not found");
      return res.redirect("/userprofile");
    }

    if (isNaN(index) || index < 0 || index >= user.address.length) {
      req.flash("error", "Invalid address index");
      return res.redirect("/userprofile");
    }

    user.address.splice(index, 1);
    await user.save();

    console.log("Address deleted successfully");
    req.flash("success", "Address deleted successfully");
    res.redirect("/userprofile");
  } catch (error) {
    console.log(`Error during address deletion: ${error}`);
    req.flash("error", "Failed to delete address. Please try again later.");
    res.redirect("/userprofile");
  }
};


// --------------------------------------- Edit address page load ---------------------------------

const editAddress = async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    console.log(index, "index of address");
    const userId = req.session.user._id || req.session.user;
    const user = await userSchema.findById(userId);

    if (index < 0 || index >= user.address.length) {
      req.flash("error", "Invalid address index.");
      return res.redirect("/userprofile");
    }

    const updatedAddress = {
      building: req.body.building,
      street: req.body.street,
      city: req.body.city,
      phone: req.body.phone,
      pincode: req.body.pincode,
      landmark: req.body.landmark,
      state: req.body.state,
      country: req.body.country,
    };

    user.address[index] = updatedAddress;
    await user.save();

    req.flash("success", "Address updated successfully.");
    res.redirect("/userprofile");
  } catch (error) {
    req.flash("error", "Error while updating the address. Please try again later.");
    console.log(`Error during updating the user address: ${error}`);
    res.redirect("/userprofile");
  }
};








module.exports = {
  profile,
  updatedProfile,
  addAddress,
  removeAddress,
  editAddress
};
