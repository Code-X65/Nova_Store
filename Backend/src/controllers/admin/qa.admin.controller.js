const QAService = require('../../services/qa.service');
const AuditService = require('../../services/audit.service');

exports.getAllQuestions = async (req, res, next) => {
  try {
    const { status, productId, page, limit } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (productId) filters.productId = productId;

    const result = await QAService.getAllQuestions(filters, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.answerQuestion = async (req, res, next) => {
  try {
    const adminId = req.admin?.id || req.user?.id;
    const question = await QAService.answerQuestion(adminId, req.params.id, req.body.answer);
    AuditService.log(req, 'qa.answered', 'product_question', req.params.id, null, { answer: req.body.answer });
    res.status(200).json({ success: true, data: { question } });
  } catch (error) {
    next(error);
  }
};

exports.moderateQuestion = async (req, res, next) => {
  try {
    const question = await QAService.moderateQuestion(req.params.id, req.body.status);
    AuditService.log(req, 'qa.moderated', 'product_question', req.params.id, null, { status: req.body.status });
    res.status(200).json({ success: true, data: { question } });
  } catch (error) {
    next(error);
  }
};

exports.deleteQuestion = async (req, res, next) => {
  try {
    await QAService.deleteQuestion(req.params.id);
    AuditService.log(req, 'qa.deleted', 'product_question', req.params.id);
    res.status(200).json({ success: true, data: {}, message: 'Question deleted' });
  } catch (error) {
    next(error);
  }
};
