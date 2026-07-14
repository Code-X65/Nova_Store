const OrderStateMachine = require('../../services/order-state-machine.service');
const OrderModel = require('../../models/order.model');
const AuditService = require('../../services/audit.service');
const { SINGLE_STORE_ID } = require('../../config/store');

class OrderLifecycleController {
  async allowedTransitions(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderModel.findById(id, SINGLE_STORE_ID);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      const allowed = await OrderStateMachine.listAllowed(order.status);
      res.status(200).json({ success: true, data: { currentStatus: order.status, allowed } });
    } catch (err) {
      next(err);
    }
  }

  async transition(req, res, next) {
    try {
      const { id } = req.params;
      const { status, note } = req.body;
      if (!status) return res.status(400).json({ success: false, message: 'status is required' });

      const order = await OrderStateMachine.transition(id, status, { actorId: req.admin?.id || req.user?.id, note });
      const actorName = req.actor?.fullName || 'an admin';
      AuditService.log(req, 'order.transition', 'order', id, null, { toStatus: status }, {
        actionType: 'STATUS_CHANGE', summary: `Status changed to ${status} by ${actorName}`
      });
      res.status(200).json({ success: true, data: { order }, message: `Order transitioned to ${status}` });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OrderLifecycleController();
