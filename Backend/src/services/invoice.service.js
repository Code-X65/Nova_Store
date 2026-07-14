const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const OrderModel = require('../models/order.model');
const InvoiceModel = require('../models/invoice.model');
const OrderStatusHistoryModel = require('../models/order-status-history.model');
const NotificationService = require('./notification.service');
const AuditService = require('./audit.service');
const { SINGLE_STORE_ID } = require('../config/store');
const logger = require('../utils/logger');
const eventBus = require('../realtime/event-bus');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/invoices');

/**
 * Invoice service (Phase 4 §5.2)
 *
 * Generates gross-NGN invoices (no tax lines), persists them to the
 * `invoices` table, writes a downloadable PDF, and auto-issues one
 * when an order is delivered or paid (idempotent — one per order).
 */
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
        doc.text(`Invoice No: ${order.invoice_no || order.order_number}`);
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

        // 5. Summary / Totals block (gross NGN — no tax computation)
        const totalsY = doc.y;
        doc.fontSize(10).fillColor('#111111');
        doc.text('Subtotal:', 320, totalsY, { width: 120, align: 'right' });
        doc.text(`₦${Number(order.subtotal).toFixed(2)}`, 450, totalsY, { width: 100, align: 'right' });

        doc.text('Shipping Cost:', 320, doc.y, { width: 120, align: 'right' });
        doc.text(`₦${Number(order.shipping_cost).toFixed(2)}`, 450, doc.y, { width: 100, align: 'right' });

        if (Number(order.discount_amount) > 0) {
          doc.text('Discount:', 320, doc.y, { width: 120, align: 'right' });
          doc.text(`-₦${Number(order.discount_amount).toFixed(2)}`, 450, doc.y, { width: 100, align: 'right' });
        }

        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#111111');
        doc.text('Grand Total:', 320, doc.y, { width: 120, align: 'right', bold: true });
        doc.text(`₦${Number(order.total_amount).toFixed(2)}`, 450, doc.y, { width: 100, align: 'right', bold: true });

        doc.fontSize(8).fillColor('#999999').text('Thank you for shopping at Nova Store!', 50, 700, { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Issue (or fetch existing) invoice for an order. Idempotent.
   * @param {string} orderId
   * @param {string} [actorId]
   */
  async issueForOrder(orderId, actorId = null) {
    const existing = await InvoiceModel.findByOrderId(orderId);
    if (existing) return existing;

    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');

    const invoiceNo = `INV-${order.order_number}`;
    const pdfBuffer = await this.generateInvoicePdf(order, order.items || []);
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const fileName = `invoice-${order.order_number}.pdf`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    const record = await InvoiceModel.create({
      order_id: order.id,
      order_number: order.order_number,
      invoice_no: invoiceNo,
      subtotal: order.subtotal || 0,
      shipping_cost: order.shipping_cost || 0,
      discount_amount: order.discount_amount || 0,
      tax_amount: 0,
      total_amount: order.total_amount || 0,
      currency: 'NGN',
      pdf_url: `/uploads/invoices/${fileName}`,
      issued_at: new Date().toISOString(),
      created_by: actorId
    });

    await OrderStatusHistoryModel.create({
      order_id: orderId,
      status: order.status,
      note: `Invoice ${invoiceNo} issued`,
      changed_by: actorId
    });

    try {
      await NotificationService.sendToUser(
        order.user_id,
        'invoice_ready',
        { orderNumber: order.order_number, invoiceNo },
        null, null, { async: true }
      );
    } catch (err) {
      logger.warn(`[InvoiceService] notify failed for ${order.order_number}: ${err.message}`);
    }

    return record;
  }

  async getInvoice(invoiceId) {
    return await InvoiceModel.findById(invoiceId);
  }

  async listInvoices(filters, pagination) {
    return await InvoiceModel.list(filters, pagination);
  }

  /**
   * Subscribe to domain events so invoices auto-generate on
   * delivered / paid. Called once at boot from server.js.
   */
  initAutoInvoice() {
    eventBus.on('order.delivered', async (payload) => {
      try {
        await this.issueForOrder(payload.resourceId || payload.orderId);
      } catch (err) {
        logger.warn(`[InvoiceService] auto-issue on delivered failed: ${err.message}`);
      }
    });

    eventBus.on('order.payment_succeeded', async (payload) => {
      try {
        if (payload && (payload.orderId || payload.resourceId)) {
          await this.issueForOrder(payload.orderId || payload.resourceId);
        }
      } catch (err) {
        logger.warn(`[InvoiceService] auto-issue on paid failed: ${err.message}`);
      }
    });
  }
}

module.exports = new InvoiceService();
