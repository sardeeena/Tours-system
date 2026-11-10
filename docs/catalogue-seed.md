# Kemet Spirit catalogue seed

The SQL file `supabase/seed/kemet_spirit_catalogue.sql` imports the 13 excursions currently published on `kemetspirit.com` into the relational Supabase catalogue.

## Safety and scope

- The seed is additive and idempotent. It uses `INSERT ... ON CONFLICT DO NOTHING`; it contains no `UPDATE`, `DELETE`, `TRUNCATE`, or `DROP`.
- Existing catalogue rows with a matching slug but a different ID cause the preflight to abort rather than attaching relations to the wrong record.
- Preflight checks both slug-to-ID and ID-to-slug collisions for tours, destinations, and categories; a conflict aborts the transaction instead of attaching child records to an unrelated row.
- Legacy category aliases (`Boat Trip`, `Island`, `Island Visits`, `Private Tour`, and `Quad`) are normalized to the six canonical categories, and each tour/category link is inserted once with the primary category first.
- All 13 tours are published to preserve the existing public catalogue. All seven destinations and all six categories are published, including Makadi Bay with zero assigned excursions, matching the public destination directory.
- Tour ratings and review counts are zero. No reviews or bookings are inserted.
- The scuba experience's minimum age restriction is retained. Departure labels are normalized to valid 12-hour times (for example, `02:00 PM`, not `14:00 PM`).
- The current tour-specific optional extras are inserted and assigned. The four pre-existing generic extras are preserved. The separate legacy `GLOBAL_BOOKING_EXTRAS` list is intentionally not imported because its prices differ from the tour-specific options currently shown on the live tour pages.
- Stock images are marked as illustrative in their alt text and captions; replace them with operator-approved photography when available.
- Pickup-location fee records are inserted inactive. Tour-level pickup instructions are preserved, but global area surcharges are not activated because the current tour pages contain exceptions that need an operator fee review.
- No customer, auth user, staff, or availability-date records are created. The booking schedule continues to derive from each tour's published days and departure time.

## Execution

Run this file only after applying all migrations on the target project. Review the preflight and verification output in the SQL file. It can be run again safely to add missing rows without overwriting edits made after the first import.

For a production run, use the Supabase SQL Editor or an authenticated database session with migration-owner privileges. Do not place the service-role key in source control or in a client-side environment variable.

## Existing live catalogue

The live Kemet Spirit project already contains the 13 deterministic tour records, seven destinations, six categories, relational tour content, and five assigned per-tour extras. The live audit confirms 23 unique tour/category links, 31 tour images with one primary image per tour, 79 itinerary steps, 62 highlights, 64 inclusions, 25 exclusions, 47 what-to-bring items, 16 important-information items, and 13 tour SEO rows. Ratings and reviews remain zero. All seven pickup-location fee records are inactive.

The original live records still contain three malformed departure labels, the scuba tour's minimum age is null, and Makadi Bay is draft despite appearing in the public destination directory with zero tours. Re-running the insert-only seed will not change these existing rows because it uses `ON CONFLICT DO NOTHING`.

A separate, guarded correction file is available at `supabase/seed/kemet_spirit_catalogue_live_corrections.sql`. It targets only the five exact records/old values described above and does not delete anything. **It is not automatic and must not be run against production until the operator explicitly approves the data changes.**

## Verification

The final query reports tour, destination, category, pickup, add-on, image, itinerary, inclusion/exclusion, preparation-detail, SEO, and rating/review counts. Expected core counts are 13 published tours, 7 published destinations, 6 published categories, 5 per-tour add-ons assigned, 0 rated tours, and 0 reviews.
