-- The tamper-evidence hash chain previously computed prev_record_hash via a
-- separate SELECT (JS-side, no locking) before a separate INSERT. Two
-- concurrent audit writes could both read the same "latest" row and produce
-- a forked/broken chain even with no real tampering, and a transient lookup
-- failure silently inserted a row with NULL hashes, permanently breaking the
-- chain from that point with no error surfaced. Move the read+hash+insert
-- into a single atomic function serialized by an advisory lock, so the whole
-- sequence runs as one statement on one connection — the only way to close
-- this race under Supabase/PostgREST's pooled-connection model, where
-- separate .rpc()/.insert() calls are NOT guaranteed to share a transaction.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION insert_audit_log_with_chain(p_row JSONB, p_chain_payload TEXT)
RETURNS audit_logs AS $$
DECLARE
  v_prev_hash TEXT;
  v_record_hash TEXT;
  v_result audit_logs;
BEGIN
  -- Serializes concurrent callers so the "read latest hash" + "insert next
  -- hash" sequence below can never interleave across two audit writes.
  PERFORM pg_advisory_xact_lock(hashtext('audit_log_chain'));

  SELECT record_hash INTO v_prev_hash FROM audit_logs ORDER BY created_at DESC LIMIT 1;
  IF v_prev_hash IS NULL THEN
    v_prev_hash := 'GENESIS';
  END IF;

  v_record_hash := encode(digest(v_prev_hash || '|' || p_chain_payload, 'sha256'), 'hex');

  INSERT INTO audit_logs (
    user_id, action, resource_type, resource_id, old_values, new_values,
    ip_address, user_agent, request_id, event_id, severity, action_type,
    actor_full_name, actor_role, actor_session_id, delta, summary,
    resource_sku, resource_name, resource_category, context_location,
    context_batch_lot, delta_numeric, reason_code, device_info,
    record_hash, prev_record_hash
  )
  VALUES (
    NULLIF(p_row->>'user_id', '')::UUID,
    p_row->>'action',
    p_row->>'resource_type',
    NULLIF(p_row->>'resource_id', '')::UUID,
    p_row->'old_values',
    p_row->'new_values',
    NULLIF(p_row->>'ip_address', '')::INET,
    p_row->>'user_agent',
    p_row->>'request_id',
    p_row->>'event_id',
    COALESCE(p_row->>'severity', 'info'),
    p_row->>'action_type',
    p_row->>'actor_full_name',
    p_row->>'actor_role',
    p_row->>'actor_session_id',
    p_row->'delta',
    p_row->>'summary',
    p_row->>'resource_sku',
    p_row->>'resource_name',
    p_row->>'resource_category',
    p_row->>'context_location',
    p_row->>'context_batch_lot',
    NULLIF(p_row->>'delta_numeric', '')::INT,
    p_row->>'reason_code',
    p_row->'device_info',
    v_record_hash,
    v_prev_hash
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
