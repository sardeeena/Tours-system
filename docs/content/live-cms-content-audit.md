# Live CMS content audit — 23 November 2026

## Scope and safety

This is a read-only audit of the production AwesomeAdventure Supabase project `uvtbtpxtrrmaublrztgv`. It covers the currently published tours, destinations, categories and blog posts, plus the current translation-state distribution.

**No production rows were changed.** This document records findings and review priorities; it is not an instruction to publish unverified copy. Operational details such as prices, pickup coverage, age limits, departure times, inclusions, exclusions and cancellation terms must be confirmed against the operator's current product information before editing.

## Published inventory

| Content type | Published records |
|---|---:|
| Tours | 26 |
| Blog posts | 50 |
| Destinations | 7 |
| Categories | 8 |

## Findings

### 1. Tours — highest priority for factual review

All 26 published tours have a short description. The audit found:

- **25 of 26** currently say “Suitable for all ages” in the age guidance. This is a broad safety/eligibility claim and should not be repeated or rewritten as fact until the age limits are confirmed per activity and operator. The remaining horse-riding tour has no age guidance at all, so it also needs an operator-confirmed minimum age and child participation rules.
- **23 of 26** direct customers to contact the booking team to confirm cancellation/refund terms. Those pages need clear, product-specific terms before stronger cancellation language is used.
- **23 of 26** use generic pickup wording that says availability, approved locations and supplements are shown during booking. The booking flow should remain the source of truth for each hotel's eligibility and any charge.
- No published tour currently has pickup marked unavailable, and none is missing its short description.

Tour descriptions and associated itinerary, inclusion and exclusion records contain product-specific facts. They should be reviewed as a complete product unit, not mass-rewritten from marketing copy alone. In particular, retain exact distances, timings, optional extras, fees and conditions unless the operator confirms a change.

### 2. Categories — clear SEO metadata gap

All **8 of 8** published categories have a description, but **all 8 are missing both `seo_title` and `seo_description`**. A separate read-only check also found no `seo_metadata` rows for `entity_type = 'category'`, so there are no saved overrides in the SEO control center either.

| Category | Published tours linked |
|---|---:|
| Boat Trips & Island Tours | 6 |
| Snorkeling & Diving | 7 |
| Water Sports | 1 |
| Desert Safaris | 10 |
| Quad Biking & Buggy Tours | 8 |
| City Tours & Sightseeing | 3 |
| Cultural & Historical Tours | 9 |
| Private Tours | 3 |

The descriptions are serviceable but generic. The public category records now load SEO overrides saved by Admin → SEO & GEO Control Center (`seo_metadata`, `entity_type = category`) and pass their title, meta description and keywords to the `/excursions` category-filter SEO resolver. Existing category-table SEO columns remain a backwards-compatible fallback. These are filter-state metadata, not separate category landing pages: all category filters retain the `/excursions` canonical URL. This improves the metadata used when a visitor selects a category, but does not create eight independently indexable landing pages. The live SEO columns remain empty until reviewed copy is approved.

### 3. Destinations — metadata mostly present, keywords absent

All **7 of 7** published destinations have an SEO title and description. All **7** have an empty `seo_keywords` array.

The destination copy is broadly usable, but should be checked against actual published inventory. For example, Luxor and Cairo descriptions mention several attractions and experiences; destination pages should avoid implying those are bookable unless a matching published tour exists. Hurghada, Sharm El Sheikh and El Gouna are the strongest current inventory-led landing pages.

### 4. Blog — no metadata completeness work needed

All **50 of 50** published blog posts have a title, excerpt, SEO title and SEO description. The sampled titles and excerpts are practical, specific and customer-focused. No bulk rewrite is recommended from metadata completeness alone.

A separate editorial accuracy pass should still check time-sensitive visitor rules, safety guidance, attraction access and any advice that could become outdated. Preserve existing slugs unless there is a deliberate redirect plan.

### 5. Translation state

The live `content_translations` table currently contains **10 French tour records, all in draft state**. None has a review timestamp or publication timestamp. No Dutch or Polish translation records were returned by the state summary.

The French, Dutch and Polish JSON files in this PR are review drafts, not approved translations. The import script's checksum and draft-only safeguards should be retained; do not mark machine-generated copy as reviewed or publish it without human language and factual review.

## Recommended execution order

1. **Operator verification:** resolve age restrictions, pickup coverage/supplements and cancellation terms for each of the 26 tours with the product/operator owner.
2. **Tour copy review:** only then tighten titles, summaries, itinerary language and inclusions/exclusions while preserving all verified facts and option-specific differences.
3. **Category SEO content:** decide whether the business wants eight dedicated, indexable category landing pages. The current implementation passes category CMS metadata into the selected filter view, which remains canonical to `/excursions`; do not treat that as eight standalone SEO landing pages. Add reviewed category titles/descriptions only after the landing-page and canonical strategy is agreed.
4. **Destination review:** add relevant keywords only where they accurately match destination inventory and search intent; do not add unsupported attractions or bookability claims.
5. **Blog editorial review:** check factual freshness, not wholesale rewrite or metadata replacement.
6. **Translations:** complete native-language and operational review, then import approved records as drafts using the existing checksum-protected workflow. Publication remains a separate release decision.
7. **Verification:** compare before/after production exports, run content integrity tests and browser/SEO checks, and verify that booking-critical fields are unchanged.

## Explicitly not done

- No INSERT, UPDATE or DELETE was run against production.
- No translation was imported, marked reviewed or published.
- No tour prices, booking rules, availability, pickup settings, itinerary, inclusions or cancellation terms were changed.
- No category SEO metadata was populated. The selected-filter metadata path now reads the CMS fields, but the fields remain empty and there are no dedicated category landing pages.
