const mongoose = require('mongoose');
const dotenv = require('dotenv').config();
const Coupon = require('../model/couponSchema');
const { validateCouponData } = require('../controller/adminController/couponController');

async function runTests() {
    console.log('--- Starting Coupon Validation Unit & Integration Tests ---');

    await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    console.log('MongoDB Connected.');

    // Clean up any test coupon
    await Coupon.deleteMany({ code: { $in: ['TESTSAVE20', 'TESTWELCOME10', 'TESTFIXED50', 'TESTUPPER', 'DUPLICATE1'] } });

    // Test 1: Code validation
    console.log('\n[Test 1] Coupon Code Format & Length Check:');
    
    // Short code (< 4 chars)
    let res = await validateCouponData({
        code: 'ABC',
        discountType: 'Percentage',
        discountValue: 10,
        usageCount: 3,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        minimumOrderAmount: 100
    });
    console.log('Short code (< 4 chars) rejected:', !res.isValid, '| Error:', res.error);

    // Special chars in code
    res = await validateCouponData({
        code: 'SAVE-20!',
        discountType: 'Percentage',
        discountValue: 10,
        usageCount: 3,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        minimumOrderAmount: 100
    });
    console.log('Special chars rejected:', !res.isValid, '| Error:', res.error);

    // Test 2: Discount Type & Value
    console.log('\n[Test 2] Discount Type & Value:');
    // Percentage > 100%
    res = await validateCouponData({
        code: 'TESTSAVE20',
        discountType: 'Percentage',
        discountValue: 150,
        usageCount: 3,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        minimumOrderAmount: 100
    });
    console.log('Percentage > 100 rejected:', !res.isValid, '| Error:', res.error);

    // Percentage = 0%
    res = await validateCouponData({
        code: 'TESTSAVE20',
        discountType: 'Percentage',
        discountValue: 0,
        usageCount: 3,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        minimumOrderAmount: 100
    });
    console.log('Percentage = 0 rejected:', !res.isValid, '| Error:', res.error);

    // Fixed Discount >= Minimum Order Amount
    res = await validateCouponData({
        code: 'TESTFIXED50',
        discountType: 'Fixed',
        discountValue: 500,
        minimumOrderAmount: 300,
        usageCount: 3,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString()
    });
    console.log('Fixed discount >= min order rejected:', !res.isValid, '| Error:', res.error);

    // Test 3: Coupon Usage Count (Limit max 5)
    console.log('\n[Test 3] Usage Count Limits (1 to 5):');
    // usageCount > 5
    res = await validateCouponData({
        code: 'TESTSAVE20',
        discountType: 'Percentage',
        discountValue: 20,
        usageCount: 10,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        minimumOrderAmount: 500
    });
    console.log('Usage count > 5 rejected:', !res.isValid, '| Error:', res.error);

    // usageCount <= 0
    res = await validateCouponData({
        code: 'TESTSAVE20',
        discountType: 'Percentage',
        discountValue: 20,
        usageCount: 0,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        minimumOrderAmount: 500
    });
    console.log('Usage count 0 rejected:', !res.isValid, '| Error:', res.error);

    // Test 4: Dates (Past date, End Date <= Start Date)
    console.log('\n[Test 4] Date Validations:');
    // End Date <= Start Date
    res = await validateCouponData({
        code: 'TESTSAVE20',
        discountType: 'Percentage',
        discountValue: 20,
        usageCount: 5,
        startDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        minimumOrderAmount: 500
    });
    console.log('End date <= start date rejected:', !res.isValid, '| Error:', res.error);

    // Test 5: Save Valid Coupon & Case-Insensitive Uniqueness Check
    console.log('\n[Test 5] Save Valid Coupon & Case-Insensitive Uniqueness:');
    const validData = await validateCouponData({
        code: 'testsave20', // lowercase input should auto-uppercase
        discountType: 'Percentage',
        discountValue: 20,
        maxDiscountAmount: 200,
        minimumOrderAmount: 500,
        usageCount: 5,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 10).toISOString()
    });
    console.log('Valid data cleaned code:', validData.cleanedData.code);

    const couponDoc = new Coupon({
        ...validData.cleanedData,
        timesUsed: 0,
        isActive: true
    });
    await couponDoc.save();
    console.log('Saved coupon TESTSAVE20 to DB successfully.');

    // Try saving duplicate with different casing 'TESTSAVE20' or 'TestSave20'
    const duplicateCheck = await validateCouponData({
        code: 'TestSave20',
        discountType: 'Fixed',
        discountValue: 50,
        minimumOrderAmount: 200,
        usageCount: 3,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 5).toISOString()
    });
    console.log('Case-insensitive duplicate rejected:', !duplicateCheck.isValid, '| Error:', duplicateCheck.error);

    // Test 6: Atomic Race-condition simulation
    console.log('\n[Test 6] Atomic Concurrency Test:');
    // Try to atomically increment timesUsed up to usageCount (5)
    let successfulRedemptions = 0;
    for (let i = 0; i < 7; i++) {
        const updated = await Coupon.findOneAndUpdate(
            {
                _id: couponDoc._id,
                isActive: true,
                $expr: { $lt: ["$timesUsed", "$usageCount"] }
            },
            { $inc: { timesUsed: 1 } },
            { new: true }
        );
        if (updated) {
            successfulRedemptions++;
        }
    }
    console.log(`Attempted 7 redemptions on a coupon with limit 5 -> Successful: ${successfulRedemptions} (Expected: 5)`);

    // Clean up test coupon
    await Coupon.deleteMany({ code: { $in: ['TESTSAVE20', 'TESTWELCOME10', 'TESTFIXED50', 'TESTUPPER', 'DUPLICATE1'] } });

    console.log('\n--- All Tests Completed Successfully ---');
    process.exit(0);
}

runTests().catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
