const PDFDocument = require('pdfkit');

class InvoiceService {
  generateInvoicePdf(order, orderItems) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // 1. Header & Branding
        doc.fillColor('#DC2626').fontSize(22).text('NOVA STORE', 50, 50, { continued: true });
        doc.fillColor('#333333').fontSize(18).text(' - OFFICIAL INVOICE', { align: 'left' });
        doc.moveDown(0.5);

        doc.fontSize(10).fillColor('#666666');
        doc.text(`Invoice Date: ${new Date(order.created_at || Date.now()).toLocaleString()}`);
        doc.text(`Order Number: ${order.order_number}`);
        doc.text(`Payment Status: ${order.payment_status.toUpperCase()}`);
        doc.moveDown();

        // 2. Billing & Shipping Info Columns
        const startY = doc.y;
        doc.fontSize(11).fillColor('#111111').text('Billing & Customer Info:', 50, startY, { bold: true });
        doc.fontSize(9).fillColor('#333333');
        doc.text(`Email: ${order.customer_email || 'N/A'}`);
        doc.text(`Phone: ${order.customer_phone || 'N/A'}`);

        if (order.shipping_address) {
          const addr = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address;
          doc.fontSize(11).fillColor('#111111').text('Shipping Destination:', 300, startY, { bold: true });
          doc.fontSize(9).fillColor('#333333');
          doc.text(`${addr.first_name || ''} ${addr.last_name || ''}`, 300);
          doc.text(`${addr.street_address || ''}`, 300);
          doc.text(`${addr.city || ''}, ${addr.state || ''} ${addr.postal_code || ''}`, 300);
          doc.text(`${addr.country || ''}`, 300);
        }
        doc.moveDown(2);

        // 3. Table Header
        const tableHeaderY = doc.y;
        doc.fontSize(10).fillColor('#111111');
        doc.text('Item Description', 50, tableHeaderY, { width: 230 });
        doc.text('SKU', 280, tableHeaderY, { width: 100, align: 'center' });
        doc.text('Qty', 380, tableHeaderY, { width: 40, align: 'center' });
        doc.text('Unit Price', 420, tableHeaderY, { width: 60, align: 'right' });
        doc.text('Total', 480, tableHeaderY, { width: 70, align: 'right' });
        doc.moveDown(0.5);

        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(0.5);

        // 4. Line Items Rows
        doc.fillColor('#444444').fontSize(9);
        for (const item of orderItems) {
          const rowY = doc.y;
          doc.text(item.product_name, 50, rowY, { width: 230 });
          doc.text(item.sku || 'N/A', 280, rowY, { width: 100, align: 'center' });
          doc.text(String(item.quantity), 380, rowY, { width: 40, align: 'center' });
          doc.text(`₦${Number(item.unit_price).toFixed(2)}`, 420, rowY, { width: 60, align: 'right' });
          doc.text(`₦${Number(item.total_price).toFixed(2)}`, 480, rowY, { width: 70, align: 'right' });
          doc.moveDown(0.5);
        }

        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(1);

        // 5. Summary / Totals block
        const totalsY = doc.y;
        doc.fontSize(10).fillColor('#111111');
        doc.text('Subtotal:', 320, totalsY, { width: 120, align: 'right' });
        doc.text(`₦${Number(order.subtotal).toFixed(2)}`, 450, totalsY, { width: 100, align: 'right' });

        doc.text('Shipping Cost:', 320, doc.y, { width: 120, align: 'right' });
        doc.text(`₦${Number(order.shipping_cost).toFixed(2)}`, 450, doc.y, { width: 100, align: 'right' });

        doc.text('Tax Amount:', 320, doc.y, { width: 120, align: 'right' });
        doc.text(`₦${Number(order.tax_amount).toFixed(2)}`, 450, doc.y, { width: 100, align: 'right' });

        if (Number(order.discount_amount) > 0) {
          doc.text('Discount:', 320, doc.y, { width: 120, align: 'right' });
          doc.text(`-₦${Number(order.discount_amount).toFixed(2)}`, 450, doc.y, { width: 100, align: 'right' });
        }

        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#111111');
        doc.text('Grand Total:', 320, doc.y, { width: 120, align: 'right', bold: true });
        doc.text(`₦${Number(order.total_amount).toFixed(2)}`, 450, doc.y, { width: 100, align: 'right', bold: true });

        // footer note
        doc.fontSize(8).fillColor('#999999').text('Thank you for shopping at Nova Store!', 50, 700, { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = new InvoiceService();
