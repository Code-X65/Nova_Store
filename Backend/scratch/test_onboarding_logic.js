const onboardingModel = require('../src/models/onboarding.model');
const supabase = require('../src/config/supabase');

async function testOnboardingFlow() {
  console.log('--- Testing Onboarding Logic ---');

  // 1. Fetch all questions for Step 1
  console.log('\n[Scenario 1] Fetching Step 1 questions:');
  const step1 = await onboardingModel.getQuestions(1);
  console.log(step1.map(q => `Step ${q.step_order}: ${q.question_text} (Key: ${q.question_key})`));

  // 2. Simulate conditional filtering logic
  console.log('\n[Scenario 2] Simulating Logic for "Organization" user:');
  const allQuestions = await onboardingModel.getQuestions();
  
  // Mocking the behavior where a user has answered 'organization' for 'user_type'
  const userAnswers = [
    { question_key: 'user_type', answer_value: 'organization' }
  ];

  const organizationFlow = allQuestions.filter(q => {
    if (!q.depends_on) return true;
    const dependencyMatch = userAnswers.find(a => a.question_key === q.depends_on && a.answer_value === q.dependency_value);
    return !!dependencyMatch;
  });

  console.log('Questions visible to Organization:');
  organizationFlow.forEach(q => console.log(`- ${q.question_key}: ${q.question_text}`));

  // 3. Simulating Logic for "Individual" user:
  console.log('\n[Scenario 3] Simulating Logic for "Individual" user:');
  const userAnswersIndividual = [
    { question_key: 'user_type', answer_value: 'individual' }
  ];

  const individualFlow = allQuestions.filter(q => {
    if (!q.depends_on) return true;
    const dependencyMatch = userAnswersIndividual.find(a => a.question_key === q.depends_on && a.answer_value === q.dependency_value);
    return !!dependencyMatch;
  });

  console.log('Questions visible to Individual:');
  individualFlow.forEach(q => console.log(`- ${q.question_key}: ${q.question_text}`));
}

// Note: This script requires valid DB connection to run
// testOnboardingFlow().catch(console.error);
