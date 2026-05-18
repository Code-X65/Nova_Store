const onboardingModel = require('../models/onboarding.model');
const userModel = require('../models/user.model');

class OnboardingController {
  async getStatus(req, res, next) {
    try {
      const status = await onboardingModel.getStatus(req.user.id);
      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  async getQuestions(req, res, next) {
    try {
      const step = req.query.step ? parseInt(req.query.step) : null;
      const includeDependencies = req.query.include_dependencies === 'true';
      
      const questions = await onboardingModel.getQuestions(step, includeDependencies);
      res.status(200).json({ success: true, data: { questions } });
    } catch (error) {
      next(error);
    }
  }

  async start(req, res, next) {
    try {
      const user = await userModel.findById(req.user.id);
      if (user.onboarding_status === 'completed' || user.onboarding_status === 'skipped') {
        const error = new Error('Onboarding already completed or skipped');
        error.statusCode = 409;
        throw error;
      }

      const result = await onboardingModel.start(req.user.id);
      res.status(200).json({ 
        success: true, 
        message: 'Onboarding started', 
        data: {
          status: result.onboarding_status,
          startedAt: result.onboarding_started_at
        } 
      });
    } catch (error) {
      next(error);
    }
  }

  async submitAnswer(req, res, next) {
    try {
      const { questionKey, answer } = req.body;
      const result = await onboardingModel.saveAnswer(req.user.id, questionKey, answer);
      
      res.status(200).json({ 
        success: true, 
        message: 'Answer saved', 
        data: {
          questionKey,
          answer: result.answer_value,
          answeredAt: result.answered_at
        } 
      });
    } catch (error) {
      next(error);
    }
  }

  async complete(req, res, next) {
    try {
      const result = await onboardingModel.complete(req.user.id);
      res.status(200).json({ 
        success: true, 
        message: 'Onboarding completed successfully', 
        data: {
          status: result.onboarding_status,
          completedAt: result.onboarding_completed_at,
          features: result.features,
          redirectTo: '/dashboard'
        } 
      });
    } catch (error) {
      next(error);
    }
  }

  async skip(req, res, next) {
    try {
      const result = await onboardingModel.skip(req.user.id);
      res.status(200).json({ 
        success: true, 
        message: 'Onboarding skipped. You can complete it later from settings.', 
        data: {
          status: result.onboarding_status,
          skippedAt: result.onboarding_completed_at
        } 
      });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req, res, next) {
    try {
      const status = await onboardingModel.getStatus(req.user.id);
      const answers = await onboardingModel.getAnswers(req.user.id);
      
      res.status(200).json({ 
        success: true, 
        data: {
          status: status.status,
          progress: status.progress,
          answers
        } 
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OnboardingController();
