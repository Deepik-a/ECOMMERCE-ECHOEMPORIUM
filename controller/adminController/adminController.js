const userSchema = require('../../model/userSchema');
const categorySchema = require('../../model/categorySchema');
const Order = require('../../model/orderSchema');
const Product = require('../../model/productSchema');

const admin = (req, res) => {
    try {
        if (req.session && req.session.admin) {
            return res.redirect('/admin/dashboard');
        }
        res.render('admin/login', { error: null });
    } catch (error) {
        console.error(`Error while rendering admin login: ${error}`);
        res.render('admin/login', { error: 'Unable to load login page' });
    }
};

const adminloginpost = async (req, res) => {
    try {
        const email = (req.body.email || '').trim();
        const password = (req.body.password || '').trim();

        if (!email || !password) {
            return res.render('admin/login', { error: 'Please provide both email and password.' });
        }

        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            req.session.admin = email;
            // Explicitly save the session to guarantee persistence before redirecting
            return req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                }
                res.redirect('/admin/dashboard');
            });
        }

        res.render('admin/login', { error: 'Invalid Email or Password. Please try again.' });
    } catch (error) {
        console.error(`Error in admin login: ${error}`);
        res.render('admin/login', { error: 'An unexpected error occurred during login' });
    }
};

const logout = (req, res) => {
    try {
        req.session.admin = null;
        req.session.destroy((err) => {
            if (err) console.error('Error destroying admin session:', err);
            res.clearCookie('connect.sid');
            res.redirect('/admin/login');
        });
    } catch (error) {
        console.error('Error in logout:', error);
        res.redirect('/admin/login');
    }
};

// Helper: Fetch Time Series Sales Data
const fetchTimeSeriesData = async (filter = 'monthly') => {
    const matchStage = { status: { $nin: ['Cancelled', 'Returned'] } };
    let groupId = {};
    const now = new Date();

    if (filter === 'daily') {
        const d = new Date(now);
        d.setDate(d.getDate() - 14);
        matchStage.createdAt = { $gte: d };
        groupId = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    } else if (filter === 'weekly') {
        const d = new Date(now);
        d.setDate(d.getDate() - 70);
        matchStage.createdAt = { $gte: d };
        groupId = { $dateToString: { format: '%Y-W%V', date: '$createdAt' } };
    } else if (filter === 'yearly') {
        groupId = { $dateToString: { format: '%Y', date: '$createdAt' } };
    } else {
        // monthly
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 1);
        matchStage.createdAt = { $gte: d };
        groupId = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
    }

    const rawData = await Order.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: groupId,
                revenue: { $sum: '$totalPrice' },
                orders: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const labels = rawData.map(item => item._id);
    const revenueData = rawData.map(item => Math.round(item.revenue * 100) / 100);
    const orderData = rawData.map(item => item.orders);

    return { labels, revenueData, orderData };
};

