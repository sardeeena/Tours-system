BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

SELECT ok(
  EXISTS (SELECT 1 FROM pgmq.list_queues() WHERE queue_name = 'booking_notifications'),
  'durable booking notification queue exists'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'communication_messages'
      AND column_name = 'automation_event_id'
  ),
  'communication messages link to their originating automation event'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_comm_messages_automation_event_channel'
  ),
  'one automated message per event and channel is enforced'
);

SELECT ok(
  has_function_privilege('service_role', 'public.read_booking_notification_queue(integer)', 'EXECUTE'),
  'service role can consume notification queue messages'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.read_booking_notification_queue(integer)', 'EXECUTE'),
  'anonymous clients cannot consume notification queue messages'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.read_booking_notification_queue(integer)', 'EXECUTE'),
  'authenticated clients cannot consume notification queue messages'
);

INSERT INTO public.tours (title, slug, status, price, max_guests)
VALUES ('pgTAP Notification Test Tour', 'pgtap-notification-test', 'published', 100.00, 10);

CREATE TEMP TABLE notification_test_state (
  booking JSONB NOT NULL
) ON COMMIT DROP;

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', TRUE);

INSERT INTO notification_test_state (booking)
SELECT public.create_booking_atomic(
  'pgtap-notification-test',
  CURRENT_DATE + 30,
  1, 0, 0,
  'Notification', 'Guest',
  'notification-test@example.test',
  '+201000000009',
  'Egypt',
  'Test Hotel',
  NULL,
  NULL,
  '[]'::jsonb,
  NULL,
  'pay_at_pickup',
  NULL,
  'idem_pgtap_notification_booking_0001'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.automation_events e
    WHERE e.event_name = 'booking.created'
      AND e.entity_id = (SELECT booking->>'bookingId' FROM notification_test_state)
      AND e.processed = FALSE
  ),
  'booking creation writes a durable unprocessed automation event'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pgmq.q_booking_notifications q
    WHERE q.message->>'event_name' = 'booking.created'
      AND q.message->>'event_id' = (
        SELECT e.id::text
        FROM public.automation_events e
        WHERE e.event_name = 'booking.created'
          AND e.entity_id = (SELECT booking->>'bookingId' FROM notification_test_state)
        ORDER BY e.created_at DESC
        LIMIT 1
      )
  ),
  'booking creation enqueues its notification in the same transaction'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.staff_notifications n
    WHERE n.dedup_key = 'booking-created:' || (SELECT booking->>'bookingId' FROM notification_test_state)
  ),
  'booking creation creates a deduplicated staff notification'
);

SELECT * FROM finish();
ROLLBACK;
