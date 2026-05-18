const NotificationModel = require('../models/notification.model');
const NotificationSettingModel = require('../models/notification-setting.model');

exports.getNotifications = async (req, res, next) => {
  try {
    const { page, limit, isRead, type } = req.query;
    
    const filters = { type };
    if (isRead !== undefined) filters.isRead = isRead === 'true';

    const result = await NotificationModel.findByUserId(req.user.id, filters, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    const unreadCount = await NotificationModel.getUnreadCount(req.user.id);

    res.status(200).json({ 
      success: true, 
      data: {
        notifications: result.data,
        unreadCount,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.count,
          totalPages: Math.ceil(result.count / result.limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await NotificationModel.getUnreadCount(req.user.id);
    res.status(200).json({ success: true, data: { unreadCount } });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    await NotificationModel.markAsRead(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: {}, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const markedCount = await NotificationModel.markAllAsRead(req.user.id);
    res.status(200).json({ success: true, data: { markedCount }, message: `Marked ${markedCount} notifications as read` });
  } catch (error) {
    next(error);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    await NotificationModel.delete(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: {}, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await NotificationSettingModel.getSettings(req.user.id);
    res.status(200).json({ success: true, data: { settings } });
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const settings = await NotificationSettingModel.updateSettings(req.user.id, req.body);
    res.status(200).json({ success: true, data: { settings }, message: 'Settings updated' });
  } catch (error) {
    next(error);
  }
};
