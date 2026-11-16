# Multilingual content workflow (French, Spanish, Dutch, Polish, Portuguese)

## Safety and publication policy

- The five locales are draft targets, not publicly active languages.
- Never translate or alter source prices, currency, pickup times/locations, age limits, safety instructions, inclusions, exclusions, cancellation terms, payment rules, licensing claims, or medical/emergency guidance by assumption. Keep these values faithful to the source and flag ambiguous text for a human.
- Machine-generated translations are drafts only. A human reviewer must check language quality, operational accuracy, SEO metadata, slugs, and all structured fields before using the existing Super Admin + AAL2 publish workflow.
- Publishing remains gated by the server's current SHA-256 source checksum. A changed source invalidates the draft for publication.

## Generate all five locales from the protected admin workspace

After this PR is merged and deployed with the existing server-side `GEMINI_API_KEY` configured, a Super Admin with verified MFA (AAL2) can open **Admin → Translation workspace → Generate all 5 languages**. The workflow processes published tours (including itinerary, highlights, inclusions, exclusions and FAQs), destinations, published blog posts, published CMS pages, the homepage, all English communication templates, and every English UI message for French, Spanish, Dutch, Polish and Portuguese. It runs in bounded batches with a rate-limit delay and displays per-language progress. It can be safely retried: reviewed/published records are preserved, and changed source records are rechecked.

Every generated record is saved as `draft` with reviewer and publication timestamps unset. The public site, language selector, sitemap and booking locale support do not treat a draft as live. A human reviewer must check factual and operational details, SEO, slugs, and message placeholders. Communication-template publication verifies every original `{{placeholder}}` token and only then synchronizes the reviewed template into the locale-specific customer communication table. Meta/WhatsApp template translations still require approval in Meta Business Manager; the system deliberately keeps WhatsApp sends on currently approved language codes until that external approval exists.

## Export the authoritative source bundle

Run with a server-only Supabase secret in the environment:

```sh
npm run translations:export -- ./translation-source.json
```

The export contains published tours and their itinerary/highlights/inclusions/exclusions/FAQs, published destinations, currently published blog posts, and published CMS pages. AI bulk generation also covers the homepage, English communication templates, and the complete UI catalog. It includes source checksums. Treat the export as confidential operational content; do not commit it to the repository.

## Translation bundle format

Create `translation-drafts.json` using schema_version `1`. Each record carries the same `entity_type`, `entity_key`, `locale`, and `source_checksum` from the source bundle, plus `title`, `translated_slug`, `summary`, `seo_title`, `seo_description`, and a structured `content` object. Include one record per source record and target locale. Do not omit structured arrays or operational fields. The UI catalog is managed separately through the Super Admin translation workspace because it must translate every English UI key.

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
6. Test localized SSR, canonical/hreflang, sitemap, booking handoff, and email/WhatsApp template fallback before marketing the locale.

No migration or production write is run by this workflow automatically.
