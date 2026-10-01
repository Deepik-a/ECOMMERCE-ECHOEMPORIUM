

const Order = require('../../model/orderSchema');
const Product = require('../../model/productSchema')
const Wallet = require('../../model/walletSchema')
const Razorpay =  require('razorpay');
const Cart = require('../../model/cartSchema')
require('dotenv').config();


//--------------------------------- user order page -----------------------------


exports.orderPage = async (req, res) => {
    try {
        const user = req.session.user;
        if (!user) {
            req.flash('error', "User not found. Please login again.");
            return res.redirect("/login");
        }

        // Get the current page number from the query parameters, default to 1
        const page = parseInt(req.query.page) || 1;
        const limit =5; // Set the number of orders to display per page
        const skip = (page - 1) * limit;

        // Fetch orders with pagination
        const orderDetails = await Order.find({ userId: user })
            .populate("items.productId")
            .sort({ updatedAt: -1 })
            .limit(limit)
            .skip(skip);

        // Get total count of orders for pagination
        const totalOrders = await Order.countDocuments({ userId: user });
        console.log("totalordes",totalOrders)
        const totalPage = Math.ceil(totalOrders / limit);
        console.log("totalPage",totalPage)
// console.log(orderDetails+"order details");



        res.render("user/order", {
            title: "Orders",
            user,
            orderDetails,
            currentPage: page,
            totalPage,
            limit,
        });
    } catch (err) {
        console.error(`Error rendering the order page: ${err}`);
        req.flash("error", "Error rendering the order page, please Try again later.");
        res.redirect("/");
    }
};

exports.viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId).populate('items.productId').exec();
         
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
    
       
        res.json(order);
    } catch (error) {
        console.error(`Error from viewOrderDetails: ${error}`);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const razorpay = new Razorpay({
    key_id: "rzp_test_KDYrLJHnu3O9Ip", // Your Razorpay key_id
    key_secret: "bcOjtnHN19lrbqBWdS35Ee7J" // Your Razorpay key_secret
});





exports.cancelOrder = async (req,res) => {
    try {
console.log('hai')
     const orderId = req.params.id;
    
        const {action,reason,productId} = req.body;
        console.log(`action = ${action}`)   
 
        if(!productId){
            return res.json({ success: false, message: 'Invalid order ID' });
        }
        const order = await Order.findById(orderId);
            
        if (!order) {
            return res.json({ success: false, message: 'Order not found' });
        }


const item = order.items.find(item => item.productId.toString() === productId);

if(item){
    item.status = action === 'return' ? 'Requested' : 'Cancelled';
    item.reasonForCancellation = action === 'cancel' ? reason : null;
    item.reasonForReturn = action === 'return' ? reason : null;

    if (action === 'cancel' && (order.paid || order.paymentMethod === 'razorpay' || order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet')) {
        const refundAmount = item.productPrice * item.productCount;
        let userWallet = await Wallet.findOne({ userID: order.userId });
        if (userWallet) {
            userWallet.balance = (userWallet.balance || 0) + refundAmount;
            userWallet.transaction.push({
                wallet_amount: refundAmount,
                order_id: order.orderId,
                transactionType: 'Credited',
                transaction_date: new Date()
            });
            await userWallet.save();
        } else {
            await Wallet.create({
                userID: order.userId,
                balance: refundAmount,
                transaction: [{
                    wallet_amount: refundAmount,
                    order_id: order.orderId,
                    transactionType: 'Credited',
                    transaction_date: new Date()
                }]
            });
        }
    }
} else {
    return res.json({ success: false, message: 'Item not found in order. Please refresh the page and try again.' });
}

// Check if all items in the order are cancelled/returned to update the main order status
const allStatuses = order.items.map(i => i.status);
if (allStatuses.every(s => s === 'Cancelled')) {
    order.status = 'Cancelled';
} else if (allStatuses.every(s => s === 'Returned')) {
    order.status = 'Returned';
} else if (allStatuses.every(s => s === 'Cancelled' || s === 'Returned' || s === 'Rejected')) {
    order.status = 'Cancelled';
} else if (allStatuses.some(s => s === 'Requested')) {
    order.status = 'Requested';
}

const product = await Product.findById(productId);

if(product){
    // Only restock immediately if it's a cancellation. Returns should be restocked by admin upon approval.
    if (action === 'cancel' && item) {
        product.stock += item.productCount;
        await product.save();
    }
}else{
    return res.json({ success: false, message: 'Product not found in inventory' });
}

        
         console.log(`order = ${order}`)
        await order.save();
        return res.json({ success: true });
    } catch (error) {
     console.log(`error form cancelOrder:${error.message}`)
     res.json({ success: false, message: 'Cannot cancel this order right now, please try again' });
    }
}


