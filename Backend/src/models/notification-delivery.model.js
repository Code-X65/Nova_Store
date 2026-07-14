const supabase = require('../config/supabase');

class NotificationDeliveryModel {
  async create(data) {
    const { data: row, error } = await supabase
      .from('notification_deliveries')
      .insert({
        notification_id: data.notificationId || null,
        user_id: data.userId || null,
        template_key: data.templateKey,
        channel: data.channel,
        status: data.status || 'pending',
        provider_message_id: data.providerMessageId || null,
        error: data.error || null,
        sent_at: data.sentAt || null,
        delivered_at: data.deliveredAt || null,
      })
      .select()
      .single();

    if (error) throw error;
    return row;
  }

  async updateStatus(id, status, opts = {}) {
    const patch = { status, updated_at: new Date().toISOString() };
    if (opts.providerMessageId) patch.provider_message_id = opts.providerMessageId;
    if (opts.error) patch.error = opts.error;
    if (opts.deliveredAt) patch.delivered_at = opts.deliveredAt;
    if (opts.sentAt) patch.sent_at = opts.sentAt;

    const { data, error } = await supabase
      .from('notification_deliveries')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findByNotificationId(notificationId) {
    const { data, error } = await supabase
      .from('notification_deliveries')
      .select('*')
      .eq('notification_id', notificationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findFailed(limit = 100) {
    const { data, error } = await supabase
      .from('notification_deliveries')
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
}

module.exports = new NotificationDeliveryModel();
