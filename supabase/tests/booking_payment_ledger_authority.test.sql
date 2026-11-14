BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

INSERT INTO public.tours (id, title, slug, status, price, max_guests)
VALUES (
  'f6100000-0000-4000-8000-000000000001',
  'Ledger Authority Test Tour',
  'ledger-authority-test-tour',
  'published',
  100,
  12
);

INSERT INTO public.bookings (
  id, booking_reference, tour_id, booking_date, total, currency, payment_status
)
VALUES (
  'f6200000-0000-4000-8000-000000000001',
  'LEDGER-AUTH-20261114',
  'f6100000-0000-4000-8000-000000000001',
  CURRENT_DATE + 1,
  100,
  'EUR',
  'pending'
);

INSERT INTO public.payment_providers (
  id, name, provider_type, is_connected, is_manual, supported_currencies, description
)
VALUES (
  'cash',
  'Cash collection (manual)',
  'manual',
  true,
  true,
  ARRAY['EUR', 'USD', 'GBP', 'EGP'],
  'Test-only manual payment provider fixture'
)
ON CONFLICT (id) DO UPDATE
SET is_connected = true,
    is_manual = true,
    supported_currencies = ARRAY['EUR', 'USD', 'GBP', 'EGP'];

INSERT INTO public.payment_transactions (
  id, booking_id, booking_reference, amount, currency, payment_method, status, transaction_reference
)
VALUES (
  'f6300000-0000-4000-8000-000000000001',
  'f6200000-0000-4000-8000-000000000001',
  'LEDGER-AUTH-20261114',
  40,
  'EUR',
  'Cash',
  'Paid',
  'LEDGER-AUTH-SEED-PAYMENT'
);

INSERT INTO public.refund_records (
  id, booking_id, payment_id, amount, requested_amount, approved_amount,
  currency, reason, refund_method, status, booking_reference
)
VALUES (
  'f6400000-0000-4000-8000-000000000001',
  'f6200000-0000-4000-8000-000000000001',
  'f6300000-0000-4000-8000-000000000001',
  10,
  10,
  10,
  'EUR',
  'Ledger authority test partial refund',
  'Cash Return',
  'processed',
  'LEDGER-AUTH-20261114'
);

SELECT set_config('request.jwt.claim.role', 'service_role', true);

UPDATE public.bookings
SET payment_status = 'partially_paid'
WHERE id = 'f6200000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT payment_status FROM public.bookings WHERE id = 'f6200000-0000-4000-8000-000000000001'),
  'partially_paid',
  'net retained payment after a partial refund is represented as partially paid'
);

SELECT throws_ok(
  $$UPDATE public.bookings SET payment_status = 'paid' WHERE id = 'f6200000-0000-4000-8000-000000000001'$$,
  '23514',
  'Booking payment status must match the financial ledger (expected partially_paid, received paid).',
  'directly marking a partially paid booking as paid is rejected'
);

SELECT ok(
  (public.record_payment_atomic(
    'LEDGER-AUTH-20261114',
    70,
    'EUR',
    'Cash',
    'cash',
    'Paid',
    'LEDGER-AUTH-FINAL-PAYMENT',
    'Test collection after partial refund',
    'pgTAP',
    'ledger-authority-test-idempotency-key-20261114'
  )->>'success')::boolean,
  'atomic payment RPC accepts only the net remaining amount after a processed refund'
);

SELECT is(
  (SELECT payment_status FROM public.bookings WHERE id = 'f6200000-0000-4000-8000-000000000001'),
  'paid',
  'payment status becomes paid when net retained payments equal the booking total'
);

SELECT throws_ok(
  $$UPDATE public.bookings SET payment_status = 'pending' WHERE id = 'f6200000-0000-4000-8000-000000000001'$$,
  '23514',
  'Booking payment status must match the financial ledger (expected paid, received pending).',
  'resetting payment status without reversing ledger records is rejected'
);

SELECT * FROM finish();
ROLLBACK;
