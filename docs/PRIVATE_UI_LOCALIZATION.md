# Private customer UI localization and WhatsApp language readiness

This implementation extends the reviewed `ui_catalog` workflow to the private customer journeys. The build-time extractor reads the customer-facing React screens and components and creates stable source keys for visible JSX text, dynamic string values, accessibility labels, placeholders, toast/validation messages, and customer-facing error fallbacks. The Vite transform routes those strings through the same runtime dictionary that the public site uses.

## Covered customer journeys

- Booking and checkout steps, including date/guest selection, pickup, customer details, review, payment, and booking submission.
- Login, registration, password reset, and authentication dialogs.
- Customer account and profile/security screens.
- Existing booking lookup, voucher, and booking-management screens.
- Support ticket creation, queue, ticket details, and replies.
- Booking confirmation, voucher, calendar, and follow-up actions.

Dynamic values are translated only when an exact source message exists in the reviewed UI catalogue. User-entered names, booking references, free-text support messages, prices, dates, and other arbitrary values remain unchanged.

## Generate and publish the five language packs

1. Deploy the merged application with the server-side `GEMINI_API_KEY` configured.
2. Sign in as a Super Admin with AAL2 and open Admin → Translation workspace.
3. Use **Generate all 5 languages** for French, Spanish, Dutch, Polish, and Portuguese. Generation creates drafts only.
4. Review each draft against the English source. Pay particular attention to booking terms, pickup instructions, age restrictions, cancellation terms, payment wording, and customer communications.
5. Publish only after a human reviewer confirms the translation. The public locale resolver verifies the complete UI catalogue, current source checksum, and all required public-content and communication-template coverage before advertising a locale.
6. Re-run generation for stale drafts when the English source checksum changes. Previously reviewed or published rows are protected from automatic overwrite.

The build generates the source catalogue before Vite and server bundling. Do not edit `privateUiCatalog.generated.ts` by hand.

## WhatsApp templates: Meta approval is still required

The application locale and Meta's template language code are not assumed to be identical. WhatsApp delivery uses an explicit server-side mapping:

- `WHATSAPP_TEMPLATE_NAME`: the approved Meta template name.
- `WHATSAPP_TEMPLATE_LANGUAGE`: the approved fallback Meta language code.
- `WHATSAPP_TEMPLATE_LANGUAGE_MAP`: optional JSON mapping from application locale to the exact Meta-approved language code.

The default map keeps the existing approved language set (English, German, Italian, Romanian, and Russian). French, Spanish, Dutch, Polish, and Portuguese continue to use the configured fallback until the corresponding template translations are approved in Meta Business Manager and explicitly added to the map. Example shape only: `{"fr":"<exact Meta code>","es":"<exact Meta code>"}`. Do not guess regional codes.

The communications status endpoint reports the active mapping and whether it is valid. The send endpoint rejects invalid mappings and falls back to the configured approved language when a customer's preferred locale has no explicit mapping. Existing WhatsApp consent checks remain mandatory. No Meta template is created or approved by this code change.

## Operational boundary

This PR changes application code and translation-source extraction only. It does not apply a production migration, generate production translation rows, publish machine translations, or change Meta Business Manager. Draft generation requires the deployed Gemini secret and a Super Admin AAL2 session; final publication requires human review.
