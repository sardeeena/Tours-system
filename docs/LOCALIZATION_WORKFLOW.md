# Multilingual content workflow (all 28 non-English locales)

## Safety and publication policy

- All 28 non-English locales in the shared registry are translation targets, not publicly active languages. They include German, French, Italian, Spanish, Dutch, Polish, Portuguese, Romanian, Russian, Swedish, Danish, Norwegian Bokmål, Finnish, Greek, Bulgarian, Croatian, Czech, Slovak, Slovenian, Hungarian, Estonian, Latvian, Lithuanian, Ukrainian, Serbian, Albanian, Turkish and Arabic. Public content and complete private customer journeys become available only after every required content record, communication template and private UI message is translated, reviewed, published and current. The staff admin interface remains English-only.
- Never translate or alter source prices, currency, pickup times/locations, age limits, safety instructions, inclusions, exclusions, cancellation terms, payment rules, licensing claims, or medical/emergency guidance by assumption. Keep these values faithful to the source and flag ambiguous text for a human.
- Machine-generated translations are drafts only. A human reviewer must check language quality, operational accuracy, SEO metadata, slugs, and all structured fields before using the existing Super Admin + AAL2 publish workflow.
- Publishing remains gated by the server's current SHA-256 source checksum. A changed source invalidates the draft for publication.

## Generate all 28 locales from the protected admin workspace

After this PR is merged and deployed with the existing server-side `GEMINI_API_KEY` configured, a Super Admin with verified MFA (AAL2) can open **Admin → Translation workspace → Generate all 28 languages**. The workflow processes published tours (including itinerary, highlights, inclusions, exclusions and FAQs), destinations, published blog posts, published CMS pages, the homepage, all English communication templates, and every English UI message for every configured non-English locale. Arabic drafts must use clear Modern Standard Arabic; the public interface switches to RTL only after the complete reviewed Arabic UI catalogue is published. It runs in bounded batches with a rate-limit delay and displays per-language progress. It can be safely retried: reviewed/published records are preserved, and changed source records are rechecked.

Every generated record is saved as `draft` with reviewer and publication timestamps unset. The public site, language selector, sitemap and booking locale support do not treat a draft as live. A human reviewer must check factual and operational details, SEO, slugs, and message placeholders. Communication-template publication verifies every original `{{placeholder}}` token and only then synchronizes the reviewed template into the locale-specific customer communication table. Meta/WhatsApp template translations still require approval in Meta Business Manager; the system deliberately keeps WhatsApp sends on currently approved language codes until that external approval exists.

## Export the authoritative source bundle

Run with a server-only Supabase secret in the environment:

```sh
npm run translations:export -- ./translation-source.json
```

The export contains the exact source records used by the translation workspace: published tours and their full related itinerary/highlights/inclusions/exclusions/FAQs rows, published destinations, currently published blog posts, English communication templates (including inactive templates still present in the source catalogue), the homepage, published CMS pages, fallback static pages, and the complete public plus private UI catalogue. It includes source checksums. Treat the export as confidential operational content; do not commit it to the repository.

## Translation bundle format

The French review drafts are stored under `translations/fr/`. Once all source records have been translated, assemble an importable bundle against a fresh source export:

```sh
npm run translations:assemble-fr -- ./translation-source.json ./translation-drafts-fr.json
```

The assembler requires exact coverage of the live source bundle, attaches current SHA-256 checksums, preserves the original IDs and metadata in nested tour rows, and rejects mismatched arrays, placeholders, URLs, email addresses, phone numbers, numeric facts and duplicate slugs. It does not write to the database. The resulting file can be checked with the dry-run import command below. Do not omit structured arrays or operational fields.

## Validate and import drafts

```sh
npm run translations:import -- ./translation-drafts.json
npm run translations:import -- ./translation-drafts.json --apply
```

The default is a dry run. `--apply` upserts only `draft` rows, never marks them reviewed or published, and refuses to overwrite an existing reviewed/published translation. Use a separate export after source edits; the import command intentionally does not trust old source checksums for publication—the public resolver and publishing API re-check the live source.

## Review and launch

1. Review every draft in the Super Admin Translation workspace with MFA/AAL2.
2. Verify terminology, translated slug uniqueness, canonical URLs, SEO title/description, and JSON structured content.
3. Manually verify all safety/operational details against the English source.
4. Submit for review, then publish only after approval.
5. Confirm the locale appears in the public language selector only after the complete UI catalog is published.
6. For Arabic, visually test RTL layout, mixed-direction identifiers, forms, navigation and checkout on mobile and desktop. Test localized SSR, canonical/hreflang, sitemap, booking/checkout, account/login, support, booking confirmation, and email/WhatsApp fallback before marketing any locale. Private customer journeys use the reviewed UI catalogue; the staff admin interface stays English-only. WhatsApp uses a per-locale mapping only after the exact Meta template language is approved and configured.

No migration or production write is run by this workflow automatically.
