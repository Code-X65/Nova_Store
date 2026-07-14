const WarehouseService = require('../../services/warehouse.service');

class WarehouseController {
  async list(req, res, next) {
    try {
      const warehouses = await WarehouseService.listWarehouses();
      res.json({ success: true, data: { warehouses } });
    } catch (error) { next(error); }
  }

  async create(req, res, next) {
    try {
      const warehouse = await WarehouseService.createWarehouse(req.body);
      res.status(201).json({ success: true, data: { warehouse } });
    } catch (error) { next(error); }
  }

  async update(req, res, next) {
    try {
      const warehouse = await WarehouseService.updateWarehouse(req.params.id, req.body);
      res.json({ success: true, data: { warehouse } });
    } catch (error) { next(error); }
  }

  async remove(req, res, next) {
    try {
      await WarehouseService.deleteWarehouse(req.params.id);
      res.json({ success: true, message: 'Warehouse deleted' });
    } catch (error) { next(error); }
  }

  async getStock(req, res, next) {
    try {
      const { productId, variantId, warehouseId } = req.query;
      const levels = await WarehouseService.getStockByLocation({
        productId: productId || null,
        variantId: variantId || null,
        warehouseId: warehouseId || null,
      });
      res.json({ success: true, data: { levels } });
    } catch (error) { next(error); }
  }

  async setStock(req, res, next) {
    try {
      const level = await WarehouseService.setLevel(req.body);
      res.json({ success: true, data: { level } });
    } catch (error) { next(error); }
  }

  async transfer(req, res, next) {
    try {
      const { productId, variantId, fromWarehouseId, toWarehouseId, quantity, notes } = req.body;
      const levels = await WarehouseService.transferStock({
        productId: productId || null,
        variantId: variantId || null,
        fromWarehouseId,
        toWarehouseId,
        quantity: Number(quantity),
        userId: req.user?.id,
        notes,
      });
      res.json({ success: true, data: { levels } });
    } catch (error) { next(error); }
  }
}

module.exports = new WarehouseController();
