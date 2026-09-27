const Cart = require('../../model/cartSchema');
const Product = require('../../model/productSchema');
const User = require('../../model/userSchema');
const offerModel = require('../../model/offerSchema'); // Update the path as necessary

const mongoose = require('mongoose'); // Ensure mongoose is required

const findOffer = async (cart) => {
    if (!cart || !Array.isArray(cart.items)) {
        console.error("findOffer: 'cart' or 'cart.items' is invalid", cart);
        return { cartItems: [] };
    }

    const currentDate = new Date(); // Use Date object for comparisons

    // Process each cart item
    const cartItems = await Promise.all(
        cart.items.map(async (item) => {
            // Fetch product details for the item
            const product = await Product.findById(item.productId).populate('category');
            if (!product) {
                console.error(`Product with ID ${item.productId} not found`);
                return { ...item.toObject(), offers: [] };
            }

            const categoryId = product.category?._id?.toString(); // Extract category ID

            // Fetch applicable offers
            const offers = await offerModel.find({
                $and: [
                    { isActive: true },
                    { startDate: { $lte: currentDate } },
                    { endDate: { $gte: currentDate } },
                    {
                        $or: [
                            { applicableProduct: item.productId },
                            { applicableCategory: categoryId }, // Use category ID here
                        ]
                    }
                ]
            });

            console.log("Fetched offers for product:", offers);
            if (offers.length === 0) {
                console.log("No valid offers found for product:", item.productId);
            }

            return {
                ...item.toObject(),
                product, // Attach full product details
                offers,  // Attach applicable offers
            };
        })
    );

   

    // Calculate discounts for each item
    cartItems.forEach((item) => {
        if (item.offers.length > 0 && item.product.discount <= 50) {
            // Prioritize product offer over category offer
            const productOffer = item.offers.find((offer) => offer.offerType === 'products');
            const categoryOffer = item.offers.find((offer) => offer.offerType === 'Category');

            console.log("Product offer:", productOffer, "Category offer:", categoryOffer);

            // Determine the discount percentage
            const discount = productOffer
                ? productOffer.discountPercentage
                : categoryOffer
                ? categoryOffer.discountPercentage
                : 0;

            // Calculate the offer amount
            const offerAmount = Math.round((item.product.price * discount) / 100);

            // Update discountPrice for the product
            item.product.finalPrice =
                item.product.finalPrice !== undefined
                    ? item.product.finalPrice - offerAmount
                    : item.product.price - offerAmount;

          
        } else {
            // Clear offers if no valid offer applies
            item.offers = [];
        }
    });

    return { cartItems };
};


const addToCart = async (req, res) => {
    console.log("Entered addToCart");
    const userId = req.session.user;
    if (!userId) {
        return res.status(401).json({ success: false, message: "User is not logged in, please log in again." });
    }

    const productId = req.params.id;
    
    // Validate productId
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    const MAX_QUANTITY_LIMIT = 10; // Maximum limit per product

    try {
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        // Check if the product is out of stock
        if (product.stock <= 0) {
            return res.status(409).json({ success: false, message: "Product is out of stock." });
        }

        // Fetch or create the cart
        let cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart) {
            cart = new Cart({
                userId,
                items: [],
                totalPrice: 0,
            });
        }

        // Filter out items with null productId (deleted products)
        cart.items = cart.items.filter(item => item.productId !== null);

        // Find or add the item in the cart
        let cartItem = cart.items.find(item => item.productId && item.productId.equals(product._id));

        if (cartItem) {
            if (
                cartItem.productCount + 1 > product.stock || 
                cartItem.productCount + 1 > MAX_QUANTITY_LIMIT
            ) {
                return res.status(409).json({ 
                    success: false, 
                    message: `Cannot add more than ${Math.min(product.stock, MAX_QUANTITY_LIMIT)} items to the cart.` 
                });
            } else {
                cartItem.productCount += 1;
            }
        } else {
            cart.items.push({
                productId: product._id,
                productCount: 1,
                productPrice: product.finalPrice || product.price,
                productImage: product.imgArray[0] || '/path-to-default-image.jpg'
            });
        }

        // Calculate offers for the cart
        const { cartItems } = await findOffer(cart);

        // Update the cart items with calculated offers and prices
        cart.items = cartItems.map(item => ({
            productId: item.product._id,
            productCount: item.productCount,
            productPrice: item.product.finalPrice || item.product.price,
            productImage: item.product.imgArray[0] || '/path-to-default-image.jpg'
        }));

       cart.totalPrice = cart.items.reduce((total, item) => total + (item.productPrice * item.productCount),0);
        // Save the cart to the database
        await cart.save();

        return res.json({ success: true, message: "Product added to cart successfully", cart });
    } catch (error) {
        console.error('Error adding to cart:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: "Validation error: " + error.message });
        }
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: "Invalid data format." });
        }
        return res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
};









