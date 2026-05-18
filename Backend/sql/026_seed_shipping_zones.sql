-- Seed Shipping Zones (continental + island regions commonly used in e-commerce)
INSERT INTO shipping_zones (name, countries, states, is_active) VALUES
  ('Continental US',     '{US}'::text[],          '["*"]'::jsonb,   TRUE),
  ('Canada',             '{CA}'::text[],          '["*"]'::jsonb,   TRUE),
  ('UK & EU',            '{GB,IE,DE,FR,ES,IT,NL,BE,SE,PT,AT,DK,FI,GR,CZ,HU,PL}'::text[], '["*"]'::jsonb, TRUE),
  ('West Africa',        '{NG,GH,KE,ZA,EG,TZ,UG}'::text[], '["*"]'::jsonb, TRUE),
  ('Australia & NZ',     '{AU,NZ}'::text[],       '["*"]'::jsonb,   TRUE),
  ('Rest of World',      '{*}'::text[],           '["*"]'::jsonb,   TRUE)
ON CONFLICT DO NOTHING;

-- Seed Shipping Rates (tied to zones by name lookup)
DO $$
DECLARE
  v_zone_id UUID;
BEGIN
  -- Standard rates for each zone
  SELECT id INTO v_zone_id FROM shipping_zones WHERE name = 'Continental US';
  IF v_zone_id IS NOT NULL THEN
    INSERT INTO shipping_rates (zone_id, name, rate, estimated_days_min, estimated_days_max, is_active)
    VALUES
      (v_zone_id, 'Standard',  5.99,  3,  7,  TRUE),
      (v_zone_id, 'Express',  15.99,  1,  2,  TRUE),
      (v_zone_id, 'Overnight', 29.99,  1,  1,  TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO v_zone_id FROM shipping_zones WHERE name = 'Canada';
  IF v_zone_id IS NOT NULL THEN
    INSERT INTO shipping_rates (zone_id, name, rate, estimated_days_min, estimated_days_max, is_active)
    VALUES
      (v_zone_id, 'Standard',  8.99,  5, 10,  TRUE),
      (v_zone_id, 'Express',  22.99,  2,  5,  TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO v_zone_id FROM shipping_zones WHERE name = 'UK & EU';
  IF v_zone_id IS NOT NULL THEN
    INSERT INTO shipping_rates (zone_id, name, rate, estimated_days_min, estimated_days_max, is_active)
    VALUES
      (v_zone_id, 'Standard', 12.99,  5, 10,  TRUE),
      (v_zone_id, 'Express', 28.99,  2,  4,  TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO v_zone_id FROM shipping_zones WHERE name = 'West Africa';
  IF v_zone_id IS NOT NULL THEN
    INSERT INTO shipping_rates (zone_id, name, rate, estimated_days_min, estimated_days_max, is_active)
    VALUES
      (v_zone_id, 'Standard', 18.99,  7, 14,  TRUE),
      (v_zone_id, 'Express', 42.99,  3,  6,  TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO v_zone_id FROM shipping_zones WHERE name = 'Australia & NZ';
  IF v_zone_id IS NOT NULL THEN
    INSERT INTO shipping_rates (zone_id, name, rate, estimated_days_min, estimated_days_max, is_active)
    VALUES
      (v_zone_id, 'Standard', 14.99,  7, 14,  TRUE),
      (v_zone_id, 'Express', 35.99,  3,  5,  TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO v_zone_id FROM shipping_zones WHERE name = 'Rest of World';
  IF v_zone_id IS NOT NULL THEN
    INSERT INTO shipping_rates (zone_id, name, rate, estimated_days_min, estimated_days_max, is_active)
    VALUES
      (v_zone_id, 'Standard', 22.99, 10, 21,  TRUE),
      (v_zone_id, 'Express', 55.99,  5, 10,  TRUE)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
