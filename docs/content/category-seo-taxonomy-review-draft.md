# Category SEO and taxonomy review draft

**Prepared:** 23 November 2026  
**Status:** Internal review draft only — not published  
**Production changes:** None

## Recommendation

Do not launch eight indexable category pages by simply exposing the existing filters. The live catalogue shows that several category labels do not accurately describe every linked tour, and some groups are too small or mixed to support a useful standalone landing page yet.

The existing PR implementation correctly reads category SEO overrides from the SEO & GEO Control Center and uses them in the selected category filter state. That state still canonicalizes to `/excursions`; it is not an independently indexable category landing page.

Before creating dedicated routes, clean up the category-to-tour relationships and approve the content below. In particular, avoid indexing thin or misleading category pages.

## Live catalogue review

| Category | Published tours | Assessment |
|---|---:|---|
| Boat Trips & Island Tours | 6 | Good candidate for a dedicated page after unique copy and FAQs are reviewed |
| Snorkeling & Diving | 7 | Good candidate; confirm diving-labelled tours really offer diving, not only snorkelling |
| Water Sports | 1 | Too thin for a standalone indexable page; keep as a filter for now |
| Desert Safaris | 10 | Strong candidate; ensure horse riding is intentionally grouped here |
| Quad Biking & Buggy Tours | 8 | Needs taxonomy cleanup: linked Jeep/desert trips are not all quad or buggy rides |
| City Tours & Sightseeing | 3 | Mixed inventory includes an airport transfer; review membership before considering indexation |
| Cultural & Historical Tours | 9 | Needs taxonomy cleanup: linked snorkeling and adventure trips do not clearly fit this label |
| Private Tours | 3 | Mixed inventory includes an airport transfer; do not position as a broad private-tour collection yet |

## Draft SEO copy for review

These are restrained working drafts based only on the category names and currently linked inventory. They are not live metadata and should be revisited after category relationships are corrected.

### Boat Trips & Island Tours

- **SEO title:** Boat Trips & Island Tours in Egypt | Awesome Adventure Tours
- **Meta description:** Explore Red Sea boat trips from Hurghada and Sharm El Sheikh, with island visits, yacht trips and time for snorkelling. Compare trips and check what's included before booking.
- **Indexing recommendation:** Candidate, once a dedicated page has unique useful copy and accurate tour links.

### Snorkeling & Diving

- **SEO title:** Red Sea Snorkelling & Diving Trips | Awesome Adventure Tours
- **Meta description:** Find Red Sea snorkelling trips from Hurghada and Sharm El Sheikh. Compare boat trips, island stops and the details of each experience before you book.
- **Indexing recommendation:** Candidate, after confirming which listed products genuinely include diving.

### Water Sports

- **SEO title:** Water Sports in Hurghada | Awesome Adventure Tours
- **Meta description:** See the water sports currently available in Hurghada, including parasailing and banana boat rides. Check the activity details and booking options before you go.
- **Indexing recommendation:** Keep noindex or filter-only for now. One published product is not enough to support a substantial category landing page.

### Desert Safaris

- **SEO title:** Egypt Desert Safaris & Bedouin Experiences | Awesome Adventure Tours
- **Meta description:** Compare desert experiences in Hurghada, El Gouna and Sharm El Sheikh, from quad rides and jeep trips to Bedouin village visits and evening safaris.
- **Indexing recommendation:** Candidate, after separating or clearly explaining horse riding and confirming the included activities for each tour.

### Quad Biking & Buggy Tours

- **SEO title:** Quad Biking & Buggy Tours in Egypt | Awesome Adventure Tours
- **Meta description:** Explore available off-road experiences in Hurghada, El Gouna and Sharm El Sheikh. Compare quad rides and other desert trips, with each tour's details shown before booking.
- **Indexing recommendation:** Do not index until Jeep-only and other non-quad products are correctly categorized or the category is renamed to match its real inventory.

### City Tours & Sightseeing

- **SEO title:** Egypt City Tours & Sightseeing | Awesome Adventure Tours
- **Meta description:** Browse city experiences in Cairo and Sharm El Sheikh, and check each tour's route, included stops and departure details before booking.
- **Indexing recommendation:** Review category membership first. The airport-to-hotel transfer is not a city sightseeing tour, and three products make a thin landing page.

### Cultural & Historical Tours

- **SEO title:** Egypt Cultural & Historical Tours | Awesome Adventure Tours
- **Meta description:** Discover Egypt's historic sites and cultural experiences, with trips from Hurghada, Cairo and Sharm El Sheikh. Compare the itinerary and included visits for each tour.
- **Indexing recommendation:** Candidate only after removing unrelated snorkeling/adventure products and confirming that the remaining inventory supports this theme.

### Private Tours

- **SEO title:** Private Tours in Egypt | Awesome Adventure Tours
- **Meta description:** Compare the private experiences currently listed in Cairo, Sharm El Sheikh and Hurghada. Review what's included, transport details and the price basis for each trip.
- **Indexing recommendation:** Keep filter-only or noindex until there is a broader, clearly defined private-tour collection. The current set includes an airport transfer.

## Technical acceptance criteria for any future category pages

1. Each page has a stable, descriptive URL and a self-referencing canonical URL.
2. Each page has genuinely unique title, meta description, H1, introductory copy and useful FAQs.
3. Only published tours that truly belong to that category appear.
4. Thin or mixed categories remain noindex until their content and inventory justify indexation.
5. Sitemap and `llms.txt` include only pages that are intentionally indexable.
6. Category navigation, filters, pagination and direct URL visits work on desktop and mobile.
7. Server-rendered HTML contains the correct category title, description, canonical and visible tour links without waiting for client-side hydration.
8. Tests cover valid, unknown, empty and noindex category routes, as well as duplicate canonical prevention.

## Operator/content-owner decisions still needed

- Confirm whether the category labels are intended to describe the actual activity or broad marketing collections.
- Approve category-to-tour membership, especially Quad Biking & Buggy Tours, Cultural & Historical Tours, City Tours & Sightseeing and Private Tours.
- Confirm whether the business wants dedicated category landing pages or prefers the existing filter experience.
- Approve all SEO text before it is added to production metadata.

