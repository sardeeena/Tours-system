-- Public review submissions are accepted only through the rate-limited server endpoint.
-- Guests and customers do not receive direct table-write privileges.
BEGIN;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews
  ALTER COLUMN is_published SET DEFAULT FALSE,
  ALTER COLUMN verified_booking SET DEFAULT FALSE;

COMMENT ON COLUMN public.reviews.is_published IS
  'Customer-submitted reviews default to pending moderation. Only authorized staff may publish.';
COMMENT ON COLUMN public.reviews.verified_booking IS
  'True only when independently confirmed against a completed booking; public submissions always remain false.';

DROP POLICY IF EXISTS "Public can read published reviews" ON public.reviews;
CREATE POLICY "Public can read published reviews"
  ON public.reviews
  FOR SELECT
  TO anon
  USING (is_published = TRUE);

-- Remove stale anonymous table grants wherever RLS has no anon/PUBLIC policy.
-- These grants do not currently bypass RLS, but they are unnecessary and make future
-- policy changes dangerous. Public form writes continue through dedicated server APIs.
DO $least_privilege$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT DISTINCT g.table_schema, g.table_name
    FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public'
      AND g.grantee = 'anon'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = g.table_schema
          AND p.tablename = g.table_name
          AND ('anon' = ANY(p.roles::text[]) OR 'public' = ANY(p.roles::text[]))
      )
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM anon', target.table_schema, target.table_name);
  END LOOP;
END;
$least_privilege$;

-- Keep public catalogue reads, but remove all direct anonymous mutations.
REVOKE ALL PRIVILEGES ON TABLE public.reviews FROM anon;
GRANT SELECT ON TABLE public.reviews TO anon;

-- Authenticated staff retain the existing RLS-governed moderation workflow.
-- Customer inserts still fail rbac_reviews_create unless the caller has content.create.
REVOKE ALL PRIVILEGES ON TABLE public.reviews FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reviews TO authenticated;

-- The API server is the only public-submission writer and uses its server-only key.
GRANT ALL PRIVILEGES ON TABLE public.reviews TO service_role;

COMMIT;