// Get cart
const getCart = async (req, res) => {
   
    const userId = req.session.user;
    if (!userId) {
        return res.status(401).json({ success: false, message: 'User not logged in' });
    }
  
    try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');
    
        if (!cart || cart.items.length === 0) {
            return res.render('user/cart', { cart: { items: [] }, alertMessage: 'Your cart is empty' });
        }

        // Filter out items with null productId (deleted products)
        cart.items = cart.items.filter(item => item.productId !== null);
        await cart.save();

        res.render('user/cart', { cart });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ success: false, message: 'Error fetching cart' });
    }
};




// Remove product from cart
const removeFromCart = async (req, res) => {
    const productId = req.params.id;
    const userId = req.session.user;

    // Validate productId
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    try {
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Filter out the product to remove it from the cart
        cart.items = cart.items.filter(item => item.productId.toString() !== productId);
       
        cart.totalPrice = cart.items.reduce((total, item) => total + (item.productPrice * item.productCount), 0);
        await cart.save();
        
        res.json({ success: true, message: 'Product removed from cart', cart });
    } catch (error) {
        console.error('Error removing product from cart:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


const increment = async (req, res) => {
    try {
        console.log("Increment function called");
        const { productId } = req.body;
        console.log("Request Body: ", req.body);
        const userId = req.session.user;
        console.log("User ID: ", userId);
        const maxQuantity = 10;

        // Validate request
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        // Find the product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Find the user's cart
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Filter out items with null productId
        cart.items = cart.items.filter(item => item.productId !== null);

        // Find the product in the cart
        const index = cart.items.findIndex(p => p.productId.toString() === productId);
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }

        // Check current product count
        const currentCount = cart.items[index].productCount;

        // Increment count
        const newCount = currentCount + 1;

        // Validate maximum quantity
        if (newCount > maxQuantity) {
            return res.status(409).json({ success: false, message: `Maximum quantity per product is ${maxQuantity}` });
        }

        // Validate available stock
        if (newCount > product.stock) {
            return res.status(409).json({ success: false, message: `Available quantity of this product is ${product.stock}` });
        }

        // Update the product count in cart
        cart.items[index].productCount = newCount;

        // Calculate the updated total price
        const updatedPrice = cart.items[index].productPrice * cart.items[index].productCount;

        cart.totalPrice = cart.items.reduce((total, item) => total + (item.productPrice * item.productCount), 0);
        // Save the cart
        await cart.save();

        // Send success response with updated cart information
        res.status(200).json({
            success: true,
            message: 'Product quantity updated successfully',
            updatedCart: cart,
            cartTotal: cart.items.reduce((total, item) => total + (item.productPrice * item.productCount), 0),
            updatedPrice: updatedPrice
        });
    } catch (error) {
        console.error(`Error incrementing product quantity in cart: ${error}`);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


// //------------- Decrement Function ---------------

const decrement = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId } = req.body;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }
        
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Filter out items with null productId
        cart.items = cart.items.filter(item => item.productId !== null);

        const index = cart.items.findIndex(p => p.productId.toString() === productId);

        if (index > -1) {
            cart.items[index].productCount -= 1;
            if (cart.items[index].productCount <= 0) {
                cart.items[index].productCount = 1;
            }
            cart.totalPrice = cart.items.reduce((total, item) => total + (item.productPrice * item.productCount), 0);
            await cart.save();
            res.status(200).json({
                success: true,
                cartTotal: cart.items.reduce((total, item) => total + (item.productPrice * item.productCount), 0),
                updatedPrice: cart.items[index]?.productPrice * cart.items[index]?.productCount || 0,
                disableButton: cart.items[index]?.productCount === 1
            });
        } else {
            res.status(404).json({ success: false, message: 'Product not found in cart' });
        }
    } catch (error) {
        console.error(`Error decrementing product quantity in cart: ${error}`);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};




module.exports = {
    addToCart,
    getCart,
    removeFromCart,
    increment,
    decrement,
    findOffer 
};
