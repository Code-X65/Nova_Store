-- 1. Create onboarding_questions table
CREATE TABLE IF NOT EXISTS onboarding_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question_key TEXT UNIQUE NOT NULL,           -- e.g., 'user_type', 'industry', 'feature_interest'
  question_text TEXT NOT NULL,                  -- Display text
  question_type TEXT NOT NULL,                  -- 'single_choice', 'multiple_choice', 'text', 'boolean', 'select'
  options JSONB,                                -- For choice questions [{"label":"...", "value":"..."}]
  is_required BOOLEAN DEFAULT FALSE,
  step_order INT NOT NULL,                      -- Order in which question appears
  depends_on TEXT,                              -- question_key this depends on (conditional logic)
  dependency_value TEXT,                        -- Value required in previous answer to show this
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create onboarding_user_answers table
CREATE TABLE IF NOT EXISTS onboarding_user_answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES onboarding_questions(id) ON DELETE CASCADE,
  answer_value JSONB NOT NULL,                  -- Stores answer(s): string, number, array, boolean
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, question_id)                  -- One answer per user per question
);

CREATE INDEX IF NOT EXISTS idx_onboarding_answers_user_id ON onboarding_user_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_answers_question_id ON onboarding_user_answers(question_id);

-- Disable RLS for backend management
ALTER TABLE onboarding_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_user_answers DISABLE ROW LEVEL SECURITY;
