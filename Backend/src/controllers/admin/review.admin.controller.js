const ReviewService = require('../../services/review.service');
const AuditService = require('../../services/audit.service');

exports.getReports = async (req, res, next) => {
  try {
    const { status, reviewId, page = 1, limit = 20 } = req.query;
    const result = await ReviewService.getReviewReports(
      { status, reviewId },
      { page: parseInt(page), limit: parseInt(limit) }
    );
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.resolveReport = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    const report = await ReviewService.resolveReport(req.params.id, status, req.user.id, adminNote);
    AuditService.log(req, 'review_report.resolved', 'review_report', req.params.id, null, { status, adminNote });
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

exports.getReportSummary = async (req, res, next) => {
  try {
    // Count reports by status
    const { data: counts, error } = await require('../../config/supabase')
      .from('review_reports')
      .select('status', { count: 'exact', head: false });
    if (error) throw error;

    const summary = { pending: 0, resolved: 0, dismissed: 0, totalReviewsWithReports: 0 };

    // Count of reviews with reported_count > 0
    const { data: reviews, error: revErr } = await require('../../config/supabase')
      .from('product_reviews')
      .select('id', { count: 'exact', head: true })
      .gt('reported_count', 0);
    if (!revErr) summary.totalReviewsWithReports = reviews;

    (counts || []).forEach(r => {
      if (summary[r.status] !== undefined) summary[r.status]++;
    });

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

exports.getAllReviews = async (req, res, next) => {
  try {
    const { status, productId, userId, page, limit } = req.query;
    const filters = { status, productId, userId };
    const result = await ReviewService.getAllReviews(filters, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    AuditService.log(req, 'review.admin.list', 'review', null, null, filters);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.moderateReview = async (req, res, next) => {
  try {
    const { status } = req.body;
    const review = await ReviewService.moderateReview(req.params.id, status);
    AuditService.log(req, 'review.moderated', 'review', req.params.id, null, { newStatus: status });
    res.status(200).json({ success: true, data: { review }, message: `Review marked as ${status}` });
  } catch (error) {
    next(error);
  }
};

exports.deleteReview = async (req, res, next) => {
  try {
    await ReviewService.deleteReview(req.user.id, req.params.id, true);
    AuditService.log(req, 'review.deleted', 'review', req.params.id);
    res.status(200).json({ success: true, data: {}, message: 'Review deleted permanently' });
  } catch (error) {
    next(error);
  }
};

exports.bulkAction = async (req, res, next) => {
  try {
    const { reviewIds, action } = req.body;
    let successCount = 0;
    for (const id of reviewIds) {
      if (action === 'delete') {
        await ReviewService.deleteReview(req.user.id, id, true);
      } else {
        await ReviewService.moderateReview(id, action === 'approve' ? 'approved' : 'hidden');
      }
      successCount++;
    }
    AuditService.log(req, 'review.bulk_action', 'review', null, null, { action, count: successCount });
    res.status(200).json({ success: true, data: { affected: successCount }, message: `Bulk ${action} completed` });
  } catch (error) {
    next(error);
  }
};
