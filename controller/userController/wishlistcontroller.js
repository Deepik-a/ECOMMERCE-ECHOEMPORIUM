const wishlistSchema = require('../../model/wishlistSchema')
const productSchema = require('../../model/productSchema')
const cartSchema = require('../../model/cartSchema')

const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;


// --------------------------------- wishlist page -------------------------------

const wishlistpage = async (req, res) => {
    try {
        if (!req.session.user) {
            req.flash('error', "User is Not Found, Please Login Again");
            return res.redirect('/login');
        }
        const userId = req.session.user;
        console.log('userId', userId);

        // Ensure you're querying with the correct field name as per your schema
        const wishlist = await wishlistSchema.findOne({ user: userId }).populate('products.productID');
        console.log("wishlist1", wishlist);

        if (wishlist) {
            res.render('user/wishlist', { title: "Wishlist", products: wishlist, user: req.session.user });
        } else {
            res.render('user/wishlist', { title: "Wishlist", products: [], user: req.session.user });
        }
    } catch (error) {
        console.log(`Error while rendering wishlist page ${error}`);
        res.status(400);
    }
};



// ---------------------------------Add wishlist-------------------------------



const addWishlist = async (req, res) => {
    try {
        const productID = req.params.id;
        console.log("productID ", productID);
        
        if (!req.session.user) {
            req.flash('error', "User is Not Found, Please Login Again");
            return res.redirect('/login');
        }

        // No need to convert to ObjectId if it's already in the right format
        const userID = req.session.user;

        console.log("userID ", userID);
        console.log("userID Type: ", typeof userID);  // Ensure it's string or ObjectId

        
        const Product = await productSchema.findById(productID);
        console.log("Product ", Product);
        if (!Product) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Find the wishlist for the user
        let wishlist = await wishlistSchema.findOne({ user: userID }).populate('products.productID');
        console.log("wishlist2 ", wishlist);
        
        if (wishlist) {
            console.log('Wishlist found for user');
            
            //const productExists = wishlist.products.some((item) => item.productID.toString() === productID.toString());
            const productExists = wishlist.products.some((item) => {
                console.log("Checking productID:", item.productID.toString(), "against", productID.toString());
                return item.productID.toString() === productID.toString();
            });
            console.log(' productExists', productExists);
            if (productExists) {
                return res.status(200).json({ success: false, message: "Product already in wishlist" });
            } else {
                wishlist.products.push({ productID: Product._id });
                await wishlist.save();
                return res.status(200).json({ success: true, message: "Product added to wishlist" });
            }
        } else {
            console.log('No wishlist found for user, creating new wishlist');
            
            const newWishlist = new wishlistSchema({
                user: userID,
                products: [{ productID: Product._id }]
            });
            await newWishlist.save();
            return res.status(200).json({ success: true, message: "Product added to wishlist" });
        }
    } catch (err) {
        console.error(`Error adding product to wishlist: ${err}`);
        return res.status(500).json({ success: false, message: "Error adding product to wishlist" });
    }
};



// --------------------------------- Delete wishlist-------------------------------

const deleteWishlist = async (req, res) => {
    const userId = req.session.user;
    const itemId = req.params.id;

    if (!userId) {
        return res.status(401).json({ success: false, message: 'User not found. Please login again.' });
    }
    if (!itemId || !ObjectId.isValid(itemId)) {
        return res.status(400).json({ success: false, message: 'Invalid item.' });
    }
    
    try {
        const wish = await wishlistSchema.findOne({ user: userId });
        if (wish) {
            wish.products.pull({ productID: new ObjectId(itemId) });
            await wish.save();
            return res.json({ success: true, message: 'Item removed from wishlist.' });
        } else {
            return res.status(404).json({ success: false, message: 'Wishlist not found.' });
        }
    } catch (err) {
        console.error(`Error in removing the item from wishlist: ${err}`);
        return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
    }
};




module.exports = { wishlistpage , addWishlist , deleteWishlist}