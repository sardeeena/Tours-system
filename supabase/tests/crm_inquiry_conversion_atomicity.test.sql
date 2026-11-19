BEGIN;
SELECT plan(12);

SELECT has_function('public', 'convert_inquiry_to_lead', ARRAY['uuid'], 'Public atomic inquiry conversion RPC wrapper exists');
SELECT has_function('private', 'convert_inquiry_to_lead', ARRAY['uuid'], 'Private atomic inquiry conversion implementation exists');
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.convert_inquiry_to_lead(uuid)'::regprocedure),
  false,
  'Public conversion RPC is an invoker-rights wrapper'
);
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'private.convert_inquiry_to_lead(uuid)'::regprocedure),
  true,
  'Private conversion implementation uses a controlled SECURITY DEFINER boundary'
);
SELECT ok(
  position('has_permission(''crm.manage'')' in pg_get_functiondef('private.convert_inquiry_to_lead(uuid)'::regprocedure)) > 0,
  'Conversion RPC checks CRM management permission'
);
SELECT ok(
  position('pg_advisory_xact_lock' in pg_get_functiondef('private.convert_inquiry_to_lead(uuid)'::regprocedure)) > 0,
  'Conversion serializes concurrent attempts by inquiry ID'
);
SELECT ok(
  position('FOR UPDATE' in pg_get_functiondef('private.convert_inquiry_to_lead(uuid)'::regprocedure)) > 0,
  'Conversion locks the inquiry row before checking or changing state'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.convert_inquiry_to_lead(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.convert_inquiry_to_lead(uuid)', 'EXECUTE'),
  'Only authenticated callers can invoke the permission-checked conversion RPC'
);
