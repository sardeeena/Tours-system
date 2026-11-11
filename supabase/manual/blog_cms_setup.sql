-- Kemet Spirit Blog CMS schema.
-- Review and apply through the project's normal migration/release process.
-- This file is intentionally NOT auto-applied to production.
create extension if not exists pgcrypto;

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null default '',
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  category_id uuid references public.blog_categories(id) on delete set null,
  author_name text not null default 'Kemet Spirit Editorial Team',
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_published_requires_date check (status <> 'published' or published_at is not null)
);

create index if not exists blog_posts_publication_idx on public.blog_posts(status,published_at desc);
create index if not exists blog_posts_category_idx on public.blog_posts(category_id);
create index if not exists blog_posts_updated_idx on public.blog_posts(updated_at desc);

alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;

drop policy if exists "Public can read blog categories" on public.blog_categories;
create policy "Public can read blog categories" on public.blog_categories
for select to anon, authenticated using (true);

drop policy if exists "Content managers manage blog categories" on public.blog_categories;
create policy "Content managers manage blog categories" on public.blog_categories
for all to authenticated using ((select public.has_permission('content.manage')))
with check ((select public.has_permission('content.manage')));

drop policy if exists "Public can read published blog posts" on public.blog_posts;
create policy "Public can read published blog posts" on public.blog_posts
for select to anon, authenticated using (status='published' and published_at <= now());

drop policy if exists "Content managers read all blog posts" on public.blog_posts;
create policy "Content managers read all blog posts" on public.blog_posts
for select to authenticated using ((select public.has_permission('content.manage')));

drop policy if exists "Content managers insert blog posts" on public.blog_posts;
create policy "Content managers insert blog posts" on public.blog_posts
for insert to authenticated with check ((select public.has_permission('content.manage')));

drop policy if exists "Content managers update blog posts" on public.blog_posts;
create policy "Content managers update blog posts" on public.blog_posts
for update to authenticated using ((select public.has_permission('content.manage')))
with check ((select public.has_permission('content.manage')));

drop policy if exists "Content managers delete blog posts" on public.blog_posts;
create policy "Content managers delete blog posts" on public.blog_posts
for delete to authenticated using ((select public.has_permission('content.manage')));

grant select on public.blog_categories, public.blog_posts to anon, authenticated;
grant insert, update, delete on public.blog_categories, public.blog_posts to authenticated;