// Controller: Render Admin Dashboard with Real-Time Data
const getDashboard = async (req, res) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

        // 1. Core Summary Stats
        const [
            totalRevenueAgg,
            todayRevenueAgg,
            monthlyRevenueAgg,
            totalOrders,
            todayOrders,
            pendingOrders,
            deliveredOrders,
            totalProductsSoldAgg,
            totalCustomers,
            activeCustomers,
            totalProducts,
            outOfStockProducts,
            totalCategories,
            totalDiscountAgg
        ] = await Promise.all([
            // Total Revenue
            Order.aggregate([
                { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
                { $group: { _id: null, total: { $sum: '$totalPrice' } } }
            ]),
            // Today Revenue
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfToday, $lte: endOfToday }, status: { $nin: ['Cancelled', 'Returned'] } } },
                { $group: { _id: null, total: { $sum: '$totalPrice' } } }
            ]),
            // Monthly Revenue
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfMonth }, status: { $nin: ['Cancelled', 'Returned'] } } },
                { $group: { _id: null, total: { $sum: '$totalPrice' } } }
            ]),
            // Order Counts
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: startOfToday, $lte: endOfToday } }),
            Order.countDocuments({ status: 'Pending' }),
            Order.countDocuments({ status: 'Delivered' }),
            // Total Units Sold
            Order.aggregate([
                { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
                { $unwind: '$items' },
                { $match: { 'items.status': { $nin: ['Cancelled', 'Returned'] } } },
                { $group: { _id: null, total: { $sum: '$items.productCount' } } }
            ]),
            // Customers
            userSchema.countDocuments(),
            userSchema.countDocuments({ isBlocked: false }),
            // Products & Categories
            Product.countDocuments({ isActive: true }),
            Product.countDocuments({ stock: { $lte: 0 } }),
            categorySchema.countDocuments({ isDeleted: false }),
            // Discounts
            Order.aggregate([
                { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
                { $group: { _id: null, total: { $sum: '$couponDiscount' } } }
            ])
        ]);

        const summary = {
            totalRevenue: Math.round((totalRevenueAgg[0]?.total || 0) * 100) / 100,
            todayRevenue: Math.round((todayRevenueAgg[0]?.total || 0) * 100) / 100,
            monthlyRevenue: Math.round((monthlyRevenueAgg[0]?.total || 0) * 100) / 100,
            totalOrders,
            todayOrders,
            pendingOrders,
            deliveredOrders,
            totalProductsSold: totalProductsSoldAgg[0]?.total || 0,
            totalCustomers,
            activeCustomers,
            totalProducts,
            outOfStockProducts,
            totalCategories,
            totalDiscount: Math.round((totalDiscountAgg[0]?.total || 0) * 100) / 100
        };

        // 2. Order Status Breakdown
        const orderStatusAgg = await Order.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const orderStatusMap = {};
        orderStatusAgg.forEach(item => {
            orderStatusMap[item._id] = item.count;
        });

        // 3. Category Sales Distribution
        const categorySalesAgg = await Order.aggregate([
            { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
            { $unwind: '$items' },
            { $match: { 'items.status': { $nin: ['Cancelled', 'Returned'] } } },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'product.category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: { $ifNull: ['$category.name', 'Uncategorized'] },
                    totalSold: { $sum: '$items.productCount' },
                    totalRevenue: { $sum: { $multiply: ['$items.productPrice', '$items.productCount'] } }
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 6 }
        ]);

        // 4. Top 10 Best Selling Products
        const topProducts = await Order.aggregate([
            { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
            { $unwind: '$items' },
            { $match: { 'items.status': { $nin: ['Cancelled', 'Returned'] } } },
            {
                $group: {
                    _id: '$items.productId',
                    totalSold: { $sum: '$items.productCount' },
                    totalRevenue: { $sum: { $multiply: ['$items.productPrice', '$items.productCount'] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'product.category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
        ]);

        // 5. Top 10 Best Selling Categories
        const topCategories = await Order.aggregate([
            { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
            { $unwind: '$items' },
            { $match: { 'items.status': { $nin: ['Cancelled', 'Returned'] } } },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'product.category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$category._id',
                    name: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
                    totalSold: { $sum: '$items.productCount' },
                    totalRevenue: { $sum: { $multiply: ['$items.productPrice', '$items.productCount'] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);

        // 6. Recent 8 Orders
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(8)
            .populate('userId', 'name email')
            .populate('items.productId', 'name imgArray');

        // 7. Initial Sales Chart Data (Monthly)
        const initialSalesChart = await fetchTimeSeriesData('monthly');

        res.render('admin/dashboard', {
            summary,
            initialSalesChart,
            orderStatusMap,
            categorySales: categorySalesAgg,
            topProducts,
            topCategories,
            recentOrders
        });
    } catch (error) {
        console.error('Error rendering admin dashboard:', error);
        res.status(500).send('Error loading admin dashboard: ' + error.message);
    }
};

// API: Real-time Dashboard Data (Time series filter / live refresh)
const getDashboardData = async (req, res) => {
    try {
        const filter = req.query.filter || 'monthly';
        const salesChart = await fetchTimeSeriesData(filter);
        res.status(200).json({
            success: true,
            filter,
            salesChart
        });
    } catch (error) {
        console.error('Error fetching dashboard chart data:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const blockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        await userSchema.findByIdAndUpdate(userId, { isBlocked: true });
        res.redirect('/admin/users');
    } catch (err) {
        res.status(500).json({ message: 'Error blocking user' });
    }
};

const unblockUser = async (req, res) => {
    try {
        const userId = req.params.ideee;
        await userSchema.findByIdAndUpdate(userId, { isBlocked: false });
        res.redirect('/admin/users');
    } catch (err) {
        res.status(500).json({ message: 'Error unblocking user' });
    }
};

const listuser = async (req, res) => {
    try {
        const users = await userSchema.find();
        res.render('admin/usermanagment', { users });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching user' });
    }
};

const getCategories = async (req, res) => {
    try {
        const categories = await categorySchema.find({ isDeleted: false });
        res.render('admin/Category', { categories, error: '' });
    } catch (error) {
        res.render('admin/Category', { error: 'Error fetching categories', categories: [] });
    }
};

module.exports = {
    admin,
    adminloginpost,
    logout,
    getDashboard,
    getDashboardData,
    listuser,
    unblockUser,
    blockUser,
    getCategories
};