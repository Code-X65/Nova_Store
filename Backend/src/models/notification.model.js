const supabase = require('../config/supabase');

class NotificationModel {
  async findByUserId(userId, filters = {}, pagination = { page: 1, limit: 20 }) {
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .contains('channel', ['inapp']);

    if (filters.isRead !== undefined) {
      if (filters.isRead) {
        query = query.not('read_at', 'is', null);
      } else {
        query = query.is('read_at', null);
      }
    }
    
    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data, count, page, limit };
  }

  async getUnreadCount(userId) {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
      .contains('channel', ['inapp']);

    if (error) throw error;
    return count;
  }

  async markAsRead(id, userId) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString(), status: 'read' })
      .eq('id', id)
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) throw error;
    return true;
  }

  async markAllAsRead(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString(), status: 'read' })
      .eq('user_id', userId)
      .is('read_at', null)
      .contains('channel', ['inapp'])
      .select();

    if (error) throw error;
    return data.length;
  }

  async delete(id, userId) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  async create(data) {
    const { data: created, error } = await supabase
      .from('notifications')
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    return created;
  }

  async findAllSystemWide(filters = {}, pagination = { page: 1, limit: 20 }) {
    let query = supabase.from('notifications').select('*', { count: 'exact' });

    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.channel) query = query.contains('channel', [filters.channel]);

    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data, count, page, limit };
  }
}

module.exports = new NotificationModel();
