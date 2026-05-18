-- Review Reporting & Moderation Queue (Item 16)

-- 1. Reported reviews table — tracks individual flag submissions
CREATE TABLE IF NOT EXISTS review_reports (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  review_id       UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  reporter_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,                  -- e.g. "spam", "inappropriate", "fake"
  description     TEXT,                           -- Optional free-text detail
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  resolved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMP WITH TIME ZONE,
  admin_note      TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_reports_review   ON review_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status   ON review_reports(status);
CREATE INDEX IF NOT EXISTS idx_review_reports_reporter ON review_reports(reporter_id);

-- 2. Add 'reported' to the product_reviews status check constraint
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'product_reviews'::regclass
    AND conname LIKE '%status%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE product_reviews DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END IF;

  EXECUTE 'ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS reported_count INT DEFAULT 0';
    EXECUTE format(
      'ALTER TABLE product_reviews ADD CONSTRAINT %I CHECK (status IN (''approved'',''pending'',''hidden'',''deleted'',''reported''))',
      'product_reviews_status_check'
    );
END $$;

-- 3. Trigger — increment reported_count on each new report
CREATE OR REPLACE FUNCTION bump_review_reported_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE product_reviews SET reported_count = reported_count + 1 WHERE id = NEW.review_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bump_reported_count ON review_reports;
CREATE TRIGGER trg_bump_reported_count
AFTER INSERT ON review_reports
FOR EACH ROW EXECUTE FUNCTION bump_review_reported_count();

ALTER TABLE review_reports DISABLE ROW LEVEL SECURITY;
