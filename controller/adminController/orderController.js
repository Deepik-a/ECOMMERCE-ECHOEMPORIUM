const Order = require('../../model/orderSchema'); // Assuming you have an Order model
const Product = require('../../model/productSchema'); // Assuming you have a Product model for stock management
const mongoose = require('mongoose');




// List all orders with pagination, search, and filter
const listOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const statusFilter = req.query.status || '';

        // Build query
        let query = {};
        if (statusFilter) {
            query.status = statusFilter;
        }
        if (search) {
            query.$or = [
                { orderId: { $regex: search, $options: 'i' } }
            ];
        }

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .populate('items.productId', 'name imgArray')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Summary stats
        const allStatusCounts = await Order.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const statusCounts = {};
        allStatusCounts.forEach(s => { statusCounts[s._id] = s.count; });

        res.render('admin/order', {
            orders,
            currentPage: page,
            totalPages,
            totalOrders,
            search,
            statusFilter,
            statusCounts
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Error fetching orders');
    }
};


// Change order status
const changeProductStatus = async (req, res) => {
    const { orderId, productId, status } = req.body;

    try {
        // Define status transitions
        const statusTransitions = {
            'Pending': ['Shipped', 'Confirmed'],
            'Confirmed': ['Delivered', 'Cancelled'],
            'Shipped': ['Delivered', 'Returned'],
            'Delivered': [],
            'Cancelled': [],
            'Returned': []
        };

        // Find the order and populate product details to ensure full data
        const order = await Order.findById(orderId).populate('items.productId');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Find the specific item in the order
        const itemIndex = order.items.findIndex(item => 
            item.productId._id.toString() === productId
        );

        // Validate item exists
        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Product not found in order' });
        }

        // Current product item
        const currentItem = order.items[itemIndex];

        // Check if the status transition is valid
        const validTransitions = statusTransitions[currentItem.status] || [];
        if (!validTransitions.includes(status)) {
            return res.status(400).json({ 
                message: `Invalid status transition from ${currentItem.status} to ${status}` 
            });
        }

        // Update the individual product status
        currentItem.status = status;

        // Optional: Update overall order status based on individual product statuses
        const allStatuses = order.items.map(item => item.status);
        const isAllDelivered = allStatuses.every(s => s === 'Delivered');
        const isAllCancelled = allStatuses.every(s => s === 'Cancelled');

        if (isAllDelivered) {
            order.status = 'Delivered';
        } else if (isAllCancelled) {
            order.status = 'Cancelled';
        }

        // Save the updated order
        await order.save();

        // Redirect or send response
        res.redirect('/admin/orders');
    } catch (error) {
        console.error('Error updating product status:', error);
        res.status(500).json({ 
            message: 'Error updating product status', 
            error: error.message 
        });
    }
};

// Cancel order and restore stock
const cancelOrder = async (req, res) => {
    const { orderId } = req.body;
    try {
        const order = await Order.findById(orderId);
        if (order) {
            // Update stock for each canceled item
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.productId, {
                    $inc: { stock: item.productCount }
                });
            }
            order.isCancel = true; // Set the order as canceled
            order.status = 'Cancelled'; // Update status to 'Cancelled'
            await order.save();
            res.redirect(`/admin/orders/${orderId}`);
        } else {
            res.status(404).send('Order not found');
        }
    } catch (error) {
        console.error('Error canceling order:', error);
        res.status(500).send('Error canceling order');
    }
};




// List products and inventory
const listInventory = async (req, res) => {
    try {
        const products = await Product.find();
        res.render('admin/inventory', { products }); // Render inventory to the admin page
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).send('Error fetching inventory');
    }
};

// Update product stock
const updateStock = async (req, res) => {
    const { productId, stock } = req.body;
    try {
        const product = await Product.findById(productId);
        if (product) {
            product.stock = stock; // Update stock value
            await product.save();
            res.redirect('/admin/inventory');
        } else {
            res.status(404).send('Product not found');
        }
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).send('Error updating stock');
    }
};



// Controller to view order details
const viewOrderDetails = async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await Order.findById(orderId).populate('userId', 'name email') // Get user details
            .populate({
                path: 'items.productId',
                select: 'name price image' // Adjust these fields based on your product schema
            });

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Render the order details EJS template
        res.render('admin/orderDetail', { order });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};





module.exports={
    listOrders,
    changeProductStatus,
    cancelOrder,
    listInventory ,
    updateStock ,
    viewOrderDetails
}