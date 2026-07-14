const supabase = require('../config/supabase');

class NotificationDlqModel {
  async create(data) {
    const { data: row, error } = await supabase
      .from('notification_dlq')
      .insert({
        job_id: data.jobId,
        user_id: data.userId || null,
        template_key: data.templateKey,
        data: data.data || {},
        attempts: data.attempts || 0,
        error: data.error,
      })
      .select()
      .single();

    if (error) throw error;
    return row;
  }

  async findAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    let query = supabase
      .from('notification_dlq')
      .select('*', { count: 'exact' });

    if (filters.recovered !== undefined) {
      query = query.eq('recovered', filters.recovered);
    }
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.templateKey) {
      query = query.eq('template_key', filters.templateKey);
    }

    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order('failed_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data, count, page, limit };
  }

  async markRecovered(id) {
    const { data, error } = await supabase
      .from('notification_dlq')
      .update({ recovered: true, recovered_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new NotificationDlqModel();
