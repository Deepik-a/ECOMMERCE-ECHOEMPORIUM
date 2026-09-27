const PDFDocument = require('pdfkit-table');
const Order = require('../../model/orderSchema');

exports.generateOrderPDF = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId).populate('items.productId');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const doc = new PDFDocument({
            margin: 40,
            size: 'A4',
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=EchoEmporium-Invoice-${order.orderId || orderId}.pdf`);
        doc.pipe(res);

        // Header / Store Branding
        doc.fontSize(22).font('Helvetica-Bold').fillColor('#1e3a8a').text('Echo Emporium', { align: 'left' });
        doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text('Premium E-Commerce Store | Tax Invoice', { align: 'left' });
        doc.moveDown(0.8);

        // Header Divider
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
        doc.moveDown(1);

        const detailsTop = doc.y;

        // Order Info (Left Column)
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text('Order Information', 40, detailsTop);
        doc.font('Helvetica').fontSize(9).fillColor('#374151')
            .text(`Order ID: ${order.orderId || order._id}`, 40, detailsTop + 18)
            .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, 40, detailsTop + 32)
            .text(`Order Status: ${order.status}`, 40, detailsTop + 46)
            .text(`Payment Method: ${order.paymentMethod}`, 40, detailsTop + 60);

        // Shipping Address (Right Column)
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text('Delivery Address', 320, detailsTop);
        doc.font('Helvetica').fontSize(9).fillColor('#374151')
            .text(order.address || 'Address not provided', 320, detailsTop + 18, { width: 230 });

        doc.y = detailsTop + 90;
        doc.moveDown(1);

        // Item rows
        const tableRows = order.items.map((item, index) => {
            const productName = item.productId ? item.productId.name : 'Product (Deleted)';
            const qty = item.productCount || 1;
            const price = item.productPrice || 0;
            const total = qty * price;
            return [
                (index + 1).toString(),
                productName,
                qty.toString(),
                `₹${price.toFixed(2)}`,
                `₹${total.toFixed(2)}`
            ];
        });

        const table = {
            title: 'Purchased Items',
            headers: [
                { label: '#', width: 30 },
                { label: 'Product Name', width: 245 },
                { label: 'Quantity', width: 60 },
                { label: 'Unit Price', width: 90 },
                { label: 'Total', width: 90 }
            ],
            rows: tableRows
        };

        await doc.table(table, {
            prepareHeader: () => doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827'),
            prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                doc.font('Helvetica').fontSize(8.5).fillColor('#374151');
            }
        });

        doc.moveDown(1.5);

        // Pricing Summary Box
        const summaryY = doc.y;
        const subtotal = order.items.reduce((acc, item) => acc + (item.productPrice * item.productCount), 0);
        const discount = order.couponDiscount || 0;
        const finalPayable = order.totalPrice || (subtotal - discount);

        doc.rect(330, summaryY, 225, 65).fillAndStroke('#f9fafb', '#e5e7eb');
        doc.fillColor('#374151').font('Helvetica').fontSize(9)
            .text('Subtotal:', 340, summaryY + 8)
            .text(`₹${subtotal.toFixed(2)}`, 450, summaryY + 8, { width: 95, align: 'right' })
            .text('Coupon Discount:', 340, summaryY + 24)
            .text(`- ₹${discount.toFixed(2)}`, 450, summaryY + 24, { width: 95, align: 'right' })
            .font('Helvetica-Bold').fontSize(11).fillColor('#1e3a8a')
            .text('Total Paid:', 340, summaryY + 44)
            .text(`₹${finalPayable.toFixed(2)}`, 450, summaryY + 44, { width: 95, align: 'right' });

        doc.y = summaryY + 85;
        doc.moveDown(1.5);

        // Footer
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#6b7280')
            .text('Thank you for shopping with Echo Emporium! For customer support, visit our help center.', { align: 'center' });

        doc.end();
    } catch (error) {
        console.error(`PDF Generation Error: ${error.message}`);
        if (!res.headersSent) {
            res.status(500).json({
                message: 'Failed to generate PDF',
                error: error.message,
            });
        }
    }
};
