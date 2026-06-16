const supabase = require('../config/supabase');

class TelemetryService {
  async trackSearch(userId, searchQuery) {
    const { data, error } = await supabase
      .from('user_search_logs')
      .insert([{
        user_id: userId || null,
        search_query: searchQuery
      }]);

    if (error) throw error;
    return true;
  }

  async trackView(userId, productId, viewDuration) {
    const { data, error } = await supabase
      .from('user_product_views')
      .insert([{
        user_id: userId || null,
        product_id: productId,
        view_duration: viewDuration || 0
      }]);

    if (error) throw error;
    return true;
  }
}

module.exports = new TelemetryService();
