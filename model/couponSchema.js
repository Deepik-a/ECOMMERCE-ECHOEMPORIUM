const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Coupon code is required'],
        unique: true,
        trim: true,
        uppercase: true,
        minlength: [4, 'Coupon code must be at least 4 characters long'],
        maxlength: [20, 'Coupon code cannot exceed 20 characters'],
        match: [/^[A-Z0-9]{4,20}$/, 'Coupon code must contain only uppercase letters and numbers']
    },
    discountType: {
        type: String,
        enum: {
            values: ['Percentage', 'Fixed'],
            message: '{VALUE} is not a valid discount type. Must be Percentage or Fixed'
        },
        required: [true, 'Discount type is required']
    },
    discountValue: {
        type: Number,
        required: [true, 'Discount value is required'],
        min: [0.01, 'Discount value must be greater than 0']
    },
    maxDiscountAmount: {
        type: Number,
        default: 0,
        min: [0, 'Maximum discount amount cannot be negative']
    },
    minimumOrderAmount: {
        type: Number,
        default: 0,
        min: [0, 'Minimum order amount cannot be negative']
    },
    usageCount: {
        type: Number,
        required: [true, 'Coupon usage limit is required'],
        min: [1, 'Usage count must be at least 1'],
        max: [5, 'Usage count cannot exceed 5']
    },
    timesUsed: {
        type: Number,
        default: 0,
        min: [0, 'Times used cannot be negative']
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required']
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Case-insensitive index on code
couponSchema.index({ code: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('Coupon', couponSchema);


