BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);

WITH policy_actions AS (
  SELECT
    p.tablename,
    p.policyname,
    CASE WHEN role_name = 'public' THEN 'authenticated' ELSE role_name END AS effective_role,
    action_name
  FROM pg_policies p
  CROSS JOIN LATERAL unnest(p.roles) AS roles(role_name)
  CROSS JOIN LATERAL unnest(
    CASE p.cmd
      WHEN 'ALL' THEN ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[]
      ELSE ARRAY[p.cmd]::text[]
    END
  ) AS actions(action_name)
  WHERE p.schemaname = 'public'
    AND p.permissive = 'PERMISSIVE'
    AND role_name IN ('public','authenticated')
)
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM policy_actions
    WHERE effective_role = 'authenticated'
    GROUP BY tablename, action_name
    HAVING count(*) > 1
  ),
  'authenticated requests have at most one permissive policy per table and action'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ),
  'client-callable public RPCs are invoker-rights wrappers, not SECURITY DEFINER functions'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.prosecdef
      AND NOT COALESCE(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
  ),
  'private SECURITY DEFINER implementations all pin an empty search_path'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND indexname = 'idx_user_roles_assigned_by'
  ),
  'user_roles.assigned_by foreign key has a supporting index'
);

SELECT * FROM finish();
ROLLBACK;
