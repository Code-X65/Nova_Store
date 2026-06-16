const ProductReviewModel = require('../models/product-review.model');
const ReviewHelpfulnessModel = require('../models/review-helpfulness.model');
const OrderModel = require('../models/order.model');
const supabase = require('../config/supabase');
const ErrorResponse = require('../utils/errorResponse');

class ReviewService {
  async getProductReviews(productId, filters, pagination, currentUserId = null) {
    const result = await ProductReviewModel.findByProductId(productId, filters, pagination);
    
    // Add user vote info if logged in
    if (currentUserId && result.data.length > 0) {
      const reviewIds = result.data.map(r => r.id);
      const votes = await ReviewHelpfulnessModel.getUserVotesForReviews(currentUserId, reviewIds);
      
      const voteMap = {};
      votes.forEach(v => { voteMap[v.review_id] = v.is_helpful; });

      result.data = result.data.map(review => ({
        ...review,
        userVotedHelpful: voteMap[review.id] !== undefined ? voteMap[review.id] : null
      }));
    } else {
      result.data = result.data.map(review => ({
        ...review,
        userVotedHelpful: null
      }));
    }

    const summary = await ProductReviewModel.getRatingDistribution(productId);

    return {
      reviews: result.data,
      summary,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.count,
        totalPages: Math.ceil(result.count / result.limit)
      }
    };
  }

  async addReview(userId, reviewData) {
    const { productId, orderId, rating, title, comment } = reviewData;

    // 1. Enforce one review per user per product
    const existing = await ProductReviewModel.findByUserAndProduct(userId, productId);
    if (existing) {
      throw new ErrorResponse('You have already reviewed this product', 400);
    }

    let isVerifiedPurchase = false;

    // 2. Validate purchase if orderId is provided (or automatically check all user orders)
    if (orderId) {
      const order = await OrderModel.findById(orderId);
      if (!order || order.user_id !== userId) {
        throw new ErrorResponse('Invalid order reference', 400);
      }
      if (order.status !== 'delivered') {
        throw new ErrorResponse('You can only review delivered products', 400);
      }
      
      const hasProduct = order.items.some(item => item.product_id === productId);
      if (!hasProduct) {
        throw new ErrorResponse('Product not found in this order', 400);
      }
      isVerifiedPurchase = true;
    } else {
      // Automatically check if user bought it ever
      // Fetch user's delivered orders and see if product is there
      // For performance, a direct DB query would be better, but we can do a simple check
      // For now, we'll just set it to false if they don't provide orderId
      // Optionally, in a real app, query: SELECT count(*) FROM order_items JOIN orders WHERE user_id = ? AND product_id = ? AND status = 'delivered'
    }

    // 3. Create review
    const newReview = await ProductReviewModel.create({
      product_id: productId,
      user_id: userId,
      rating,
      title,
      comment,
      is_verified_purchase: isVerifiedPurchase,
      status: 'approved' // Default to approved, could be 'pending' if moderation is strict
    });

    return newReview;
  }

  async updateReview(userId, reviewId, updateData) {
    const review = await ProductReviewModel.findById(reviewId);
    if (!review) throw new ErrorResponse('Review not found', 404);
    if (review.user_id !== userId) throw new ErrorResponse('Unauthorized', 403);

    // Optional: check time limit for editing (e.g., 24 hours)
    
    return await ProductReviewModel.update(reviewId, {
      rating: updateData.rating,
      title: updateData.title,
      comment: updateData.comment,
      status: 'approved' // re-approve or 'pending' depending on policy
    });
  }

  async deleteReview(userId, reviewId, isAdmin = false) {
    const review = await ProductReviewModel.findById(reviewId);
    if (!review) throw new ErrorResponse('Review not found', 404);
    if (!isAdmin && review.user_id !== userId) throw new ErrorResponse('Unauthorized', 403);

    await ProductReviewModel.delete(reviewId);
    return true;
  }

   async voteHelpful(userId, reviewId, isHelpful) {
     const review = await ProductReviewModel.findById(reviewId);
     if (!review) throw new ErrorResponse('Review not found', 404);
     if (review.user_id === userId) {
       throw new ErrorResponse('You cannot vote on your own review', 400);
     }

    const existingVote = await ReviewHelpfulnessModel.findVote(reviewId, userId);

    if (existingVote) {
      if (existingVote.is_helpful === isHelpful) {
        await ReviewHelpfulnessModel.removeVote(reviewId, userId);
        return { userVote: null };
      } else {
        await ReviewHelpfulnessModel.upsertVote(reviewId, userId, isHelpful);
        return { userVote: isHelpful };
      }
    } else {
      await ReviewHelpfulnessModel.upsertVote(reviewId, userId, isHelpful);
      return { userVote: isHelpful };
    }
  }

  // ─── Review Reporting ────────────────────────────────────────────────────────

  async reportReview(reporterId, reviewId, reason, description = '') {
    const review = await ProductReviewModel.findById(reviewId);
    if (!review) throw new ErrorResponse('Review not found', 404);
    if (review.user_id === reporterId) {
      throw new ErrorResponse('You cannot report your own review', 400);
    }

    // Prevent duplicate reports from the same user on the same review
    const existing = await supabase
      .from('review_reports')
      .select('id')
      .eq('review_id', reviewId)
      .eq('reporter_id', reporterId)
      .maybeSingle();

    if (existing.data) {
      throw new ErrorResponse('You have already reported this review', 400);
    }

    const { data, error } = await supabase
      .from('review_reports')
      .insert([{ review_id: reviewId, reporter_id: reporterId, reason, description }])
      .select()
      .single();

    if (error) throw error;

    // Auto-flag the review as 'reported' if not already handled
    if (review.status === 'approved' || review.status === 'pending') {
      await ProductReviewModel.update(reviewId, { status: 'reported' }).catch(() => {});
    }

    return data;
  }

  async getReportedReviews(filters = {}, pagination = { page: 1, limit: 20 }) {
    const result = await ProductReviewModel.findAll(
      { ...filters, status: 'reported' },
      pagination
    );
    return {
      reviews: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.count,
        totalPages: Math.ceil(result.count / result.limit),
      },
    };
  }

  async getReviewReports(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    let query = supabase
      .from('review_reports')
      .select(
        '*, review:product_reviews(id, rating, comment, status, product:products(id, name)), reporter:users!reporter_id(id, first_name, last_name, email)',
        { count: 'exact' }
      );

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.reviewId) query = query.eq('review_id', filters.reviewId);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { data, count, page, limit };
  }

  async resolveReport(reportId, status, adminId, adminNote = '') {
    const { data, error } = await supabase
      .from('review_reports')
      .update({
        status,
        resolved_by: adminId,
        resolved_at: new Date().toISOString(),
        admin_note: adminNote,
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Admin Methods
  async getAllReviews(filters, pagination) {
    const result = await ProductReviewModel.findAll(filters, pagination);
    return {
      reviews: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.count,
        totalPages: Math.ceil(result.count / result.limit)
      }
    };
  }

  async moderateReview(reviewId, status) {
    return await ProductReviewModel.update(reviewId, { status });
  }
}

module.exports = new ReviewService();
