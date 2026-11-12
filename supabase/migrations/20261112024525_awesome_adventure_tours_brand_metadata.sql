ALTER TABLE public.blog_posts
  ALTER COLUMN author_name
  SET DEFAULT 'Awesome Adventure Tours Editorial Team';

COMMENT ON TABLE public.user_roles IS
  'Canonical many-to-many user-to-role assignments for Awesome Adventure Tours RBAC.';
