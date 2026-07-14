-- ============================================================
-- 090: Analytics Intelligence (Phase 8)
-- ============================================================

-- Sales forecasting snapshots
CREATE TABLE IF NOT EXISTS forecast_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric TEXT NOT NULL CHECK (metric IN ('revenue','orders','customers','aov')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  forecast_value NUMERIC NOT NULL,
  confidence_low NUMERIC,
  confidence_high NUMERIC,
  model_name TEXT DEFAULT 'seasonal_naive',
  actual_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forecast_metric_period ON forecast_snapshots(metric, period_start);

ALTER TABLE forecast_snapshots DISABLE ROW LEVEL SECURITY;
