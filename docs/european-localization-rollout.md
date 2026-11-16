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

## Operational checks outside Git

- Enable Supabase Auth leaked-password protection in the project's Auth security settings after checking the current account-level configuration.
- The seven public-schema tables reported by the advisor with RLS enabled and zero policies are deliberately deny-all candidates: `customer_communication_consent_events`, `technical_events`, `visitor_analytics_settings`, `visitor_consent_records`, `visitor_events`, `visitor_sessions`, `whatsapp_provider_status_events`. Confirm they are only accessed through trusted server/service-role paths before changing policies.
- Do not drop indexes solely because the advisor says they are unused. Several support foreign keys and operational queries; evaluate with query plans and a representative usage window first.
- Verify Hostinger/CDN response headers after deployment. Tour detail HTML is explicitly marked no-store in this change to avoid cross-route cache contamination.
