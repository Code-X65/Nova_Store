const InventoryAlertService = require('../../services/inventory-alert.service');

class StockAlertController {
  async list(req, res, next) {
    try {
      const rules = await InventoryAlertService.listRules(req.query);
      res.json({ success: true, data: { rules } });
    } catch (error) { next(error); }
  }

  async create(req, res, next) {
    try {
      const rule = await InventoryAlertService.createRule(req.body);
      res.status(201).json({ success: true, data: { rule } });
    } catch (error) { next(error); }
  }

  async update(req, res, next) {
    try {
      const rule = await InventoryAlertService.updateRule(req.params.id, req.body);
      res.json({ success: true, data: { rule } });
    } catch (error) { next(error); }
  }

  async remove(req, res, next) {
    try {
      await InventoryAlertService.deleteRule(req.params.id);
      res.json({ success: true, message: 'Alert rule deleted' });
    } catch (error) { next(error); }
  }
}

module.exports = new StockAlertController();
