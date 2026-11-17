-- Keep cancellation approval compatible with the idempotent email-event trigger.
-- The AFTER UPDATE trigger queues booking.cancelled in the same transaction.
-- The RPC's audit event insert must not violate the unique per-booking event index.
BEGIN;
CREATE OR REPLACE FUNCTION private.admin_resolve_booking_cancellation(p_reference text, p_decision text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_booking RECORD;
  v_previous_status TEXT;
  v_guest_count INTEGER;
  v_new_booked_count INTEGER;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' AND NOT public.has_permission('bookings.approve') THEN
    RAISE EXCEPTION 'Administrator authorization is required to resolve cancellation requests.'
      USING ERRCODE = '42501';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Decision must be approve or reject.');
  END IF;

  SELECT b.* INTO v_booking
  FROM public.bookings AS b
  WHERE b.booking_reference = UPPER(TRIM(p_reference))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Booking not found.');
  END IF;

  IF p_decision = 'approve' AND v_booking.status = 'cancelled' THEN
    RETURN JSONB_BUILD_OBJECT('success', TRUE, 'bookingReference', v_booking.booking_reference, 'status', 'cancelled', 'alreadyResolved', TRUE);
  END IF;

  IF p_decision = 'reject' AND v_booking.status <> 'cancellation_requested' THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'This booking has no pending cancellation request.');
  END IF;

  IF p_decision = 'approve' AND v_booking.status NOT IN ('cancellation_requested', 'pending', 'confirmed') THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'This booking cannot be cancelled in its current state.');
  END IF;

  v_previous_status := COALESCE(
    v_booking.cancellation_previous_status,
    CASE WHEN v_booking.status = 'cancellation_requested' THEN 'confirmed' ELSE v_booking.status END
  );

  IF p_decision = 'reject' THEN
    UPDATE public.bookings
    SET status = v_previous_status,
        cancellation_previous_status = NULL,
        cancellation_requested_at = NULL,
        updated_at = NOW()
    WHERE id = v_booking.id;

    INSERT INTO public.audit_logs (action, entity_type, entity_id, old_data, new_data)
    VALUES (
      'BOOKING_CANCELLATION_REJECTED',
      'booking',
      v_booking.id::text,
      JSONB_BUILD_OBJECT('status', 'cancellation_requested'),
      JSONB_BUILD_OBJECT('status', v_previous_status, 'reason', LEFT(COALESCE(p_reason, ''), 500))
    );

    INSERT INTO public.automation_events (event_name, payload, entity_type, entity_id)
    VALUES (
      'booking.updated',
      JSONB_BUILD_OBJECT('bookingReference', v_booking.booking_reference, 'status', v_previous_status, 'cancellationDecision', 'rejected'),
      'booking',
      v_booking.id::text
    );

    RETURN JSONB_BUILD_OBJECT('success', TRUE, 'bookingReference', v_booking.booking_reference, 'status', v_previous_status);
  END IF;

  v_guest_count := COALESCE(v_booking.adult_count, 0) + COALESCE(v_booking.child_count, 0) + COALESCE(v_booking.infant_count, 0);

  UPDATE public.bookings
  SET status = 'cancelled',
      cancellation_previous_status = NULL,
      cancellation_requested_at = NULL,
      cancellation_reason = COALESCE(NULLIF(LEFT(TRIM(p_reason), 500), ''), cancellation_reason),
      updated_at = NOW()
  WHERE id = v_booking.id;

  UPDATE public.tour_availability AS ta
  SET booked_count = ta.booked_count - v_guest_count,
      status = CASE
        WHEN ta.status = 'sold_out' AND (ta.booked_count - v_guest_count) < ta.max_capacity THEN 'available'
        ELSE ta.status
      END,
      updated_at = NOW()
  WHERE ta.tour_id = v_booking.tour_id
    AND ta.date = v_booking.booking_date
    AND ta.booked_count >= v_guest_count;

  GET DIAGNOSTICS v_new_booked_count = ROW_COUNT;
  IF v_new_booked_count <> 1 THEN
    RAISE EXCEPTION 'Cannot approve cancellation: availability capacity is missing or inconsistent for booking %.', v_booking.booking_reference
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, old_data, new_data)
  VALUES (
    'BOOKING_CANCELLATION_APPROVED',
    'booking',
    v_booking.id::text,
    JSONB_BUILD_OBJECT('status', 'cancellation_requested', 'guestCount', v_guest_count),
    JSONB_BUILD_OBJECT('status', 'cancelled', 'reason', LEFT(COALESCE(p_reason, ''), 500), 'availabilityRowsUpdated', v_new_booked_count)
  );

  INSERT INTO public.automation_events (event_name, payload, entity_type, entity_id)
  VALUES (
    'booking.cancelled',
    JSONB_BUILD_OBJECT('bookingReference', v_booking.booking_reference, 'reason', LEFT(COALESCE(p_reason, ''), 500), 'capacityReleased', v_guest_count),
    'booking',
    v_booking.id::text
  )
  ON CONFLICT DO NOTHING;

  RETURN JSONB_BUILD_OBJECT('success', TRUE, 'bookingReference', v_booking.booking_reference, 'status', 'cancelled', 'capacityReleased', v_guest_count);
END;
$function$

COMMIT;
