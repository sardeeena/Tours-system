-- Keep the anonymous blog read path independent from staff RBAC functions.
-- Anonymous users do not need EXECUTE on public.has_permission to read published posts.
BEGIN;
DROP POLICY IF EXISTS blog_posts_public_and_editor_read ON public.blog_posts;
DROP POLICY IF EXISTS blog_posts_anon_read ON public.blog_posts;
DROP POLICY IF EXISTS blog_posts_authenticated_read ON public.blog_posts;

CREATE POLICY blog_posts_anon_read
  ON public.blog_posts FOR SELECT TO anon
  USING (status IN ('published', 'scheduled') AND published_at <= now());

CREATE POLICY blog_posts_authenticated_read
  ON public.blog_posts FOR SELECT TO authenticated
  USING (
    (status IN ('published', 'scheduled') AND published_at <= now())
    OR (SELECT public.has_permission('content.manage'))
  );
COMMIT;
