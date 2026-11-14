BEGIN;
SELECT plan(6);

SELECT has_function('public', 'convert_inquiry_to_lead', ARRAY['uuid'], 'Atomic inquiry conversion RPC exists');
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.convert_inquiry_to_lead(uuid)'::regprocedure),
  true,
  'Conversion RPC uses a controlled SECURITY DEFINER boundary'
);
SELECT ok(
  position('has_permission(''crm.manage'')' in pg_get_functiondef('public.convert_inquiry_to_lead(uuid)'::regprocedure)) > 0,
  'Conversion RPC checks CRM management permission'
);
SELECT ok(
  position('pg_advisory_xact_lock' in pg_get_functiondef('public.convert_inquiry_to_lead(uuid)'::regprocedure)) > 0,
  'Conversion serializes concurrent attempts by inquiry ID'
);
SELECT ok(
  position('FOR UPDATE' in pg_get_functiondef('public.convert_inquiry_to_lead(uuid)'::regprocedure)) > 0,
  'Conversion locks the inquiry row before checking or changing state'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.convert_inquiry_to_lead(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.convert_inquiry_to_lead(uuid)', 'EXECUTE'),
  'Only authenticated callers can invoke the permission-checked conversion RPC'
);

SELECT * FROM finish();
ROLLBACK;
