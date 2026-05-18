# Onboarding System - Backend Plan

## Overview
When a user logs in for the first time, they will be required to complete an onboarding questionnaire before accessing the dashboard. The system will track onboarding progress and status. Users can complete or skip onboarding. Skipping is irreversible.

---

## Database Schema

### Existing `users` table (extended usage)
The `users` table already includes:
- `onboarding_status` (TEXT) - `not_started`, `in_progress`, `completed`, `skipped`
- `onboarding_started_at` (TIMESTAMP)
- `onboarding_completed_at` (TIMESTAMP)
- `features` (JSONB) - Holds feature access flags derived from onboarding answers
- `preferences` (JSONB) - User preferences set during onboarding

### New Table: `onboarding_questions`
Stores the questionnaire content and flow logic.

```sql
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
```

### New Table: `onboarding_user_answers`
Stores user responses to onboarding questions.

```sql
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
```

---

## API Endpoints

### 1. GET `/api/onboarding/status`
**Purpose:** Check if the logged-in user needs to complete onboarding. Used by frontend to redirect to onboarding flow or dashboard.

**Request:**
- Headers: `Authorization: Bearer <accessToken>`
- No body

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "requiresOnboarding": true,           // true if status is 'not_started' or 'in_progress'
    "status": "not_started",              // not_started | in_progress | completed | skipped
    "startedAt": null,                    // ISO date or null
    "completedAt": null,                  // ISO date or null
    "currentStep": 1,                     // Next step number (1-based), null if completed/skipped
    "totalSteps": 5                       // Total question count
  }
}
```

**Response (401/404):** Standard auth errors

---

### 2. GET `/api/onboarding/questions`
**Purpose:** Fetch all onboarding questions (or up to a specific step) with their structure. Frontend uses this to render the questionnaire.

**Request:**
- Headers: `Authorization: Bearer <accessToken>`
- Query: `?step=<n>` (optional - limit to specific step)
- Query: `?include_dependencies=true` (optional - expand conditional questions)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "id": "uuid",
        "key": "user_type",
        "text": "What type of user are you?",
        "type": "single_choice",
        "options": [
          {"label": "Individual", "value": "individual"},
          {"label": "Organization", "value": "organization"}
        ],
        "isRequired": true,
        "stepOrder": 1,
        "dependsOn": null,
        "dependencyValue": null
      },
      {
        "id": "uuid",
        "key": "company_size",
        "text": "What is your company size?",
        "type": "single_choice",
        "options": [{"label":"1-10","value":"1-10"},{"label":"11-50","value":"11-50"}],
        "isRequired": true,
        "stepOrder": 2,
        "dependsOn": "user_type",
        "dependencyValue": "organization"
      }
    ]
  }
}
```

---

### 3. POST `/api/onboarding/start`
**Purpose:** Mark onboarding as started. Called when user first enters the onboarding flow.

**Request:**
- Headers: `Authorization: Bearer <accessToken>`
- No body

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Onboarding started",
  "data": {
    "status": "in_progress",
    "startedAt": "2026-05-05T22:00:00Z"
  }
}
```

**Behavior:**
- Sets `users.onboarding_status = 'in_progress'`
- Sets `users.onboarding_started_at = NOW()`
- Returns error if already completed/skipped (409 Conflict)

---

### 4. POST `/api/onboarding/answer`
**Purpose:** Save or update a user's answer to a specific question.

**Request:**
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```json
{
  "questionKey": "user_type",            // question identifier
  "answer": "individual"                 // value matching question type
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Answer saved",
  "data": {
    "questionKey": "user_type",
    "answer": "individual",
    "answeredAt": "2026-05-05T22:01:00Z"
  }
}
```

**Behavior:**
- Inserts or updates `onboarding_user_answers`
- If answer changes, updates dependent cached features/preferences
- Validates answer format against question type

---

### 5. POST `/api/onboarding/complete`
**Purpose:** Mark onboarding as completed. Calculates and saves derived feature access based on answers.

**Request:**
- Headers: `Authorization: Bearer <accessToken>`
- No body (or optional `{ "skip": false }`)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Onboarding completed successfully",
  "data": {
    "status": "completed",
    "completedAt": "2026-05-05T22:05:00Z",
    "features": {                         // Derived feature access
      "analytics": true,
      "collaboration": false,
      "api_access": false,
      "advanced_reporting": true
    },
    "redirectTo": "/dashboard"            // Where frontend should navigate
  }
}
```

**Behavior:**
- Sets `users.onboarding_status = 'completed'`
- Sets `users.onboarding_completed_at = NOW()`
- Calls `calculateFeaturesFromAnswers()` to compute feature flags
- Updates `users.features` JSONB
- Optionally triggers welcome email

---

### 6. POST `/api/onboarding/skip`
**Purpose:** Allow user to skip onboarding entirely (irreversible).

**Request:**
- Headers: `Authorization: Bearer <accessToken>`
- No body

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Onboarding skipped. You can complete it later from settings.",
  "data": {
    "status": "skipped",
    "skippedAt": "2026-05-05T22:10:00Z"
  }
}
```

**Behavior:**
- Sets `users.onboarding_status = 'skipped'`
- Sets minimal/default `users.features` (basic access only)
- Deletes any partial `onboarding_user_answers` for this user
- Cannot be undone - user must contact support to reset

---

### 7. GET `/api/onboarding/summary`
**Purpose:** Get a summary of user's onboarding progress and saved answers. Used for review/resume page.

**Request:**
- Headers: `Authorization: Bearer <accessToken>`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "status": "in_progress",
    "progress": 60,                       // percentage (3 of 5 questions answered)
    "answers": [
      {
        "questionKey": "user_type",
        "questionText": "What type of user are you?",
        "answer": "individual"
      },
      {
        "questionKey": "industry",
        "questionText": "Which industry do you work in?",
        "answer": "technology"
      }
    ]
  }
}
```

