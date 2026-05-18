const supabase = require('../config/supabase');

class OnboardingModel {
  async getStatus(userId) {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('onboarding_status, onboarding_started_at, onboarding_completed_at')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    const { data: questions, error: qError } = await supabase
      .from('onboarding_questions')
      .select('id', { count: 'exact' });
    
    if (qError) throw qError;

    const { data: answers, error: aError } = await supabase
      .from('onboarding_user_answers')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);
    
    if (aError) throw aError;

    const totalSteps = questions.length;
    const answeredCount = answers.length;
    
    return {
      requiresOnboarding: user.onboarding_status === 'not_started' || user.onboarding_status === 'in_progress',
      status: user.onboarding_status,
      startedAt: user.onboarding_started_at,
      completedAt: user.onboarding_completed_at,
      currentStep: user.onboarding_status === 'completed' || user.onboarding_status === 'skipped' ? null : answeredCount + 1,
      totalSteps: totalSteps,
      progress: totalSteps > 0 ? Math.round((answeredCount / totalSteps) * 100) : 0
    };
  }

  async getQuestions(step = null, includeDependencies = false) {
    let query = supabase
      .from('onboarding_questions')
      .select('*')
      .order('step_order', { ascending: true });

    if (step) {
      query = query.eq('step_order', step);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async start(userId) {
    const { data, error } = await supabase
      .from('users')
      .update({
        onboarding_status: 'in_progress',
        onboarding_started_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('onboarding_status, onboarding_started_at')
      .single();

    if (error) throw error;
    return data;
  }

  async saveAnswer(userId, questionKey, answerValue) {
    const { data: question, error: qError } = await supabase
      .from('onboarding_questions')
      .select('id')
      .eq('question_key', questionKey)
      .single();

    if (qError) throw qError;

    const { data, error } = await supabase
      .from('onboarding_user_answers')
      .upsert({
        user_id: userId,
        question_id: question.id,
        answer_value: answerValue,
        answered_at: new Date().toISOString()
      }, { onConflict: 'user_id,question_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getAnswers(userId) {
    const { data, error } = await supabase
      .from('onboarding_user_answers')
      .select('answer_value, onboarding_questions(question_key, question_text)')
      .eq('user_id', userId);

    if (error) throw error;
    
    return data.map(a => ({
      questionKey: a.onboarding_questions.question_key,
      questionText: a.onboarding_questions.question_text,
      answer: a.answer_value
    }));
  }

  async complete(userId) {
    const features = await this.calculateFeaturesFromAnswers(userId);
    
    const { data, error } = await supabase
      .from('users')
      .update({
        onboarding_status: 'completed',
        onboarding_completed_at: new Date().toISOString(),
        features: features
      })
      .eq('id', userId)
      .select('onboarding_status, onboarding_completed_at, features')
      .single();

    if (error) throw error;
    return data;
  }

  async skip(userId) {
    // Clear partial answers as per plan
    await supabase
      .from('onboarding_user_answers')
      .delete()
      .eq('user_id', userId);

    const defaultFeatures = { analytics: false, collaboration: false, api_access: false, advanced_reporting: false };
    
    const { data, error } = await supabase
      .from('users')
      .update({
        onboarding_status: 'skipped',
        onboarding_completed_at: new Date().toISOString(), // Use completed_at or skipped_at? Plan says skippedAt in response but uses completed_at in DB
        features: defaultFeatures
      })
      .eq('id', userId)
      .select('onboarding_status, onboarding_completed_at')
      .single();

    if (error) throw error;
    return data;
  }

  async calculateFeaturesFromAnswers(userId) {
    const answers = await this.getAnswers(userId);
    const features = { analytics: false, collaboration: false, api_access: false, advanced_reporting: false };

    answers.forEach(a => {
      const { questionKey, answer } = a;
      
      if (questionKey === 'user_type' && answer === 'organization') {
        features.analytics = true;
        features.collaboration = true;
      }
      
      if (questionKey === 'industry' && answer === 'technology') {
        features.api_access = true;
      }

      if (questionKey === 'needs_reports' && answer === true) {
        features.advanced_reporting = true;
      }
    });

    return features;
  }
}

module.exports = new OnboardingModel();
