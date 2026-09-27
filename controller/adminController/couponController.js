const Coupon = require('../../model/couponSchema');

/**
 * Helper: Validate Coupon Data server-side
 * @param {Object} data - Request body containing coupon details
 * @param {boolean} isEdit - Whether it is an update operation
 * @param {string|null} existingCouponId - ID of coupon being edited
 * @returns {Promise<{ isValid: boolean, error?: string, cleanedData?: Object }>}
 */
const validateCouponData = async (data, isEdit = false, existingCouponId = null) => {
    let { code, discountType, discountValue, maxDiscountAmount, startDate, endDate, minimumOrderAmount, usageCount } = data;

    // 1. Validate Code
    if (!code || typeof code !== 'string') {
        return { isValid: false, error: 'Coupon code is required.' };
    }
    code = code.trim().toUpperCase();

    // Uppercase alphanumeric only, min 4 max 20 chars
    const codeRegex = /^[A-Z0-9]{4,20}$/;
    if (!codeRegex.test(code)) {
        return {
            isValid: false,
            error: 'Coupon code must be uppercase alphanumeric (A-Z, 0-9) without spaces or special characters, and between 4 and 20 characters.'
        };
    }

    // Case-insensitive uniqueness check against DB
    const duplicateQuery = {
        code: new RegExp(`^${code}$`, 'i')
    };
    if (isEdit && existingCouponId) {
        duplicateQuery._id = { $ne: existingCouponId };
    }
    const duplicate = await Coupon.findOne(duplicateQuery);
    if (duplicate) {
        return { isValid: false, error: `Coupon code "${code}" already exists.` };
    }

    // 2. Validate Discount Type
    const allowedTypes = ['Percentage', 'Fixed'];
    if (!discountType || !allowedTypes.includes(discountType)) {
        return { isValid: false, error: "Discount type must be either 'Percentage' or 'Fixed'." };
    }

    // 3. Validate Discount Value
    discountValue = parseFloat(discountValue);
    if (isNaN(discountValue) || discountValue <= 0) {
        return { isValid: false, error: 'Discount value must be a valid positive number.' };
    }

    // 4. Validate Minimum Order Amount
    minimumOrderAmount = parseFloat(minimumOrderAmount);
    if (isNaN(minimumOrderAmount) || minimumOrderAmount < 0) {
        minimumOrderAmount = 0;
    }

    // Type specific checks
    if (discountType === 'Percentage') {
        if (discountValue < 1 || discountValue > 100) {
            return { isValid: false, error: 'Percentage discount must be between 1% and 100%.' };
        }
        maxDiscountAmount = parseFloat(maxDiscountAmount) || 0;
        if (maxDiscountAmount < 0) {
            return { isValid: false, error: 'Maximum discount amount cannot be negative.' };
        }
    } else if (discountType === 'Fixed') {
        maxDiscountAmount = 0;
        // Cross-field check: minimumOrderAmount should be greater than fixed discount value
        if (minimumOrderAmount <= discountValue) {
            return {
                isValid: false,
                error: `For Fixed discount (₹${discountValue}), Minimum Order Amount must be greater than ₹${discountValue} so the discount does not exceed the order total.`
            };
        }
    }

    // 5. Validate Usage Count
    usageCount = parseInt(usageCount, 10);
    if (isNaN(usageCount) || usageCount < 1 || usageCount > 5) {
        return { isValid: false, error: 'Coupon usage count must be a positive integer between 1 and 5.' };
    }

    // 6. Validate Dates
    if (!startDate || !endDate) {
        return { isValid: false, error: 'Both Start Date and End Date are required.' };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
        return { isValid: false, error: 'Start Date is not a valid date.' };
    }
    if (isNaN(end.getTime())) {
        return { isValid: false, error: 'End Date is not a valid date.' };
    }

    // Compare with today (midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startMidnight = new Date(start);
    startMidnight.setHours(0, 0, 0, 0);

    const endMidnight = new Date(end);
    endMidnight.setHours(23, 59, 59, 999);

    if (!isEdit && startMidnight < today) {
        return { isValid: false, error: 'Start Date cannot be in the past.' };
    }

    if (endMidnight < today) {
        return { isValid: false, error: 'End Date cannot be in the past.' };
    }

    // Cross-field check: End Date must be after Start Date
    if (end < start || endMidnight.getTime() <= startMidnight.getTime()) {
        return { isValid: false, error: 'End Date must be after the Start Date.' };
    }

    return {
        isValid: true,
        cleanedData: {
            code,
            discountType,
            discountValue,
            maxDiscountAmount,
            minimumOrderAmount,
            usageCount,
            startDate: startMidnight,
            endDate: endMidnight
        }
    };
};

