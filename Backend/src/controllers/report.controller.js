const ReviewService = require('../services/review.service');

exports.createReport = async (req, res, next) => {
  try {
    const { reviewId, reason, description } = req.body;
    const report = await ReviewService.reportReview(req.user.id, reviewId, reason, description);
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

exports.getMyReports = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const result = await ReviewService.getReviewReports(
      { reporterId: req.user.id, status },
      { page: parseInt(page), limit: parseInt(limit) }
    );
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.getReportedReviews = async (req, res, next) => {
  try {
    const { status, productId, userId, page = 1, limit = 20 } = req.query;
    const filters = { status, productId, userId };
    const result = await ReviewService.getReportedReviews(filters, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};
