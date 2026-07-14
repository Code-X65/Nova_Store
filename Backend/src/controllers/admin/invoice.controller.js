const InvoiceService = require('../../services/invoice.service');
const fs = require('fs');
const path = require('path');
const { SINGLE_STORE_ID } = require('../../config/store');

class InvoiceController {
  async list(req, res, next) {
    try {
      const { orderNumber, dateFrom, dateTo, page, limit } = req.query;
      const result = await InvoiceService.listInvoices(
        { orderNumber, dateFrom, dateTo },
        { page: page || 1, limit: limit || 20 }
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getOne(req, res, next) {
    try {
      const inv = await InvoiceService.getInvoice(req.params.id);
      if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
      res.status(200).json({ success: true, data: { invoice: inv } });
    } catch (err) {
      next(err);
    }
  }

  async download(req, res, next) {
    try {
      const inv = await InvoiceService.getInvoice(req.params.id);
      if (!inv || !inv.pdf_url) return res.status(404).json({ success: false, message: 'Invoice PDF not found' });
      const filePath = path.join(__dirname, '../../..', inv.pdf_url);
      if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Invoice file missing' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${path.basename(filePath)}`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      next(err);
    }
  }

  async generateForOrder(req, res, next) {
    try {
      const record = await InvoiceService.issueForOrder(req.params.id, req.admin?.id || req.user?.id);
      res.status(200).json({ success: true, data: { invoice: record }, message: 'Invoice generated' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InvoiceController();
