BEGIN;
SELECT plan(3);

SELECT has_function(
  'public',
  'prevent_profile_role_escalation',
  ARRAY[]::text[],
  'profile role escalation guard function exists'
);

SELECT has_trigger(
  'public',
  'profiles',
  'trg_prevent_profile_role_escalation',
  'profile role escalation guard is attached to profiles'
);

SELECT is(
  (
    SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.prevent_profile_role_escalation()'::regprocedure
  ),
  FALSE,
  'role escalation guard is not SECURITY DEFINER'
);

SELECT * FROM finish();
ROLLBACK;
