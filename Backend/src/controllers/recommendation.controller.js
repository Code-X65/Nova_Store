const RecommendationService = require('../services/recommendation.service');

class RecommendationController {
  async getRecommendations(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 10;
      const userId = req.user ? req.user.id : null;

      const recommendations = await RecommendationService.getPersonalizedRecommendations(userId, limit);

      res.status(200).json({
        success: true,
        data: {
          recommendations
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RecommendationController();
