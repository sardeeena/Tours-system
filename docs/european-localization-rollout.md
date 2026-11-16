# AwesomeAdventure Europe-wide localization rollout

## Current state

The public site currently has five active UI dictionaries: English, German, Italian, Romanian and Russian. The locale registry added in this change lists the planned European language targets, but planned locales are **not** enabled in the selector and do not imply translated content is available.

## Locale catalogue

First expansion wave: French, Spanish, Dutch, Polish and Portuguese. Existing German, Italian and Romanian remain active. Keep English as the source language and Russian as an existing additional language.

Next waves: Swedish, Danish, Norwegian Bokmål, Finnish, Greek, Bulgarian, Croatian, Czech, Slovak, Slovenian, Hungarian, Estonian, Latvian, Lithuanian, Ukrainian, Serbian and Albanian. Turkish is an additional nearby market; Arabic is an RTL additional market.

## Data foundation

- `content_translations` stores translations for tours and their child content, destinations, blog posts and static pages.
- `customers.preferred_locale`, `bookings.customer_locale` and `communication_templates.locale` preserve customer-facing language independently from `bookings.tour_language` (guide language).
- Translation rows are server-only (service role). Do not expose draft content through the public Data API.
- `source_checksum` allows the workflow to mark translations outdated when English source content changes.
- Only `translation_state = 'published'` rows that pass validation may be served or included in sitemaps.

## Publication requirements before enabling a locale

1. Complete UI dictionary coverage, including booking, account, validation, error and confirmation messages.
2. Translate tour content and all child records (itinerary, highlights, inclusions, exclusions, FAQs), destination content, blog articles and static pages.
3. Human review of safety, pickup, cancellation, price, age and payment wording. Never machine-publish operational or legal claims.
4. Locale-prefixed URLs with translated slugs where appropriate; preserve existing English URLs unchanged.
5. Server-render locale-specific HTML, title/description/Open Graph, structured data `inLanguage`, self-canonical, reciprocal `hreflang` including `x-default`, and locale sitemap entries.
6. Do not auto-redirect by IP or browser language. Offer a language suggestion and let visitors choose.
7. Verify booking language persists through confirmation, email and WhatsApp; do not confuse customer locale with the spoken guide language.
8. Do not index fallback English content at a translated URL. Missing or outdated translations remain unpublished/noindex.

## Not included in this foundation PR

This schema and registry do not translate the 25 tours, 50 blog posts, or destination/static-page content. They also do not activate locale-prefixed routes or add hreflang. Those require the locale-aware server renderer, UI coverage, admin translation workflow and reviewed translation content; turning on a selector before those are complete would mislead customers and search engines.

## Release gates and verification

The application now recognizes locale-prefixed URL shapes and has pure helpers for building localized paths and reciprocal hreflang sets from an explicit published-locale allowlist. Server rendering deliberately returns a non-indexable 404 for recognized locale prefixes until the corresponding reviewed translation and client hydration path are implemented; it never serves English source copy under a translated URL. English URLs remain unchanged.

A locale is not launch-ready until all of these checks pass:

- [ ] Every route resolves to a published translation for the requested locale; missing, draft, review and outdated records return a non-indexable not-found response rather than English fallback.
- [ ] Translated slugs are unique within a locale and cannot resolve to a different source entity.
- [ ] Page body, title, description, Open Graph values, JSON-LD, canonical URL, breadcrumb URLs and booking links all use the same locale and source entity.
- [ ] hreflang is reciprocal across every published translation, includes the English source and x-default, and never points to a draft or missing page.
- [ ] Sitemap contains only canonical URLs for published translations.
- [ ] Locale is retained when moving from tour detail to booking, confirmation, account and customer support.
- [ ] Booking stores the customer's interface/communication locale separately from the selected spoken guide language.
- [ ] Confirmation email and WhatsApp templates select the customer's locale, with a reviewed English fallback only where no localized template exists.
- [ ] Automated route tests cover all supported locale prefixes, malformed locale codes, translated-slug collisions, unpublished records, stale checksums and cross-entity slug mismatches.
- [ ] A human reviewer approves each translated legal, safety, pickup, cancellation, price, age and payment statement before publication.

