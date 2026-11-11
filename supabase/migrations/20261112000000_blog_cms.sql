-- Kemet Spirit editorial blog CMS.
-- Public visitors can read only published or due-scheduled content.
-- Editorial mutations are restricted to the existing content.manage RBAC permission.
BEGIN;

CREATE TABLE IF NOT EXISTS public.blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 120),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 180),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 180),
  excerpt text CHECK (excerpt IS NULL OR length(excerpt) <= 600),
  content text NOT NULL DEFAULT '',
  reading_time_minutes integer NOT NULL DEFAULT 1 CHECK (reading_time_minutes BETWEEN 1 AND 120),
  cover_image_url text CHECK (cover_image_url IS NULL OR cover_image_url ~* '^https://'),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
  category_id uuid REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT 'Kemet Spirit Editorial Team'
    CHECK (length(btrim(author_name)) BETWEEN 1 AND 120),
  seo_title text CHECK (seo_title IS NULL OR length(seo_title) <= 180),
  seo_description text CHECK (seo_description IS NULL OR length(seo_description) <= 300),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_published_requires_date
    CHECK (status NOT IN ('published', 'scheduled') OR published_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS blog_posts_publication_idx
  ON public.blog_posts (published_at DESC)
  WHERE status IN ('published', 'scheduled');
CREATE INDEX IF NOT EXISTS blog_posts_category_idx
  ON public.blog_posts (category_id);
CREATE INDEX IF NOT EXISTS blog_posts_updated_idx
  ON public.blog_posts (updated_at DESC);

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Categories are public taxonomy; only editorial users can change them.
DROP POLICY IF EXISTS blog_categories_public_read ON public.blog_categories;
CREATE POLICY blog_categories_public_read
  ON public.blog_categories FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS blog_categories_editor_insert ON public.blog_categories;
CREATE POLICY blog_categories_editor_insert
  ON public.blog_categories FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_permission('content.manage')));

DROP POLICY IF EXISTS blog_categories_editor_update ON public.blog_categories;
CREATE POLICY blog_categories_editor_update
  ON public.blog_categories FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('content.manage')))
  WITH CHECK ((SELECT public.has_permission('content.manage')));

DROP POLICY IF EXISTS blog_categories_editor_delete ON public.blog_categories;
CREATE POLICY blog_categories_editor_delete
  ON public.blog_categories FOR DELETE TO authenticated
  USING ((SELECT public.has_permission('content.manage')));

-- One SELECT policy per table/action avoids permissive-policy overlap. Editorial
-- users may also read drafts and archived content; public users cannot.
DROP POLICY IF EXISTS blog_posts_public_and_editor_read ON public.blog_posts;
CREATE POLICY blog_posts_public_and_editor_read
  ON public.blog_posts FOR SELECT TO anon, authenticated
  USING (
    (status IN ('published', 'scheduled') AND published_at <= now())
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND (SELECT public.has_permission('content.manage'))
    )
  );

DROP POLICY IF EXISTS blog_posts_editor_insert ON public.blog_posts;
CREATE POLICY blog_posts_editor_insert
  ON public.blog_posts FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_permission('content.manage')));

DROP POLICY IF EXISTS blog_posts_editor_update ON public.blog_posts;
CREATE POLICY blog_posts_editor_update
  ON public.blog_posts FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('content.manage')))
  WITH CHECK ((SELECT public.has_permission('content.manage')));

DROP POLICY IF EXISTS blog_posts_editor_delete ON public.blog_posts;
CREATE POLICY blog_posts_editor_delete
  ON public.blog_posts FOR DELETE TO authenticated
  USING ((SELECT public.has_permission('content.manage')));

-- Supabase projects can have broad default grants. Reset these tables to a
-- least-privilege baseline before granting only the operations required below.
REVOKE ALL PRIVILEGES ON TABLE public.blog_categories, public.blog_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.blog_categories, public.blog_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_categories, public.blog_posts TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.blog_categories, public.blog_posts TO service_role;

COMMIT;
