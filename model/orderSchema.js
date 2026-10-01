const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'echoemporium2', // Reference to the User collection
        required: true
    }, 
    orderId: {
        type: String, // Optionally, you can use a unique order number generator
        required: true
    },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'products', // Reference to the Products collection
            required: true
        },
        productCount: {
            type: Number,
            required: true
        },
        productPrice: {
            type: Number,
            required: true
        },
        productImage: {
            type: String,
        },     
        status: {
            type: String,
            enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned','Paid','Requested', 'Rejected'],
            default: 'Pending' // Default status for individual product
        },
        reasonForCancellation:{
            type:'String'
        },
        reasonForReturn:{
            type:'String'
        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    totalQuantity: {
        type: Number,
        default: 0, // Optional: Can be calculated dynamically
    },
    address: {
        type: String,
        required: true
    },
    isCancel: {
        type: Boolean,
        default: false
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['Cash on Delivery', 'Razorpay', 'Wallet'], // Valid payment methods
    },
    paymentId: {
        type: String,
        required: false, // Only required if payment method is Razorpay or wallet
    },
    paymentStatus: {
        type: String,
        required: false, // Only required if payment method is Razorpay or wallet
    },
     payableAmount:{
            type:Number,
            default:0
        },
    couponCode: {
        type: String,
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Shipped', 'Paid', 'Delivered', 'Cancelled', 'Returned', 'Requested', 'Rejected'],
        default: 'Pending' // Default status when the order is placed
    },
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Calculate totalQuantity dynamically
orderSchema.methods.calculateTotalQuantity = function() {
    this.totalQuantity = this.items.reduce((acc, item) => acc + item.productCount, 0);
};

// Update order status based on payment method and status
orderSchema.pre('save', function(next) {
    if (this.paymentMethod === 'Razorpay' && this.paymentStatus === 'Paid') {
        this.status = 'Paid'; // Set the order status to 'Paid' if Razorpay is used and payment is successful
    }
    next();
});

module.exports = mongoose.model('orders', orderSchema);


