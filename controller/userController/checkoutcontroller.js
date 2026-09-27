
const User = require('../../model/userSchema');
const Cart = require('../../model/cartSchema');
const Order = require('../../model/orderSchema');
const Product = require('../../model/productSchema');
const Coupon = require('../../model/couponSchema')
const Wallet = require('../../model/walletSchema')

const  Razorpay = require('razorpay');
const { concurrency } = require('sharp');
const orderSchema = require('../../model/orderSchema');
const Category = require('../../model/categorySchema');

//checkout validation

exports.validateCheckout = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'User not found, please log in again.' });
        }

        const userId = req.session.user;
        const cartDetails = await Cart.findOne({ userId }).populate('items.productId');

        console.log("carDetails of validate checkout",cartDetails)

        if (!cartDetails) {
            return res.status(404).json({ success: false, message: 'Cart not found.' });
        }

        const items = cartDetails.items;
        if (items.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty.' });
        }

        console.log("items of validate checkout",items)

        for (const item of items) {
            const product = item.productId;
            if (!product.isActive) {
                return res.status(400).json({ success: false, message: `Product "${product.name}" is not available.` });
            }

            if (item.productCount > product.stock) {
                return res.status(400).json({ success: false, message: `The quantity of "${product.name}" exceeds the available stock.` });
            }
        }

        // If all checks pass
        res.status(200).json({ success: true, message: 'Validation successful' });
    } catch (error) {
        console.error('Error during checkout validation:', error);
        res.status(500).json({ success: false, message: 'Server Error. Please try again later.' });
    }
};



//after validation,get the checkout page
exports.getCheckoutPage = async (req,res) => {
    try {
   
        if (!req.session.user) {
            req.flash('error', "User not found, please log in again");
            return res.redirect('/login');
        }
      
      const userId = req.session.user;
      const user = await User.findById(userId)

      if (!user) {
        return res.status(404).send('User not found');
    }
    
    const cartDetails = await Cart.findOne({userId}).populate('items.productId');

    if (!cartDetails) {
        return res.status(404).send('Cart not found');
    }
    const items = cartDetails.items;
    if (items.length === 0) {
        return res.redirect('/cart');
    }
    for(const item of items){
        if(!item.productId.isActive){
            req.flash("error", "Product is not available, please remove it from the cart");
            return res.redirect("/cart");
        }
    }
        const now = new Date();
        const availableCoupons = await Coupon.find({
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
            minimumOrderAmount: { $lte: cartDetails.totalPrice },
            $expr: { $lt: ["$timesUsed", "$usageCount"] }
        });

        const eligibleCoupons = availableCoupons.filter((coupon) => {
            const couponUsage = user.couponUsed && user.couponUsed.find((c) => {
                return c.couponId && c.couponId.toString() === coupon._id.toString();
            });
            if (couponUsage) {
                return couponUsage.usageCount < coupon.usageCount;
            }
            return true;
        });

        let wallet = await Wallet.findOne({ userID: userId });
        if (!wallet) {
            wallet = { balance: 0, transaction: [] };
        }

        const addresses = user ? user.address : [];

        return res.render('user/checkout', {
            user,
            cartDetails,
            userDetails: user,
            addresses,
            eligibleCoupons,
            wallet
        });
    } catch (error) {
        console.error('Error fetching checkout page:', error);
        res.status(500).send('Server Error');
    }
};

