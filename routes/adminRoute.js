const express=require('express')
const admin=express.Router()
const adminController=require('../controller/adminController/adminController')
const userController=require('../controller/adminController/usercontroller')
const categoryController = require('../controller/adminController/categoryController');
const  productController = require('../controller/adminController/productController');
const uploads = require('../middleware/multer');
const couponController = require('../controller/adminController/couponController');
const orderController = require('../controller/adminController/orderController');
const offerController = require('../controller/adminController/offerController');
const  saleController=require('../controller/adminController/salesController')


const isAdmin = require('../middleware/adminSession');



//--------------------------------admin authentication & dashboard----------------------------
admin.get('/', (req, res) => res.redirect('/admin/dashboard'));
admin.get('/index.html', (req, res) => res.redirect('/admin/dashboard'));
admin.get('/login', adminController.admin);
admin.post('/login', adminController.adminloginpost);
admin.get('/logout', adminController.logout);
admin.get('/dashboard', isAdmin, adminController.getDashboard);
admin.get('/dashboard-data', isAdmin, adminController.getDashboardData);



//--------------------------------UserManagment----------------------------
admin.get('/users',isAdmin,adminController.listuser)
admin.get('/block/:id',isAdmin,adminController.blockUser)
admin.get('/unblock/:ideee',isAdmin,adminController.unblockUser)


//--------------------------------CategoryManagment----------------------------
admin.get('/addCategory', isAdmin, adminController.getCategories);
admin.post('/addCategory', isAdmin, categoryController.addCategory);
admin.get('/editCategory', isAdmin, (req, res) => res.redirect('/admin/categories'));
admin.get('/editCategory/:id', isAdmin, categoryController.renderEditCategoryForm);
admin.post('/editCategory/:id', isAdmin, categoryController.editCategory);
admin.post('/categories/:id/edit', isAdmin, categoryController.editCategory);
admin.post('/categories/:id/block', isAdmin, categoryController.blockCategory);
admin.post('/categories/:id/unblock', isAdmin, categoryController.unblockCategory);
admin.post('/categories/:id/delete', isAdmin, categoryController.deleteCategory);
admin.delete('/categories/:id', isAdmin, categoryController.deleteCategory);
admin.get('/categories', isAdmin, categoryController.geteditCategories);
admin.get('/api/categories', isAdmin, categoryController.getCategoriesForUser);


// //--------------------------------ProductManagment----------------------------
//admin.get('/addProduct', isAdmin,productController.getProduct);
// admin.post('/addProduct', multerUpload,productController.addProduct);
// admin.post('/addProduct',isAdmin,productController.addProduct);
//admin.get('/editProduct', isAdmin,productController.geteditProduct);
// admin.post('/editProduct/:id',isAdmin, productController.editProduct);
// admin.delete('/remove-image',isAdmin,productController.Imageremove)
//admin.post('/listProduct/:id', isAdmin,productController.listProduct);
//admin.post('/unlistProduct/:id',isAdmin, productController.unlistProduct);
//admin.post('/products/:id/block',isAdmin,productController.BlockUnblock);
//admin.get('/updateproduct/:id',isAdmin,productController.getUpdateProduct);
//admin.post('/updateproduct/:id',isAdmin,uploads,productController.postEditProduct);

// --- Product Management ---
admin.get('/products', isAdmin, productController.getAllProducts);
admin.get('/addproduct', isAdmin, productController.getAddProduct);
admin.post('/addproduct', isAdmin, uploads, productController.postAddProduct);
admin.post('/products/:id/block', isAdmin, productController.BlockUnblock);
admin.post('/products/:id/delete', isAdmin, productController.deleteProduct);
admin.delete('/products/:id', isAdmin, productController.deleteProduct);
admin.get('/updateproduct/:id', isAdmin, productController.getUpdateProduct);
admin.post('/updateproduct/:id', isAdmin, uploads, productController.postEditProduct);


//--------------------------------Order Management Routes----------------------------


admin.get('/orders', isAdmin, orderController.listOrders);
admin.post('/orders/item-status', isAdmin, orderController.changeProductStatus)
admin.post('/orders/cancel', isAdmin, orderController.cancelOrder);
// Route to view order details
admin.get('/orders/:orderId', isAdmin, orderController.viewOrderDetails);


//-------------------------------- Inventory Management Routes---------------------------------



admin.get('/inventory', orderController.listInventory);
admin.post('/inventory/update', orderController.updateStock);



admin.get('/coupons/:id?', isAdmin, couponController.getCoupons);
admin.post('/addcoupon', isAdmin, couponController.addCoupon);
admin.post('/editcoupon/:id', isAdmin, couponController.editCoupon);
admin.get('/statuscoupon', isAdmin, couponController.toggleCouponStatus);
admin.delete('/deletecoupon/:id', isAdmin, couponController.deleteCoupon);


//-------------------------------- Offer Management---------------------------------


admin.get('/offer-management',isAdmin, offerController.getOffers);
admin.post('/offer-management',isAdmin, offerController.addOffer);
admin.put('/offer-management/:offerId',isAdmin, offerController.editOffer);
admin.post('/offer/:offerId/block',isAdmin, offerController.blockUnblock);
admin.delete('/offer-management/:offerId',isAdmin, offerController.deleteOffer);


//------------------------------------------sales-----------------------------------------------------


admin.get('/salesReport',isAdmin,saleController.sales)
admin.get('/salesReoprtView',isAdmin,saleController.salesReoprtView);
admin.get('/exportReport',isAdmin,saleController.exportReport)






module.exports=admin