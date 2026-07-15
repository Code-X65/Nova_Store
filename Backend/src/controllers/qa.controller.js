const QAService = require('../services/qa.service');

exports.getProductQuestions = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { page, limit } = req.query;
    const result = await QAService.getProductQuestions(productId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.askQuestion = async (req, res, next) => {
  try {
    const question = await QAService.askQuestion(req.user.id, req.body);
    res.status(201).json({ success: true, data: { question }, message: 'Question submitted — awaiting store response' });
  } catch (error) {
    next(error);
  }
};