exports.paymentRender = async (req, res) => {
    try {
        console.log("entered payment render");
        const totalAmount = req.params.amount;
        if (!totalAmount) {
            return res.status(404).json({ error: 'Amount parameter is missing' });
        }

        const instance = new Razorpay({
            key_id: "rzp_test_KDYrLJHnu3O9Ip",
            key_secret: "bcOjtnHN19lrbqBWdS35Ee7J"
        });

        const options = {
            amount: totalAmount * 100,
            currency: 'INR',
            receipt: "receipt#1"
        };

        instance.orders.create(options, (error, order) => {
            if (error) {
                console.error(`Failed to create order:`, error);
                return res.status(500).json({ error: `Failed to create order: ${error.message}` });
            }
            return res.status(200).json({ orderID: order.id });
        });
    } catch (error) {
        console.error(`Error on orders in checkout:`, error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressIndex = parseInt(req.params.address);
        const paymentMode = parseInt(req.params.payment);
        const { razorpay_payment_id, payment_status } = req.body;

        // Retrieve the user's cart
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty or could not be found.' });
        }

        // Validate the user's address
        const user = await User.findById(userId);
        if (!user || !user.address || !user.address[addressIndex]) {
            return res.status(400).json({ success: false, message: 'Selected address is not valid.' });
        }

        // Calculate total quantity of items in the cart
        let totalQuantity = cart.items.reduce((sum, item) => sum + item.productCount, 0);

        const paymentDetails = ["Cash on Delivery", "Wallet", "Razorpay"];
        if (paymentDetails[paymentMode] === 'Cash on Delivery') {
            if (cart.totalPrice > 1000) {
                return res.status(400).json({ success: false, message: 'Cash on Delivery is available below ₹1000 only.' });
            }
        }
        
        const paymentId = paymentMode === 2 ? razorpay_payment_id : '';

        // Atomic Coupon Usage validation & increment to prevent race conditions
        if (cart.isCouponApplied && cart.couponId) {
            const now = new Date();
            const updatedCoupon = await Coupon.findOneAndUpdate(
                {
                    _id: cart.couponId,
                    isActive: true,
                    startDate: { $lte: now },
                    endDate: { $gte: now },
                    $expr: { $lt: ["$timesUsed", "$usageCount"] }
                },
                { $inc: { timesUsed: 1 } },
                { new: true }
            );

            if (!updatedCoupon) {
                return res.status(400).json({
                    success: false,
                    message: 'Coupon usage limit has been exceeded or coupon is no longer active.'
                });
            }

            // User coupon usage check
            if (!user.couponUsed) {
                user.couponUsed = [];
            }
            const couponUsage = user.couponUsed.find(
                (usage) => usage.couponId && usage.couponId.toString() === cart.couponId.toString()
            );

            if (couponUsage) {
                if (couponUsage.usageCount >= updatedCoupon.usageCount) {
                    // Rollback atomic coupon count
                    await Coupon.findByIdAndUpdate(cart.couponId, { $inc: { timesUsed: -1 } });
                    return res.status(400).json({
                        success: false,
                        message: `You have reached the maximum allowed limit for this coupon (${updatedCoupon.usageCount} uses).`
                    });
                }
                couponUsage.usageCount += 1;
            } else {
                user.couponUsed.push({
                    couponId: cart.couponId,
                    usageCount: 1,
                });
            }

            await user.save();
        }

        const newOrder = new Order({
            userId,
            orderId: Math.floor(Math.random() * 1000000),
            items: cart.items,
            totalQuantity,
            totalPrice: cart.totalPrice,
            couponCode: cart.couponId || null,
            couponDiscount: cart.couponDiscount || 0,
            payableAmount: cart.payableAmount > 0 ? cart.payableAmount : cart.totalPrice,
            address: `${user.address[addressIndex].building}, ${user.address[addressIndex].street}, ${user.address[addressIndex].city}, ${user.address[addressIndex].state}, ${user.address[addressIndex].country}, ${user.address[addressIndex].pincode}`,
            paymentMethod: paymentDetails[paymentMode],
            orderStatus: payment_status === "Pending" ? "Pending" : "Paid",
            paymentId,
            paymentStatus: payment_status,
            isCancelled: false,
            paid: paymentMode !== 0,
        });

        await newOrder.save();

        // Handle wallet payment
        if (paymentDetails[paymentMode] === 'Wallet') {
            const wallet = await Wallet.findOne({ userId });
            if (!wallet || wallet.balance < cart.payableAmount) {
                return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
            }

            wallet.balance -= cart.payableAmount;
            wallet.transaction.push({
                wallet_amount: cart.payableAmount,
                transactionType: 'Debited',
                transaction_date: new Date(),
                order_id: newOrder.orderId,
            });

            await wallet.save();
        }

        // Update product stock
        for (let item of cart.items) {
            const product = await Product.findById(item.productId);
            if (product) {
                product.stock -= item.productCount;
                await product.save();
            }
        }

        // Clear the user's cart
        cart.items = [];
        cart.payableAmount = 0;
        cart.isCouponApplied = false;
        cart.couponDiscount = 0;
        cart.couponId = null;
        cart.totalPrice = 0;

        await cart.save();

        return res.status(200).json({
            success: true,
            message: 'Order placed successfully!',
            order: newOrder,
        });
    } catch (error) {
        console.error(`Error during order placement: ${error.message}`);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        if (!couponCode) {
            return res.status(400).json({ status: 'error', message: 'Coupon identifier is required.' });
        }

        const user = await User.findOne({ _id: req.session.user });
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Please log in to apply coupons.' });
        }

        // Search by ID or by Code (case-insensitive)
        let coupon;
        if (/^[0-9a-fA-F]{24}$/.test(couponCode)) {
            coupon = await Coupon.findById(couponCode);
        }
        if (!coupon) {
            coupon = await Coupon.findOne({ code: new RegExp(`^${couponCode.trim()}$`, 'i') });
        }

        if (!coupon) {
            return res.status(400).json({
                status: "error",
                message: "Coupon not found.",
            });
        }

        if (!coupon.isActive) {
            return res.status(400).json({
                status: 'error',
                message: 'This coupon is currently inactive.',
            });
        }

        const now = new Date();
        const startOfDay = new Date(coupon.startDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(coupon.endDate);
        endOfDay.setHours(23, 59, 59, 999);

        if (now < startOfDay) {
            return res.status(400).json({
                status: 'error',
                message: `This coupon is not yet valid. Starts on ${startOfDay.toLocaleDateString()}.`,
            });
        }

        if (now > endOfDay) {
            return res.status(400).json({
                status: 'error',
                message: 'This coupon has expired.',
            });
        }

        // Global usage count check
        if (coupon.timesUsed >= coupon.usageCount) {
            return res.status(400).json({
                status: 'error',
                message: 'This coupon has reached its maximum total redemption limit.',
            });
        }

        // Per-user usage count check
        if (user.couponUsed) {
            const userUsage = user.couponUsed.find(
                (u) => u.couponId && u.couponId.toString() === coupon._id.toString()
            );
            if (userUsage && userUsage.usageCount >= coupon.usageCount) {
                return res.status(400).json({
                    status: 'error',
                    message: `You have already used this coupon the maximum allowed number of times (${coupon.usageCount}).`,
                });
            }
        }

        const cart = await Cart.findOne({ userId: req.session.user });
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Cart is empty or not found.',
            });
        }

        const total = cart.totalPrice;
        if (total < coupon.minimumOrderAmount) {
            return res.status(400).json({
                status: 'error',
                message: `Minimum order amount of ₹${coupon.minimumOrderAmount} required to apply this coupon. Your current total is ₹${total}.`,
            });
        }

        let couponDiscount = 0;
        if (coupon.discountType === 'Percentage') {
            const rawDiscount = (coupon.discountValue / 100) * total;
            couponDiscount = coupon.maxDiscountAmount > 0 
                ? Math.min(rawDiscount, coupon.maxDiscountAmount) 
                : rawDiscount;
        } else if (coupon.discountType === 'Fixed') {
            couponDiscount = coupon.discountValue;
        }

        // Ensure discount cannot exceed total
        couponDiscount = Math.min(couponDiscount, total);
        const discountedTotal = Math.max(0, total - couponDiscount);

        cart.payableAmount = discountedTotal;
        cart.isCouponApplied = true;
        cart.couponDiscount = couponDiscount;
        cart.couponId = coupon._id;

        await cart.save();

        return res.status(200).json({
            status: 'success',
            message: `Coupon "${coupon.code}" applied successfully!`,
            total: discountedTotal,
            couponDiscount,
        });
    } catch (error) {
        console.error(`Error from applyCoupon: ${error.message}`);
        return res.status(500).json({ error: "An error occurred while applying the coupon." });
    }
};



