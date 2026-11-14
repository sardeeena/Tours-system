BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

SELECT has_column(
  'public', 'inquiries', 'assigned_staff_id',
  'inquiries stores a nullable staff profile assignment'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inquiries'::regclass
      AND conname = 'inquiries_assigned_staff_id_fkey'
      AND confrelid = 'public.profiles'::regclass
      AND confdeltype = 'n'
  ),
  'deleting a staff profile clears its inquiry assignments'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'inquiries'
      AND indexname = 'idx_inquiries_assigned_staff_id'
  ),
  'staff assignments have a supporting index'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.list_crm_assignable_staff()', 'EXECUTE'),
  'authenticated CRM users can call the staff directory RPC'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.list_crm_assignable_staff()', 'EXECUTE'),
  'anonymous users cannot call the staff directory RPC'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.inquiries'::regclass
      AND tgname = 'trg_validate_inquiry_assigned_staff'
      AND NOT tgisinternal
  ),
  'database trigger validates staff eligibility for assignment writes'
);

SELECT ok(
  position('public.has_permission(''crm.read'')' IN pg_get_functiondef('public.list_crm_assignable_staff()'::regprocedure)) > 0,
  'staff directory RPC requires CRM read permission'
);

SELECT ok(
  position('public.user_roles' IN pg_get_functiondef('public.list_crm_assignable_staff()'::regprocedure)) > 0
  AND position('public.access_roles' IN pg_get_functiondef('public.list_crm_assignable_staff()'::regprocedure)) > 0
  AND position('public.profiles' IN pg_get_functiondef('public.list_crm_assignable_staff()'::regprocedure)) > 0,
  'staff directory is derived from profile records and normalized active role assignments'
);

SELECT ok(
  position('p.role' IN pg_get_functiondef('public.list_crm_assignable_staff()'::regprocedure)) = 0,
  'legacy profiles.role is not used to determine assignable staff'
);

SELECT * FROM finish();
ROLLBACK;
