-- ============================================================
-- 086: Last-Mile Rider Tracking & Proof-of-Delivery (Phase 5 §7.2)
-- ============================================================
-- Extends riders / dispatches with live location pings, geofence
-- ETA, and richer proof-of-delivery (photo + signature + geo pin).
-- ============================================================

-- Live location pings from rider mobile clients
CREATE TABLE IF NOT EXISTS rider_location_pings (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rider_id     UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  heading      NUMERIC,
  speed        NUMERIC,
  accuracy_m   NUMERIC,
  captured_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rider_pings_rider     ON rider_location_pings(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_pings_order     ON rider_location_pings(order_id);
CREATE INDEX IF NOT EXISTS idx_rider_pings_captured  ON rider_location_pings(captured_at);

ALTER TABLE rider_location_pings DISABLE ROW LEVEL SECURITY;

-- Enrich delivery dispatches with POD + geofence data
ALTER TABLE delivery_dispatches
  ADD COLUMN IF NOT EXISTS pod_photo_url   TEXT,
  ADD COLUMN IF NOT EXISTS pod_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS delivered_lat   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivered_lng   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geofence_eta_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_pod ON delivery_dispatches(pod_photo_url);
