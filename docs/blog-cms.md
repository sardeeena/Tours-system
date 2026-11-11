# Kemet Spirit Blog CMS

## Routes
- Public journal: `/blog`
- Public article: `/blog/:slug`
- Admin editor: `/admin/blog` (requires `content.manage`)

## Database release
The tracked migration is `supabase/migrations/20261112000000_blog_cms.sql`. The migration is included in the normal clean-database CI replay and pgTAP suite.

The schema uses:
- `blog_posts` and `blog_categories`
- RLS for published and due-scheduled public reads
- `public.has_permission('content.manage')` for editorial write access
- Explicit Data API grants

After the migration is applied, verify:
1. Anonymous users can select only published or scheduled posts whose publication date has arrived.
2. Authenticated users with `content.manage` can create, edit, publish, archive and delete posts.
3. Authenticated users without `content.manage` cannot read drafts or mutate blog content.
4. `/sitemap.xml` and `/llms.txt` include only published articles.
5. Admin and public blog routes work on desktop, tablet and mobile.

## Current implementation boundaries
- Article editor supports a safe Markdown subset (headings, emphasis, lists, quotes, inline code and HTTPS/mailto links) with live preview.
- Cover images currently use a URL field; the existing Media Library upload workflow is not yet integrated.
- The first version supports one language per post. Translation records and hreflang are future work.
- Scheduled posts use a future `published_at` timestamp and become public automatically when the timestamp arrives; no background worker or open browser is needed. Public catalogue queries use a stored reading-time value and avoid downloading article bodies.