exports.removeCoupon = async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.session.user });
        if (!user) {
            return res.redirect("/login");
        }

        const cart = await Cart.findOne({ userId: req.session.user });
        if (!cart) {
            return res.status(404).json({
                status: "error",
                message: "Cart not found",
            });
        }

        if (!cart.isCouponApplied) {
            return res.status(400).json({
                status: "error",
                message: "No coupon is applied to the cart.",
            });
        }

        // Reset cart coupon details
        cart.payableAmount = cart.totalPrice;
        cart.isCouponApplied = false;
        cart.couponDiscount = 0;
        cart.couponId = null;

        await cart.save();

        return res.status(200).json({
            status: "success",
            message: "Coupon removed successfully.",
            total: cart.payableAmount,
        });
    } catch (error) {
        console.error(`Error from removeCoupon: ${error.message}`);
        return res.status(500).json({
            error: "An error occurred while removing the coupon.",
        });
    }
};


//to render the coupon page in user side

exports.userCoupons = async (req,res) =>{
    try {
        const categories = await Category.find({isDeleted:false});
        const coupons = await Coupon.find({isActive:true});


        res.render('user/coupons',{
            categories,
            coupons:coupons
        })
    } catch (error) {
        console.log(`error from userCoupons ${error}`)
        return res.status(500).json({
            error:'An error occured while loading1 the coupon page.'
        })
    }
}



exports.failedOrder = async(req,res) =>{
    const addressIndex = req.query.address;
    const paymentMethod = req.query.paymentMethod;

   
    try {
        const userId = req.session.user_id;
        const cartItems = await Cart.findOne({userId}).populate('items.productId')
        let discountPrice = cartItems.totalPrice - cartItems.payableAmount;
        let totalPrices = cartItems.payableAmount;
        const user = await User.findById(userId)
     
        if(!userId){
            return res.status(400).json({error:'User not found'})
        }
const newOrder = new Order({
    userId:userId,
    orderId:Math.floor(Math.random()*1000000),
    paid:false,
    items:cartItems.items,
    orderStatus:"Pending",
    totalPrice:totalPrices,
    couponCode:null,
    couponDiscount:discountPrice,
    address:{
        contactName:user.address[addressIndex].fullName,
        street:user.address[addressIndex].street,
        city:user.address[addressIndex].city,
        pincode:user.address[addressIndex].pincode,
        state:user.address[addressIndex].state,
        country:user.address[addressIndex].country

    },
    paymentMethod:"razorpay",
    paymentId:null,
    isCancelled:false
});

await newOrder.save();

    res.render('user/failedOrder')
    } catch (error) {
      console.log(`error from failedOrder ${error}`) 
      return res.status(400).json({error:"something went wrong"}) 
    }
}

//order confirmation page

exports.orderConformPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);

        const order = await Order.findOne({ userId }).sort({createdAt : -1}).limit(1)

        res.render('user/conform-order', { order:order });
    } catch (err) {
        console.log(`Error on render in conform order ${err}`);
    }
}