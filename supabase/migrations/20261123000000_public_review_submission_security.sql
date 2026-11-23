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
  TO anon, authenticated
  USING (is_published = TRUE);

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
