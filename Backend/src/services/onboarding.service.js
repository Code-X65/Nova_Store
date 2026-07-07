const onboardingModel = require('../models/onboarding.model');
const userModel = require('../models/user.model');
const logger = require('../utils/logger');

class OnboardingService {
  async getOnboardingStatus(userId) {
    const user = await userModel.findById(userId);
    if (!user) throw new Error('User not found');
    
    return {
      status: user.onboarding_status,
      startedAt: user.onboarding_started_at,
      completedAt: user.onboarding_completed_at
    };
  }

  async getQuestions(userId) {
    const user = await userModel.findById(userId);
    if (user.onboarding_status === 'completed' || user.onboarding_status === 'skipped') {
      return [];
    }

    // Start onboarding if not already
    if (user.onboarding_status === 'not_started') {
      await userModel.update(userId, { 
        onboarding_status: 'in_progress',
        onboarding_started_at: new Date().toISOString()
      });
    }

    const allQuestions = await onboardingModel.getQuestions();
    const userAnswers = await onboardingModel.getAnswers(userId);
    const answeredKeys = userAnswers.map(a => a.questionKey);

    // Filter questions based on dependencies
    return allQuestions.filter(q => {
      if (!q.depends_on) return true;
      
      const dependencyAnswer = userAnswers.find(a => a.questionKey === q.depends_on);
      if (!dependencyAnswer) return false;
      
      return dependencyAnswer.answer === q.dependency_value;
    });
  }

  async submitAnswer(userId, questionKey, answerValue) {
    const answer = await onboardingModel.saveAnswer(userId, questionKey, answerValue);
    
    // Check if onboarding is complete (all non-dependent or valid dependent questions answered)
    // For now, we'll just log and return
    logger.info(`User ${userId} answered onboarding question ${questionKey}: ${JSON.stringify(answerValue)}`);
    
    return answer;
  }

  async completeOnboarding(userId) {
    const userAnswers = await onboardingModel.getAnswers(userId);
    
    // Map answers to features and preferences (Example Logic)
    const features = { analytics: false, collaboration: false, api_access: false, advanced_reporting: false };
    const preferences = {};

    userAnswers.forEach(ans => {
      const key = ans.questionKey;
      const val = ans.answer;

      if (key === 'industry' && val === 'technology') features.api_access = true;
      if (key === 'feature_interest' && Array.isArray(val)) {
        if (val.includes('analytics')) features.analytics = true;
        if (val.includes('reporting')) features.advanced_reporting = true;
      }
      
      // Map everything else to preferences
      preferences[key] = val;
    });

    await userModel.update(userId, {
      onboarding_status: 'completed',
      onboarding_completed_at: new Date().toISOString(),
      features: features,
      preferences: preferences,
      ...(preferences.referral_source && { referral_source: preferences.referral_source })
    });

    logger.info(`User ${userId} completed onboarding`);
    return { status: 'completed' };
  }

  async skipOnboarding(userId) {
    await userModel.update(userId, {
      onboarding_status: 'skipped',
      onboarding_completed_at: new Date().toISOString()
    });
    
    logger.info(`User ${userId} skipped onboarding`);
    return { status: 'skipped' };
  }
}

module.exports = new OnboardingService();
