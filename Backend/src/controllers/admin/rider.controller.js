const RiderModel = require('../../models/rider.model');
const RiderGuarantorModel = require('../../models/rider-guarantor.model');
const AuditService = require('../../services/audit.service');
const eventBus = require('../../realtime/event-bus');

class RiderController {
  async listRiders(req, res, next) {
    try {
      const { search, is_active, status, page = 1, limit = 20 } = req.query;
      const result = await RiderModel.findAll({ search, is_active, status }, { page: Number(page), limit: Number(limit) });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getRider(req, res, next) {
    try {
      const { id } = req.params;
      const rider = await RiderModel.findById(id);
      if (!rider) {
        return res.status(404).json({ success: false, message: 'Rider not found' });
      }
      res.status(200).json({ success: true, data: rider });
    } catch (error) {
      next(error);
    }
  }

  async createRider(req, res, next) {
    try {
      const {
        first_name,
        last_name,
        phone,
        email,
        address_jsonb,
        id_type,
        id_number,
        vehicle_type,
        vehicle_registration,
        is_active,
        photo_frontal,
        photo_left_profile,
        photo_right_profile,
        phone_secondary,
        id_doc_url,
        vehicle_doc_url,
        country,
        state,
        city,
        street_address
      } = req.body;

      if (!first_name || !last_name || !phone) {
        return res.status(400).json({ success: false, message: 'First name, last name, and phone are required' });
      }

      if (!photo_frontal || !photo_left_profile || !photo_right_profile) {
        return res.status(400).json({ success: false, message: 'All three biometric photos are required: frontal, left profile, right profile' });
      }

      const existing = await RiderModel.findByPhone(phone);
      if (existing) {
        return res.status(409).json({ success: false, message: 'A rider with this phone number already exists' });
      }

      const normalizedAddress = {
        country: country || 'Nigeria',
        state: state || null,
        city: city || null,
        street_address: street_address || null
      };

      const rider = await RiderModel.create({
        first_name,
        last_name,
        phone,
        email: email || null,
        address_jsonb: address_jsonb || normalizedAddress,
        id_type: id_type || 'none',
        id_number: id_number || null,
        vehicle_type: vehicle_type || 'none',
        vehicle_registration: vehicle_registration || null,
        is_active: is_active !== undefined ? is_active : true,
        status: 'pending_approval',
        created_by: req.admin.id,
        photo_frontal,
        photo_left_profile,
        photo_right_profile,
        phone_secondary: phone_secondary || null,
        id_doc_url: id_doc_url || null,
        vehicle_doc_url: vehicle_doc_url || null,
        country: normalizedAddress.country,
        state: normalizedAddress.state,
        city: normalizedAddress.city,
        street_address: normalizedAddress.street_address
      });

      AuditService.log(req, 'rider.created', 'rider', rider.id, null, { phone, name: `${first_name} ${last_name}` });
      res.status(201).json({ success: true, data: rider, message: 'Rider enrolled successfully. Awaiting approval.' });
    } catch (error) {
      next(error);
    }
  }

  async updateRider(req, res, next) {
    try {
      const { id } = req.params;
      const {
        first_name,
        last_name,
        phone,
        email,
        address_jsonb,
        id_type,
        id_number,
        vehicle_type,
        vehicle_registration,
        is_active,
        photo_frontal,
        photo_left_profile,
        photo_right_profile,
        phone_secondary,
        id_doc_url,
        vehicle_doc_url,
        country,
        state,
        city,
        street_address
      } = req.body;

      const rider = await RiderModel.findById(id);
      if (!rider) {
        return res.status(404).json({ success: false, message: 'Rider not found' });
      }

      if (phone && phone !== rider.phone) {
        const existing = await RiderModel.findByPhone(phone);
        if (existing) {
          return res.status(409).json({ success: false, message: 'A rider with this phone number already exists' });
        }
      }

      const updates = {
        first_name: first_name || rider.first_name,
        last_name: last_name || rider.last_name,
        phone: phone || rider.phone,
        email: email !== undefined ? email : rider.email,
        id_type: id_type || rider.id_type,
        id_number: id_number !== undefined ? id_number : rider.id_number,
        vehicle_type: vehicle_type || rider.vehicle_type,
        vehicle_registration: vehicle_registration !== undefined ? vehicle_registration : rider.vehicle_registration,
        is_active: is_active !== undefined ? is_active : rider.is_active,
        photo_frontal: photo_frontal !== undefined ? photo_frontal : rider.photo_frontal,
        photo_left_profile: photo_left_profile !== undefined ? photo_left_profile : rider.photo_left_profile,
        photo_right_profile: photo_right_profile !== undefined ? photo_right_profile : rider.photo_right_profile,
        phone_secondary: phone_secondary !== undefined ? phone_secondary : rider.phone_secondary,
        id_doc_url: id_doc_url !== undefined ? id_doc_url : rider.id_doc_url,
        vehicle_doc_url: vehicle_doc_url !== undefined ? vehicle_doc_url : rider.vehicle_doc_url,
        country: country !== undefined ? country : rider.country,
        state: state !== undefined ? state : rider.state,
        city: city !== undefined ? city : rider.city,
        street_address: street_address !== undefined ? street_address : rider.street_address
      };

      const normalizedAddress = {
        country: updates.country || 'Nigeria',
        state: updates.state,
        city: updates.city,
        street_address: updates.street_address
      };

      if (address_jsonb !== undefined) {
        updates.address_jsonb = address_jsonb;
      } else if (normalizedAddress.country || normalizedAddress.state || normalizedAddress.city || normalizedAddress.street_address) {
        updates.address_jsonb = normalizedAddress;
      }

      const updated = await RiderModel.update(id, updates);

      const oldValues = {
        first_name: rider.first_name,
        last_name: rider.last_name,
        phone: rider.phone,
        email: rider.email,
        is_active: rider.is_active,
        vehicle_type: rider.vehicle_type,
      };

      const newValues = {
        first_name: updated.first_name,
        last_name: updated.last_name,
        phone: updated.phone,
        email: updated.email,
        is_active: updated.is_active,
        vehicle_type: updated.vehicle_type,
      };

      AuditService.log(req, 'rider.updated', 'rider', id, oldValues, newValues);
      res.status(200).json({ success: true, data: updated, message: 'Rider updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async deleteRider(req, res, next) {
    try {
      const { id } = req.params;
      const rider = await RiderModel.findById(id);
      if (!rider) {
        return res.status(404).json({ success: false, message: 'Rider not found' });
      }

      await RiderModel.delete(id);
      AuditService.log(req, 'rider.deleted', 'rider', id, null, { phone: rider.phone });
      res.status(200).json({ success: true, message: 'Rider removed successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getActiveRiders(req, res, next) {
    try {
      const { search } = req.query;
      const riders = await RiderModel.findActive({ search });
      res.status(200).json({ success: true, data: riders });
    } catch (error) {
      next(error);
    }
  }

  async approveRider(req, res, next) {
    try {
      const { id } = req.params;
      const rider = await RiderModel.findById(id);
      if (!rider || rider.status !== 'pending_approval') {
        return res.status(400).json({ success: false, message: 'Rider is not pending approval' });
      }

      const updated = await RiderModel.approve(id, req.admin.id);
      AuditService.log(req, 'rider.approved', 'rider', id, null, { phone: updated.phone });

      eventBus.emit('rider.approved', {
        actor: req.actor || { id: req.admin.id, fullName: `${req.admin.firstName || ''} ${req.admin.lastName || ''}`.trim(), role: req.admin.role },
        resourceType: 'rider',
        resourceId: id,
        actionType: 'STATUS_CHANGE',
        severity: 'info',
        title: 'Rider approved',
        message: `Rider ${updated.first_name} ${updated.last_name} (${updated.phone}) was approved and is now live.`,
        data: { riderId: id, phone: updated.phone, name: `${updated.first_name} ${updated.last_name}` },
        deepLink: `/riders/${id}`,
      });

      res.status(200).json({ success: true, data: updated, message: 'Rider approved and now live' });
    } catch (error) {
      next(error);
    }
  }

  async rejectRider(req, res, next) {
    try {
      const { id } = req.params;
      const { rejection_reason } = req.body;
      const rider = await RiderModel.findById(id);
      if (!rider || rider.status !== 'pending_approval') {
        return res.status(400).json({ success: false, message: 'Rider is not pending approval' });
      }

      const updated = await RiderModel.update(id, { rejection_reason: rejection_reason || null });
      AuditService.log(req, 'rider.rejected', 'rider', id, null, { phone: updated.phone, reason: rejection_reason });

      eventBus.emit('rider.rejected', {
        actor: req.actor || { id: req.admin.id, fullName: `${req.admin.firstName || ''} ${req.admin.lastName || ''}`.trim(), role: req.admin.role },
        resourceType: 'rider',
        resourceId: id,
        actionType: 'STATUS_CHANGE',
        severity: 'warning',
        title: 'Rider rejected',
        message: `Rider ${updated.first_name} ${updated.last_name} (${updated.phone}) was rejected.`,
        data: { riderId: id, phone: updated.phone, name: `${updated.first_name} ${updated.last_name}`, reason: rejection_reason },
        deepLink: `/riders/${id}`,
      });

      res.status(200).json({ success: true, data: updated, message: 'Rider rejected' });
    } catch (error) {
      next(error);
    }
  }

  async suspendRider(req, res, next) {
    try {
      const { id } = req.params;
      const rider = await RiderModel.findById(id);
      if (!rider) {
        return res.status(404).json({ success: false, message: 'Rider not found' });
      }

      const updated = await RiderModel.suspend(id);
      AuditService.log(req, 'rider.suspended', 'rider', id, null, { phone: updated.phone });
      res.status(200).json({ success: true, data: updated, message: 'Rider suspended' });
    } catch (error) {
      next(error);
    }
  }

  async reactivateRider(req, res, next) {
    try {
      const { id } = req.params;
      const rider = await RiderModel.findById(id);
      if (!rider) {
        return res.status(404).json({ success: false, message: 'Rider not found' });
      }

      const updated = await RiderModel.updateStatus(id, 'live');
      AuditService.log(req, 'rider.reactivated', 'rider', id, null, { phone: updated.phone });
      res.status(200).json({ success: true, data: updated, message: 'Rider reactivated' });
    } catch (error) {
      next(error);
    }
  }

  async getPendingRiders(req, res, next) {
    try {
      const { search } = req.query;
      const riders = await RiderModel.findPending({ search });
      res.status(200).json({ success: true, data: riders });
    } catch (error) {
      next(error);
    }
  }

  async listGuarantors(req, res, next) {
    try {
      const { riderId } = req.params;
      const guarantors = await RiderGuarantorModel.findByRiderId(riderId);
      res.status(200).json({ success: true, data: guarantors });
    } catch (error) {
      next(error);
    }
  }

  async createGuarantor(req, res, next) {
    try {
      const { riderId } = req.params;
      const isFull = await RiderGuarantorModel.isFull(riderId);
      if (isFull) {
        return res.status(400).json({ success: false, message: 'Maximum of 2 guarantors per rider allowed' });
      }

      const guarantor = await RiderGuarantorModel.create({ ...req.body, rider_id: riderId });
      AuditService.log(req, 'rider.guarantor.created', 'rider_guarantor', guarantor.id, null, { riderId, name: guarantor.full_name });
      res.status(201).json({ success: true, data: guarantor, message: 'Guarantor added successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updateGuarantor(req, res, next) {
    try {
      const { riderId, guarantorId } = req.params;
      const existing = await RiderGuarantorModel.findByRiderId(riderId);
      const target = existing.find(g => g.id === guarantorId);
      if (!target) {
        return res.status(404).json({ success: false, message: 'Guarantor not found on this rider' });
      }

      const oldValues = {
        full_name: target.full_name,
        phone: target.phone,
        email: target.email,
        address: target.address,
        relationship: target.relationship,
      };

      const guarantor = await RiderGuarantorModel.update(guarantorId, req.body);
      const newValues = {
        full_name: guarantor.full_name,
        phone: guarantor.phone,
        email: guarantor.email,
        address: guarantor.address,
        relationship: guarantor.relationship,
      };

      AuditService.log(req, 'rider.guarantor.updated', 'rider_guarantor', guarantorId, oldValues, newValues);
      res.status(200).json({ success: true, data: guarantor, message: 'Guarantor updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async deleteGuarantor(req, res, next) {
    try {
      const { guarantorId } = req.params;
      const guarantor = await RiderGuarantorModel.findById(guarantorId);
      await RiderGuarantorModel.delete(guarantorId);
      AuditService.log(req, 'rider.guarantor.deleted', 'rider_guarantor', guarantorId, null, { riderId: guarantor?.rider_id, name: guarantor?.full_name });
      res.status(200).json({ success: true, message: 'Guarantor removed successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RiderController();
