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

-- Anonymous browser clients are read-only at the table layer. All guest writes
-- (booking, inquiries, newsletter and reviews) go through validated server APIs/RPCs.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Restore SELECT only where an explicit anon/PUBLIC SELECT policy exists.
DO $public_reads$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT DISTINCT p.tablename
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.cmd = 'SELECT'
      AND ('anon' = ANY(p.roles::text[]) OR 'public' = ANY(p.roles::text[]))
  LOOP
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon', target.tablename);
  END LOOP;
END;
$public_reads$;

-- Prevent future application objects created by the migration owner (postgres)
-- from silently inheriting anonymous privileges. Supabase-managed supabase_admin
-- defaults are platform-owned and cannot be changed by the migration role.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;

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