---

### 8. PUT `/api/onboarding/resume` *(Optional)*
**Purpose:** Restart onboarding from a specific step if user wants to modify earlier answers. Only allowed if status is 'in_progress'.

**Request:**
- Headers: `Authorization: Bearer <accessToken>`
- Body:
```json
{
  "restartFromStep": 2                   // Optional - step number to restart from
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Onboarding reset to step 2",
  "data": {
    "status": "in_progress",
    "currentStep": 2
  }
}
```

**Behavior:**
- Deletes answers from step n onward
- Keeps earlier answers intact
- Updates `users.onboarding_started_at` if resetting from step 1

---

### 9. GET `/api/onboarding/admin/questions` *(Admin only - Optional)*
**Purpose:** Admin endpoint to manage onboarding questions (CRUD).

**Request:**
- Headers: `Authorization: Bearer <accessToken>`
- Role: ADMIN

**Response (200 OK):**
Same as `/api/onboarding/questions` but includes all admin metadata.

---

## Frontend Integration Flow

1. **After Login Success:**
   - Frontend receives `accessToken` and user object
   - Calls `GET /api/onboarding/status`
   - If `requiresOnboarding === true`, navigate to `/onboarding` route
   - Else, navigate to `/dashboard`

2. **Onboarding Page Sequence:**
   - Frontend calls `GET /api/onboarding/questions` to fetch all questions (or pages)
   - Displays step 1 question
   - On answer submit: `POST /api/onboarding/answer` with `questionKey` and `answer`
   - Store local state of answers
   - Move to next step
   - Repeat until all required questions answered

3. **Completion:**
   - User submits final answer
   - Frontend calls `POST /api/onboarding/complete`
   - Receives `features` and `redirectTo`
   - Redirect to dashboard

4. **Manual Access (Settings):**
   - User can access onboarding later via profile settings if `status === 'skipped'` or `in_progress`
   - If skipped, they may be allowed to restart (call `POST /api/onboarding/start` then continue)

---

## New Files to Create

### 1. `Backend/src/models/onboarding.model.js`
- `OnboardingModel` class
- Methods:
  - `getStatus(userId)` → returns status and progress
  - `getQuestions(step, includeDependencies)` → fetches questions
  - `start(userId)` → sets status = 'in_progress', started_at
  - `saveAnswer(userId, questionKey, answer)` → UPSERT into answers table
  - `getAnswers(userId)` → returns all answers for user
  - `complete(userId)` → sets status = 'completed', calculates features
  - `skip(userId)` → sets status = 'skipped', clears answers, sets default features
  - `getProgress(userId)` → percentage complete
  - `calculateFeaturesFromAnswers(userId)` → business logic to map answers to features

### 2. `Backend/src/controllers/onboarding.controller.js`
- `OnboardingController` class
- Methods mapping to endpoints above
- Error handling (409 if already completed, 400 if invalid answer)

### 3. `Backend/src/routes/onboarding.routes.js`
- Express Router with all onboarding endpoints
- Protected by `protect` middleware (authenticated users only)
- Swagger documentation for each endpoint

### 4. `Backend/sql/002_create_onboarding_tables.sql`
- SQL migration for `onboarding_questions` and `onboarding_user_answers`
- Seed data: sample questions (insert 5-10 default questions)

### 5. `Backend/src/services/onboarding.service.js` *(Optional)*
- Business logic for feature calculation
- Could be integrated into model if simple

---

## Feature Calculation Logic (Example)

Based on user answers, set `users.features` flags:

```javascript
// Example mapping (configurable)
const FEATURE_MAP = {
  analytics: { condition: 'user_type === "organization" OR industry === "technology"' },
  collaboration: { condition: 'team_size > 5 OR user_type === "organization"' },
  api_access: { condition: 'use_case === "integration" OR membership_level !== "BRONZE"' },
  advanced_reporting: { condition: 'needs_reports === true' }
};
```

This logic will live in `OnboardingModel.calculateFeaturesFromAnswers()`.

---

## Error Handling & Edge Cases

- **Already onboarded:** Return 409 if trying to start/answer on completed/skipped user
- **Missing required answers:** Block `complete` endpoint until all required questions have answers
- **Skipping allowed only once:** Mark as `skipped` permanently
- **Partial progress:** User can close and re-enter; answers are saved
- **Dependencies:** Frontend should filter questions client-side based on previous answers, but backend validates on `answer` endpoint
- **Token expiry:** Onboarding can be long; ensure JWT access tokens are refreshed automatically (already have `/refresh-token`)

---

## Middleware Impact

No new middleware needed. Use existing:
- `protect` - protects all routes
- `validate` (Joi) - will add schemas for answer validation

---

## Testing Considerations

Unit tests for:
- `OnboardingModel` methods
- Feature calculation logic
- API endpoints integration (supertest)
- Edge cases (already completed, skipping, dependencies)

---

## Future Enhancements

- Admin UI to edit questions dynamically
- Analytics on onboarding completion rate
- Email reminders for incomplete onboarding
- Multi-language questionnaire (i18n)
- A/B testing different question sets
- Progress bar API with time tracking

---

## Implementation Order

1. Create SQL tables + seed questions
2. Create `OnboardingModel`
3. Create `OnboardingController`
4. Create `OnboardingRoutes` + register in `server.js`
5. Add Swagger docs
6. Write tests
7. Seed initial questions data
8. Frontend integration (out of scope for this backend plan)
