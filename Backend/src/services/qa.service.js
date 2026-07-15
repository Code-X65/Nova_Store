const ProductQuestionModel = require('../models/product-question.model');
const ErrorResponse = require('../utils/errorResponse');
const eventBus = require('../realtime/event-bus');

class QAService {
  async getProductQuestions(productId, pagination) {
    return await ProductQuestionModel.findByProductId(productId, { onlyApproved: true }, pagination);
  }

  async askQuestion(userId, { productId, question }) {
    if (!question || !question.trim()) throw new ErrorResponse('Question text is required', 400);

    const created = await ProductQuestionModel.create({
      product_id: productId,
      user_id: userId,
      question: question.trim(),
      status: 'pending'
    });

    eventBus.emit('qa.asked', {
      actor: { id: userId, fullName: null, role: 'customer' },
      resourceType: 'product_question',
      resourceId: created.id,
      actionType: 'CREATE',
      severity: 'info',
      title: 'New product question',
      message: `A customer asked: "${question.slice(0, 120)}${question.length > 120 ? '…' : ''}"`,
      data: { questionId: created.id, productId },
      deepLink: `/qa`,
    });

    return created;
  }

  // Admin operations
  async getAllQuestions(filters, pagination) {
    return await ProductQuestionModel.findAll(filters, pagination);
  }

  async answerQuestion(adminId, questionId, answer) {
    if (!answer || !answer.trim()) throw new ErrorResponse('Answer text is required', 400);

    const question = await ProductQuestionModel.findById(questionId);
    if (!question) throw new ErrorResponse('Question not found', 404);

    return await ProductQuestionModel.update(questionId, {
      answer: answer.trim(),
      answered_by: adminId,
      answered_at: new Date().toISOString(),
      status: 'approved'
    });
  }

  async moderateQuestion(questionId, status) {
    const question = await ProductQuestionModel.findById(questionId);
    if (!question) throw new ErrorResponse('Question not found', 404);
    return await ProductQuestionModel.update(questionId, { status });
  }

  async deleteQuestion(questionId) {
    const question = await ProductQuestionModel.findById(questionId);
    if (!question) throw new ErrorResponse('Question not found', 404);
    return await ProductQuestionModel.delete(questionId);
  }
}

module.exports = new QAService();
