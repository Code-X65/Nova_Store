-- 1. Add title column to product_reviews
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS title TEXT;

-- 2. Add helpful_count column
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS helpful_count INT DEFAULT 0;

-- 3. Create review_helpfulness table
CREATE TABLE IF NOT EXISTS review_helpfulness (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,            -- true=helpful, false=unhelpful
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, user_id)              -- One vote per user per review
);

CREATE INDEX IF NOT EXISTS idx_review_helpfulness_review ON review_helpfulness(review_id);
CREATE INDEX IF NOT EXISTS idx_review_helpfulness_user ON review_helpfulness(user_id);

-- 4. Trigger to maintain helpful_count
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.is_helpful = TRUE THEN
      UPDATE product_reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.is_helpful = TRUE THEN
      UPDATE product_reviews SET helpful_count = helpful_count - 1 WHERE id = OLD.review_id;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.is_helpful = TRUE AND OLD.is_helpful = FALSE THEN
      UPDATE product_reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id;
    ELSIF NEW.is_helpful = FALSE AND OLD.is_helpful = TRUE THEN
      UPDATE product_reviews SET helpful_count = helpful_count - 1 WHERE id = NEW.review_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_review_helpful_count ON review_helpfulness;
CREATE TRIGGER trg_review_helpful_count
AFTER INSERT OR UPDATE OR DELETE ON review_helpfulness
FOR EACH ROW EXECUTE FUNCTION update_review_helpful_count();
