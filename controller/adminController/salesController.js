const Order = require('../../model/orderSchema')
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit-table');



const applyDateFilter = (filter) => {
    const now = new Date();
    let dateFilter = {};
  
    if (filter === 'day') {
      dateFilter.createdAt = {
        $gte: new Date(now.setHours(0, 0, 0, 0)),
        $lt: new Date(now.setHours(23, 59, 59, 999)),
      };
    } else if (filter === 'week') {
      const startOfWeek = new Date(now);
      const dayOfWeek = now.getDay(); 
      const distanceToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1); 
     
      startOfWeek.setDate(now.getDate() - distanceToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
  
      // Set end of the week 
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
  
      dateFilter.createdAt = { $gte: startOfWeek, $lt: endOfWeek };
    } else if (filter === 'month') {
      dateFilter.createdAt = {
        $gte: new Date(now.getFullYear(), now.getMonth(), 1), // Start of month
        $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1), // Start of next month
      };
    } else if (filter === 'year') {
      dateFilter.createdAt = {
        $gte: new Date(now.getFullYear(), 0, 1), // Start of year
        $lt: new Date(now.getFullYear(), 12, 31), // End of year
      };
    }
  
    return dateFilter;  
  };
  exports.sales = async (req, res) => {
    try {
        const filter = req.query.filter || ''; 
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        console.log("page = ", page);
        console.log("limit = ", limit);

        let queryCondition = {status: {$in: ["Pending", "Paid", "Delivered", "Shipped"]}}; // Ensure initial condition for paid orders

        // If a filter is provided, apply it to the query condition
        if (filter) {
            const dateFilter = applyDateFilter(filter);
            queryCondition = { ...queryCondition, ...dateFilter };
        }

        // Fetch the filtered sales data with pagination and virtuals
        const salesData = await Order.find(queryCondition)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('items.productId');  // Populate product data if needed

        const totalRecords = await Order.countDocuments(queryCondition);

        // Fetch all sales data to calculate totals
        const totSalesData = await Order.find(queryCondition).populate('items.productId');

        // Calculate the total order amount from the virtual field `totalPrice`
        let orderAmount = totSalesData.reduce((tot, val) => {
            return tot += val.totalPrice;
        }, 0);

        // Calculate the total coupon discount
        let totalCouponDiscount = totSalesData.reduce((tot, val) => {
            return Math.abs(tot += val.couponDiscount);
        }, 0);

        // Calculate the total sales count
        let totalSalesCount = totSalesData.length;

        console.log("Total sales count: ", totalSalesCount);
        console.log("Order amount: ", orderAmount);

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({
                data: salesData,
                currentPage: page,
                totalPages: Math.ceil(totalRecords / limit),
                totalRecordsCount: totalRecords,
                overallSalesCount: totalSalesCount,
                overallOrderAmount: orderAmount,
                totalCouponDiscount: totalCouponDiscount
            });
        } else {
            res.render('admin/salesReport', {
                data: salesData,
                currentPage: page,
                totalPages: Math.ceil(totalRecords / limit),
                totalRecordsCount: totalRecords,
                overallSalesCount: totalSalesCount,
                overallOrderAmount: orderAmount,
                totalCouponDiscount: totalCouponDiscount
            });
        }
    } catch (error) {
        console.error('Error while rendering the sales report:', error);

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ message: 'Server Error', error: error.message });
        } else {
            res.status(500).render('error', { message: 'Server Error', error });
        }
    }
};


  
  exports.exportReport = async (req, res) => {
    try {
        const filter = req.query.filter || '';
        const format = req.query.format;
        console.log(`filter = ${filter}`);
        console.log(`format = ${format}`);

        let queryCondition = {};

        if (filter) {
            const dateFilter = applyDateFilter(filter);
            queryCondition = { ...queryCondition, ...dateFilter };
        }

        const salesData = await Order.find(queryCondition).sort({ createdAt: -1 });
        console.log(`salesData = ${salesData}`);

        if (format === 'excel') {
            console.log('Generating Excel report');
            const worksheetData = salesData.map(data => ({
                OrderID: data.orderId || (data._id ? data._id.toString().slice(-8) : 'N/A'),
                OrderDate: new Date(data.createdAt).toLocaleDateString('en-GB'),
                OrderAmount: `₹${(data.totalPrice || 0).toFixed(2)}`,
                CouponDeduction: `₹${(data.couponDiscount || 0).toFixed(2)}`,
                PaymentStatus: data.status || 'Pending',
                PaymentMethod: data.paymentMethod || 'N/A',
            }));

            // Create worksheet and workbook
            const worksheet = xlsx.utils.json_to_sheet(worksheetData);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Sales Report');

            const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Disposition', 'attachment; filename="EchoEmporium_SalesReport.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(excelBuffer);
        } 
        else if (format === 'pdf') {
            console.log('Generating PDF report for Echo Emporium');
            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            res.setHeader('Content-Disposition', 'attachment; filename="EchoEmporium_SalesReport.pdf"');
            res.setHeader('Content-Type', 'application/pdf');
            doc.pipe(res);

            // Document Header / Branding
            doc.fontSize(22).font('Helvetica-Bold').fillColor('#1e3a8a').text('Echo Emporium', { align: 'center' });
            doc.fontSize(14).font('Helvetica').fillColor('#4b5563').text('Sales & Revenue Report', { align: 'center' });
            doc.moveDown(0.5);

            const filterLabel = filter ? (filter.charAt(0).toUpperCase() + filter.slice(1)) : 'All Time';
            doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
                .text(`Filter: ${filterLabel} | Generated On: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, { align: 'center' });
            doc.moveDown(1);

            const totalOrders = salesData.length;
            const totalRevenue = salesData.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
            const totalDiscount = salesData.reduce((acc, curr) => acc + (curr.couponDiscount || 0), 0);

            // Summary Highlights Box
            const summaryBoxY = doc.y;
            doc.rect(30, summaryBoxY, 535, 28).fillAndStroke('#f3f4f6', '#e5e7eb');
            doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9)
                .text(`Total Orders: ${totalOrders}`, 45, summaryBoxY + 9)
                .text(`Total Revenue: ₹${totalRevenue.toFixed(2)}`, 210, summaryBoxY + 9)
                .text(`Total Discounts: ₹${totalDiscount.toFixed(2)}`, 385, summaryBoxY + 9);
            doc.moveDown(1.8);

            const tableRows = salesData.map((data) => {
                const userIdStr = data.userId ? data.userId.toString() : 'N/A';
                const truncatedUserId = userIdStr.length > 10 ? `${userIdStr.slice(0, 4)}...${userIdStr.slice(-4)}` : userIdStr;
                return [
                    data.orderId || (data._id ? data._id.toString().slice(-8) : 'N/A'),
                    truncatedUserId,
                    new Date(data.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                    `₹${(data.totalPrice || 0).toFixed(2)}`,
                    `₹${(data.couponDiscount || 0).toFixed(2)}`,
                    data.status || 'Pending',
                    data.paymentMethod || 'N/A'
                ];
            });

            const table = {
                title: 'Order Details',
                headers: [
                    { label: 'Order ID', width: 95 },
                    { label: 'User ID', width: 75 },
                    { label: 'Date', width: 65 },
                    { label: 'Amount', width: 75 },
                    { label: 'Discount', width: 65 },
                    { label: 'Status', width: 70 },
                    { label: 'Payment Method', width: 90 }
                ],
                rows: tableRows
            };

            await doc.table(table, {
                prepareHeader: () => doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827'),
                prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                    doc.font('Helvetica').fontSize(8.5).fillColor('#374151');
                }
            });

            doc.end();
        } else {
            res.status(400).json({ message: 'Invalid format specified' });
        }

    } catch (error) {
        console.error('Error generating report:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server Error', error: error.message });
        }
    }
};
  

exports.salesReoprtView = async (req, res) => {
    try {
     
      const { orderId } = req.query;
       console.log(req.query);
        
      const order = await Order.findOne({ _id: orderId }).populate("items.productId");
     console.log(`order from hhere = ${order}`)
      console.log(`order = ${order}`)
  
      res.render("admin/saleReportView", {
        title: "Order Details",
        order: order,
      });
    } catch (error) {
      console.log("error in orderview ", error);
    }
  };
  