## Database and account hardening follow-up

The translation table is intentionally server-only. Its lifecycle changes must remain covered by the existing business audit trigger, while the generic audit snapshot redacts the content JSON field. CI asserts the table's RLS posture, absence of public/authenticated SELECT privileges, and audit-trigger presence. The booking flow now calls a dedicated locale-aware atomic RPC: it delegates the authoritative reservation to the existing booking pipeline, then persists the validated current UI locale on the newly created booking and customer preference within the same transaction. The spoken guide language remains a separate field. The public RPC remains invoker-rights to satisfy the project's public-function security policy; its private SECURITY DEFINER implementation pins an empty search_path and only accepts the five currently supported UI locales. CI checks both privilege boundaries and the intended anon/authenticated booking access. Newsletter subscription now normalizes the requested language against the same supported UI-locale allowlist, selects a matching welcome-email template by locale, and falls back explicitly to the reviewed English template when a localized template is not available.

The earlier Supabase advisor report also identified seven public tables with RLS enabled and no policies. Do not add broad authenticated policies to silence that warning: zero policies means deny-all for client roles, which may be the intended posture. Before changing anything, verify each table's consumers and ensure all reads/writes occur through trusted server-side service-role code. Add narrowly scoped policies only if a documented client use case requires them. A production privilege check confirmed all seven deny SELECT to anon/authenticated; six grant service-role SELECT, while whatsapp_provider_status_events has no direct table grants by design and is accessed through record_whatsapp_provider_status, a SECURITY DEFINER function executable only by service_role. Preserve that narrow RPC boundary rather than granting direct table access.

Leaked-password protection is a Supabase Auth project setting, not a SQL migration. It must be enabled in the Supabase Dashboard under Authentication security/password settings and then verified with an Auth configuration review. It is not safe to imply that a repository migration changed this setting.

For unused-index notices, first capture pg_stat_user_indexes over a representative traffic period and inspect EXPLAIN (ANALYZE, BUFFERS) for affected query paths. Do not drop indexes supporting foreign keys, uniqueness, booking lookups, RLS predicates or infrequent but critical administrative operations based on a single advisor snapshot.

## Operational checks outside Git

- Enable Supabase Auth leaked-password protection in the project's Auth security settings after checking the current account-level configuration.
- The seven public-schema tables reported by the advisor with RLS enabled and zero policies are deliberately deny-all candidates: `customer_communication_consent_events`, `technical_events`, `visitor_analytics_settings`, `visitor_consent_records`, `visitor_events`, `visitor_sessions`, `whatsapp_provider_status_events`. Confirm they are only accessed through trusted server/service-role paths before changing policies.
- Do not drop indexes solely because the advisor says they are unused. Several support foreign keys and operational queries; evaluate with query plans and a representative usage window first.
- Verify Hostinger/CDN response headers after deployment. Tour detail HTML is explicitly marked no-store in this change to avoid cross-route cache contamination.


## Admin translation workspace (PR implementation)

The admin sidebar now includes **Translations & Locales**. The workspace is protected by the existing server-side Super Admin + verified AAL2 guard; it does not access the translation table from the browser. Its API supports listing records and saving draft, review, or published lifecycle states through the server-only service-role client. Every write is recorded in the account audit log, and the table audit trigger remains enabled.

Publishing requires explicit confirmation plus translated title/slug, SEO title/description, structured content, and a source checksum. The checksum is currently a required provenance field supplied by the editor; automated comparison against each source entity is not yet wired. The API validates the lifecycle, required metadata and explicit publish confirmation, but does not yet resolve a translated slug against a live source record. Therefore a published row is **not yet eligible for public delivery**: locale-prefixed public routes remain 404/noindex until a source-checksum resolver, translated-slug lookup, localized SSR/client rendering, metadata/hreflang and sitemap integration ship. Treat the current workspace as the secure translation authoring/review foundation, not a finished multilingual publishing system.
