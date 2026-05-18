-- Seed Onboarding Questions
INSERT INTO onboarding_questions (question_key, question_text, question_type, options, is_required, step_order, depends_on, dependency_value)
VALUES 
-- Step 1: User Type
(
  'user_type', 
  'What type of user are you?', 
  'single_choice', 
  '[{"label": "Individual", "value": "individual"}, {"label": "Organization", "value": "organization"}]'::jsonb, 
  true, 
  1, 
  null, 
  null
),

-- Step 2: Industry (Only for Organizations)
(
  'industry', 
  'Which industry does your organization operate in?', 
  'select', 
  '[{"label": "Technology", "value": "technology"}, {"label": "Finance", "value": "finance"}, {"label": "Retail", "value": "retail"}, {"label": "Healthcare", "value": "healthcare"}]'::jsonb, 
  true, 
  2, 
  'user_type', 
  'organization'
),

-- Step 2: Personal Goals (Only for Individuals)
(
  'personal_goals', 
  'What are your primary goals with Nova Store?', 
  'multiple_choice', 
  '[{"label": "Personal Shopping", "value": "shopping"}, {"label": "Market Research", "value": "research"}, {"label": "Learning", "value": "learning"}]'::jsonb, 
  true, 
  2, 
  'user_type', 
  'individual'
),

-- Step 3: Reporting Needs (For everyone)
(
  'needs_reports', 
  'Do you require advanced analytics reports?', 
  'boolean', 
  null, 
  false, 
  3, 
  null, 
  null
),

-- Step 4: Referral Source
(
  'referral_source', 
  'How did you hear about us?', 
  'select', 
  '[{"label": "Social Media", "value": "social"}, {"label": "Friend/Colleague", "value": "referral"}, {"label": "Search Engine", "value": "search"}, {"label": "Other", "value": "other"}]'::jsonb, 
  false, 
  4, 
  null, 
  null
)
ON CONFLICT (question_key) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  question_type = EXCLUDED.question_type,
  options = EXCLUDED.options,
  step_order = EXCLUDED.step_order,
  depends_on = EXCLUDED.depends_on,
  dependency_value = EXCLUDED.dependency_value;
