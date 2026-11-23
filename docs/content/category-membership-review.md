# Category membership review — published catalogue

**Prepared:** 23 November 2026  
**Source:** Read-only production snapshot of published categories, tour-category links, tour titles, descriptions, destinations and tour types  
**Status:** Internal recommendation; operator/content-owner approval required  
**Production changes:** None

## Executive recommendation

The current category links are not clean enough to support eight dedicated, indexable category landing pages. Keep the existing category filters for now, correct the membership decisions below, and only then decide which collections have enough relevant inventory for standalone SEO pages.

This review names the exact published records involved. It does not change production data. Category membership can affect navigation, SEO, discovery and customer expectations, so changes should be approved before they are applied.

## Membership review

| Category | Current count | Recommendation |
|---|---:|---|
| Boat Trips & Island Tours | 6 | Retain all six current links. The products are boat/yacht trips and island excursions. |
| Snorkeling & Diving | 7 | Retain all seven links as an activity filter. Consider whether the category should be called “Snorkelling & Diving” consistently with the site's English spelling. These products include boat-based snorkelling and the Ras Mohammed land-based snorkelling trip. |
| Water Sports | 1 | Retain as a filter, but do not create an indexable landing page yet. |
| Desert Safaris | 10 | Retain the core desert activities. Review horse riding and the Colored Canyon/Dahab excursion separately; neither is a conventional desert safari product. |
| Quad Biking & Buggy Tours | 8 | Remove the Jeep-only stargazing safari and the Colored Canyon/Dahab sightseeing excursion from this category. Retain the six quad/ATV-led experiences. Confirm the exact vehicle offered on the product currently titled “Quad Bike Safari” because its copy says “quad bike or buggy.” |
| City Tours & Sightseeing | 3 | Remove the airport transfer from this category. Retain the Old Cairo and Sharm city tours. With two products remaining, keep this as a filter until the collection grows. |
| Cultural & Historical Tours | 9 | Remove the Ras Mohammed snorkelling adventure and the Colored Canyon/Blue Hole/Dahab excursion. Keep the history-led Cairo, Luxor, museum, Mount Sinai and St. Catherine products. Decide whether the Sharm city tour belongs here as well as in City Tours, or whether it should have one primary category. |
| Private Tours | 3 | Retain the two products explicitly marked `tour_type = Private`. Review the airport transfer before retaining it: its title says “Private Arrival Transfer” and its description promises no shared passengers, but its database `tour_type` is currently `Shared`. Confirm the intended meaning of that field and correct the inconsistency through the approved data workflow. |

## Exact records requiring a membership decision

### Quad Biking & Buggy Tours

- **El Gouna: Jeep Desert Safari, BBQ Dinner & Stargazing Experience** — Jeep/4x4 safari, not a quad or buggy tour. Remove from this activity category.
- **Sinai Adventure: Colored Canyon, Blue Hole & Dahab** — sightseeing/nature excursion, not quad biking or buggy riding. Remove from this activity category.
- **Hurghada Quad Bike Safari: Desert Ride, Camel Experience & Bedouin Village** — description says “quad bike or buggy”; confirm which vehicle(s) customers can actually book before deciding whether “Buggy” belongs in the product/category wording.

### Desert Safaris

- **Horse Riding in Hurghada – Sea & Desert Adventure** — horse riding is an outdoor riding activity, not a motorised desert safari. Decide whether to keep it as a broad desert/outdoor experience or create/use a more accurate horse-riding category when inventory supports one.
- **Sinai Adventure: Colored Canyon, Blue Hole & Dahab** — its published summary describes canyons, the Blue Hole and Dahab, not a safari. Move to a more suitable nature/sightseeing category if one exists; otherwise leave it uncategorized rather than forcing a misleading label.

### City Tours & Sightseeing / Private Tours

- **Hurghada Airport to Hotel – Private Arrival Transfer** — this is a transfer, not a city tour. Remove it from City Tours & Sightseeing.
- The same transfer is linked to Private Tours, but its database `tour_type` is `Shared` while its title and description explicitly promise a private transfer with no shared passengers. This is a product-data consistency issue that needs an owner decision; do not silently change the field or customer-facing claim.

### Cultural & Historical Tours

- **Sharm El Sheikh: Ras Mohammed, Magic Lake & Snorkeling Adventure** — primarily a nature/snorkelling excursion. Remove from Cultural & Historical Tours.
- **Sinai Adventure: Colored Canyon, Blue Hole & Dahab** — primarily a nature/sightseeing excursion. Remove from Cultural & Historical Tours.
- **Sharm El Sheikh Private City Tour: Old Market, Mosque & Cathedral** — a valid city/cultural experience, but currently linked to both City Tours & Sightseeing and Cultural & Historical Tours. Choose whether dual categorisation is intentional or whether one should be its primary discovery category.

## SEO/indexation implications

- Do not create indexable landing pages for Water Sports (one product), City Tours & Sightseeing (two relevant products after cleanup), or Private Tours (two confirmed private tours until the transfer inconsistency is resolved).
- Boat Trips & Island Tours and Snorkeling & Diving are the cleanest existing collections, but unique page copy and a canonical/indexation decision are still needed.
- Desert Safaris and Quad Biking & Buggy Tours need the membership decisions above before SEO landing pages are written.
- Cultural & Historical Tours has enough potentially relevant products, but should be cleaned up and checked for overlap before indexation.
- The existing selected-category view remains under the `/excursions` canonical URL. This review does not propose changing that behaviour.

## Approval checklist

Before applying any category changes, the content owner/operator should confirm:

1. Whether a tour may intentionally appear in multiple activity categories.
2. Whether horse riding belongs under Desert Safaris or should be treated as its own activity.
3. Whether the Colored Canyon/Blue Hole/Dahab trip should be placed in a nature/sightseeing category.
4. Whether the airport transfer is truly private and why its `tour_type` is currently `Shared`.
5. Whether the Sharm private city tour should remain in both City Tours and Cultural & Historical.
6. Whether the business wants standalone category landing pages at all, rather than keeping the current filter-based experience.

## Safe next implementation step

Once the above decisions are approved, update the category-to-tour relationships and any inconsistent tour type through a reviewed migration or admin workflow, export the before/after records, verify booking behaviour is unchanged, and run the existing catalogue, SEO, sitemap and browser checks. Do not change prices, availability, pickup rules, cancellation terms or booking configuration as part of taxonomy cleanup.