//------------------------------------- Get all coupons ---------------------------

const getCoupons = async (req, res) => {
    const search = (req.query.search || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;
    const skip = (page - 1) * limit;

    try {
        if (req.params.id) {
            const coupon = await Coupon.findById(req.params.id);
            if (!coupon) {
                return res.status(404).json({ success: false, message: 'Coupon not found' });
            }
            return res.json(coupon);
        }

        const filter = search ? { code: { $regex: search, $options: 'i' } } : {};

        const coupons = await Coupon.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const count = await Coupon.countDocuments(filter);
        const totalPages = Math.ceil(count / limit) || 1;

        res.render('admin/coupons', {
            coupons,
            title: 'Coupon Management',
            currentPage: page,
            totalPages,
            search
        });
    } catch (error) {
        console.error(`Error while fetching coupons: ${error}`);
        res.status(500).json({ success: false, message: 'Error fetching coupon data' });
    }
};

//--------------------------------- Add a new coupon -----------------------------

const addCoupon = async (req, res) => {
    try {
        const validation = await validateCouponData(req.body, false);
        if (!validation.isValid) {
            return res.status(400).json({ success: false, message: validation.error });
        }

        const newCoupon = new Coupon({
            ...validation.cleanedData,
            timesUsed: 0,
            isActive: true
        });

        await newCoupon.save();
        res.status(201).json({ success: true, message: 'Coupon created successfully!' });
    } catch (error) {
        console.error('Error adding coupon:', error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Coupon code already exists.' });
        }
        res.status(500).json({ success: false, message: error.message || 'Error adding coupon.' });
    }
};

//------------------------------------- Edit a coupon ----------------------------

const editCoupon = async (req, res) => {
    try {
        const couponId = req.params.id || req.body.id;
        if (!couponId) {
            return res.status(400).json({ success: false, message: 'Coupon ID is required.' });
        }

        const existingCoupon = await Coupon.findById(couponId);
        if (!existingCoupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found.' });
        }

        const validation = await validateCouponData(req.body, true, couponId);
        if (!validation.isValid) {
            return res.status(400).json({ success: false, message: validation.error });
        }

        existingCoupon.code = validation.cleanedData.code;
        existingCoupon.discountType = validation.cleanedData.discountType;
        existingCoupon.discountValue = validation.cleanedData.discountValue;
        existingCoupon.maxDiscountAmount = validation.cleanedData.maxDiscountAmount;
        existingCoupon.minimumOrderAmount = validation.cleanedData.minimumOrderAmount;
        existingCoupon.usageCount = validation.cleanedData.usageCount;
        existingCoupon.startDate = validation.cleanedData.startDate;
        existingCoupon.endDate = validation.cleanedData.endDate;

        await existingCoupon.save();
        res.status(200).json({ success: true, message: 'Coupon updated successfully!' });
    } catch (error) {
        console.error('Error updating coupon:', error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Coupon code already exists.' });
        }
        res.status(500).json({ success: false, message: error.message || 'Error updating coupon.' });
    }
};

//----------------------------- Toggle coupon status ----------------------------

const toggleCouponStatus = async (req, res) => {
    try {
        const couponId = req.query.id;
        if (!couponId) {
            return res.redirect('/admin/coupons');
        }

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.redirect('/admin/coupons');
        }

        coupon.isActive = !coupon.isActive;
        await coupon.save();

        res.redirect('/admin/coupons');
    } catch (error) {
        console.error(`Error toggling coupon status: ${error}`);
        res.redirect('/admin/coupons');
    }
};

//--------------------------------- Delete a coupon ------------------------------

const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Coupon ID is required' });
        }

        const deleted = await Coupon.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ success: false, message: 'Error deleting coupon' });
    }
};

module.exports = {
    getCoupons,
    addCoupon,
    editCoupon,
    toggleCouponStatus,
    deleteCoupon,
    validateCouponData
};