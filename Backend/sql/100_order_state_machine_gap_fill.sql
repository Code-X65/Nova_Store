-- Consolidating all order.status mutations (updateOrderStatus, the manual
-- delivery milestone methods, cancelOrder, and PaymentService.handleSuccessfulPayment)
-- to validate against order_status_transitions (082) as the single source of
-- truth. A few transitions that the application code already allows today were
-- missing from the original seed — add them here first so consolidation doesn't
-- silently break currently-working flows.

INSERT INTO order_status_transitions (from_status, to_status, requires_note, is_terminal, description)
VALUES
  -- markReadyForDispatch allows packing directly from a freshly-placed order.
  ('pending', 'ready_for_dispatch', false, false, 'Packed and ready (fast-tracked from pending)'),
  -- ORDER_STAFF's updateOrderStatus allowlist and markDelivered both allow a
  -- direct dispatched -> delivered shortcut for small/local orders that skip
  -- an explicit "out for delivery" tracking step.
  ('dispatched', 'delivered', false, false, 'Delivered directly without a separate out-for-delivery step'),
  -- cancelOrder currently permits cancelling an order at any point up through
  -- delivery_attempted (only shipped/delivered/cancelled/returned/refunded are
  -- blocked) — the state machine graph didn't yet model cancellation from the
  -- dispatch/delivery-attempt stages.
  ('dispatched', 'cancelled', true, true, 'Cancel after dispatch (e.g. customer refusal)'),
  ('out_for_delivery', 'cancelled', true, true, 'Cancel while out for delivery'),
  ('delivery_attempted', 'cancelled', true, true, 'Cancel after a failed delivery attempt')
ON CONFLICT (from_status, to_status) DO UPDATE SET
  requires_note = EXCLUDED.requires_note,
  is_terminal   = EXCLUDED.is_terminal,
  description   = EXCLUDED.description;
