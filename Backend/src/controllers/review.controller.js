const ReviewService = require('../services/review.service');

exports.getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { page, limit, rating, sortBy, verifiedOnly } = req.query;
    
    const filters = {
      status: 'approved'
    };
    if (rating) filters.rating = parseInt(rating);
    if (verifiedOnly === 'true') filters.isVerifiedPurchase = true;
    if (sortBy) filters.sortBy = sortBy;

    const currentUserId = req.user ? req.user.id : null;

    const result = await ReviewService.getProductReviews(
      productId, 
      filters, 
      { page: parseInt(page) || 1, limit: parseInt(limit) || 20 },
      currentUserId
    );

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.addReview = async (req, res, next) => {
  try {
    const review = await ReviewService.addReview(req.user.id, req.body);
    res.status(201).json({ success: true, data: { review }, message: 'Review added successfully' });
  } catch (error) {
    next(error);
  }
};

exports.updateReview = async (req, res, next) => {
  try {
    const review = await ReviewService.updateReview(req.user.id, req.params.id, req.body);
    res.status(200).json({ success: true, data: { review }, message: 'Review updated successfully' });
  } catch (error) {
    next(error);
  }
};

exports.deleteReview = async (req, res, next) => {
  try {
    await ReviewService.deleteReview(req.user.id, req.params.id);
    res.status(200).json({ success: true, data: {}, message: 'Review deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.voteHelpful = async (req, res, next) => {
  try {
    const { isHelpful } = req.body;
    const result = await ReviewService.voteHelpful(req.user.id, req.params.id, isHelpful);
    
    // We also might want to return the updated helpfulCount, but typically client increments visually or fetches
    // To keep it simple, we just return the vote status
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
