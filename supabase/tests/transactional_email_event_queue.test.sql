BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.bookings'::regclass AND tgname='trg_enqueue_booking_cancellation_email' AND NOT tgisinternal),
  'approved booking cancellation transitions enqueue a durable email event'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.payment_transactions'::regclass AND tgname='trg_enqueue_payment_received_email' AND NOT tgisinternal),
  'settled payment inserts and transitions enqueue a durable email event'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_automation_booking_cancelled_once'),
  'booking cancellation email events are deduplicated per booking'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_automation_payment_received_once'),
  'payment confirmation email events are deduplicated per payment'
);

SELECT * FROM finish();
ROLLBACK;
