# Kemet Spirit Blog CMS

## Routes
- Public journal: `/blog`
- Public article: `/blog/:slug`
- Admin editor: `/admin/blog` (requires `content.manage`)

## Database release
Review `supabase/manual/blog_cms_setup.sql` and convert it into a timestamped migration using the Supabase CLI workflow used by this repository. Do not apply it to production until reviewed and approved.

The schema uses:
- `blog_posts` and `blog_categories`
- RLS for published-only public reads
- `public.has_permission('content.manage')` for editorial write access
- Explicit Data API grants

After the migration is applied, verify:
1. Anonymous users can select only published posts whose publication date has arrived.
2. Authenticated users with `content.manage` can create, edit, publish, archive and delete posts.
3. Authenticated users without `content.manage` cannot read drafts or mutate blog content.
4. `/sitemap.xml` and `/llms.txt` include only published articles.
5. Admin and public blog routes work on desktop, tablet and mobile.

## Current implementation boundaries
- Article body is plain text with preserved line breaks; a rich-text editor is not included yet.
- Cover images currently use a URL field; the existing Media Library upload workflow is not yet integrated.
- The first version supports one language per post. Translation records and hreflang are future work.
- Scheduling beyond immediate publication is not included; selecting Published publishes immediately.
