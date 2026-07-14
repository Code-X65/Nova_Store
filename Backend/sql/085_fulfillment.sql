-- ============================================================
-- 085: 3PL / Fulfillment Provider Integrations (Phase 5 §7.1)
-- ============================================================
-- Registers external fulfillment providers (ShipBob, Fegex, local
-- couriers) with adapter identifiers + encrypted-ish config, and
-- tracks shipments handed off to providers (webhook-ingested status).
-- ============================================================

CREATE TABLE IF NOT EXISTS fulfillment_providers (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT NOT NULL UNIQUE,            -- 'shipbob','fegex','local'
  adapter         TEXT NOT NULL DEFAULT 'local',  -- services/fulfillment/<adapter>.adapter.js
  is_enabled      BOOLEAN DEFAULT TRUE,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  webhook_secret  TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_providers_store ON fulfillment_providers(store_id);

ALTER TABLE fulfillment_providers DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS fulfillment_shipments (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  store_id            UUID REFERENCES stores(id) ON DELETE SET NULL,
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider_id         UUID NOT NULL REFERENCES fulfillment_providers(id) ON DELETE CASCADE,
  external_shipment_id TEXT,
  status              TEXT NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created','label_generated','picked_up','in_transit','out_for_delivery','delivered','exception','cancelled')),
  tracking_number     TEXT,
  label_url           TEXT,
  raw_payload         JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_shipments_order ON fulfillment_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_shipments_provider ON fulfillment_shipments(provider_id);

ALTER TABLE fulfillment_shipments DISABLE ROW LEVEL SECURITY;
