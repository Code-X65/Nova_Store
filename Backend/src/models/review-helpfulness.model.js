const supabase = require('../config/supabase');

class ReviewHelpfulnessModel {
  async findVote(reviewId, userId) {
    const { data, error } = await supabase
      .from('review_helpfulness')
      .select('*')
      .eq('review_id', reviewId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async upsertVote(reviewId, userId, isHelpful) {
    const { data, error } = await supabase
      .from('review_helpfulness')
      .upsert(
        { review_id: reviewId, user_id: userId, is_helpful: isHelpful },
        { onConflict: 'review_id,user_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeVote(reviewId, userId) {
    const { error } = await supabase
      .from('review_helpfulness')
      .delete()
      .eq('review_id', reviewId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  async getUserVotesForReviews(userId, reviewIds) {
    if (!reviewIds || reviewIds.length === 0) return [];
    
    const { data, error } = await supabase
      .from('review_helpfulness')
      .select('review_id, is_helpful')
      .eq('user_id', userId)
      .in('review_id', reviewIds);

    if (error) throw error;
    return data;
  }
}

module.exports = new ReviewHelpfulnessModel();
