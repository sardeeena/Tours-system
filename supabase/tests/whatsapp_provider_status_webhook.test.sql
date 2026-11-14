BEGIN;
SELECT plan(9);

SELECT has_table('public', 'whatsapp_provider_status_events', 'WhatsApp provider status events table exists');
SELECT has_column('public', 'communication_messages', 'read_at', 'WhatsApp read timestamp is stored');
SELECT has_column('public', 'communication_messages', 'provider_status_at', 'Provider event ordering timestamp is stored');
SELECT ok(NOT has_function_privilege('anon', 'public.record_whatsapp_provider_status(text,text,text,timestamptz,text,text)', 'EXECUTE'), 'Anonymous role cannot execute status RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.record_whatsapp_provider_status(text,text,text,timestamptz,text,text)', 'EXECUTE'), 'Authenticated role cannot execute status RPC');
SELECT ok(has_function_privilege('service_role', 'public.record_whatsapp_provider_status(text,text,text,timestamptz,text,text)', 'EXECUTE'), 'Service role can execute status RPC');

SELECT is(
  public.record_whatsapp_provider_status(
    repeat('a', 64), 'wamid.webhook-regression-test', 'delivered',
    '2026-11-14T10:00:00Z'::timestamptz, NULL, NULL
  )->>'duplicate',
  'false',
  'First provider event is recorded once'
);
SELECT is(
  public.record_whatsapp_provider_status(
    repeat('a', 64), 'wamid.webhook-regression-test', 'delivered',
    '2026-11-14T10:00:00Z'::timestamptz, NULL, NULL
  )->>'duplicate',
  'true',
  'Duplicate provider event is idempotent'
);
SELECT is(
  public.record_whatsapp_provider_status(
    repeat('b', 64), 'wamid.unmatched-regression-test', 'sent',
    '2026-11-14T10:01:00Z'::timestamptz, NULL, NULL
  )->>'matched',
  'false',
  'Unmatched provider events are retained for later reconciliation'
);

SELECT * FROM finish();
ROLLBACK;
