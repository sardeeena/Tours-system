# GA4 administration and attribution runbook

This is the manual GA4 work that cannot be completed through the currently connected Windsor.ai reporting integration. That connector can read reports, but it does not expose the GA4 Admin API operations needed to create custom definitions or change property settings.

## Property verified during the audit

- GA4 property: `565425061`
- Web stream measurement ID: `G-XGYXLWF4FG`
- Current reporting time zone: `Europe/Berlin`
- Current property currency: `EUR`

If Awesome Adventure's reporting day should follow Egypt business operations, change the property time zone to `Africa/Cairo` in GA4 Admin. This is a manual property-level setting; it does not rewrite historical event timestamps, so compare date ranges carefully around the change. Keep EUR as the property currency if EUR remains the reporting currency. The site sends the event currency separately.

## Custom event dimensions to register

In GA4, open **Admin → Data display → Custom definitions → Custom dimensions → Create custom dimension**. Use **Event** scope.

| Display name | Event parameter | Purpose |
|---|---|---|
| Tour slug | `tour_slug` | Which excursion was viewed or submitted |
| Destination | `destination` | Destination context |
| Category | `category` | Excursion category |
| Booking step | `step` | Booking funnel step; the website maps `booking_step` to `step` before sending |

Do not register `currency`, `page_path`, `page_location`, `page_title`, `session_id`, `user_id`, payment methods, guest counts, or customer identifiers as custom dimensions. The site deliberately does not forward payment-method or guest-count details to GA4. GA4 already has standard page/campaign dimensions, and some parameter names are reserved.

Google reference: [Create custom dimensions](https://support.google.com/analytics/answer/14240153).

## Booking value reporting (no custom metric required)

The site sends the numeric `value` and ISO `currency` parameters on both `booking_submitted` and its lead alias `qualify_lead`. GA4 already provides the standard **Event value** metric for the `value` parameter, so do not create a duplicate custom metric.

In an Exploration or a customized Events report:

1. Add the standard **Event value** metric.
2. Filter the event name to exactly `booking_submitted` so the same submitted reservation is not counted again under the `qualify_lead` alias.
3. Break down or filter by the standard **Currency** dimension.
4. Label the result **Submitted booking value — not revenue**.

Important: GA4's Event value metric is not currency-converted and combines realized and unrealized values. This event represents the requested value of a reservation, not cash received. Do not use it as purchase revenue.

Google references: [Event value metric](https://support.google.com/analytics/answer/12926615) and [GA4 event value/currency parameters](https://developers.google.com/analytics/devguides/collection/ga4/reference/events).

## Key-event rules

- `qualify_lead`: keep as the lead key event. It is emitted after the reservation is successfully saved and only when analytics consent is granted.
- `close_convert_lead`: do not count until there is an authoritative supplier-response status and a consent-safe attribution link. The current supplier workflow is staff-managed and has no supplier callback or separate rejected state.
- `purchase`: do not emit for a submitted, pending, confirmed-but-unpaid or partially paid booking. It should represent the business's chosen completed-payment definition, based on the finance ledger, and only be sent to GA4 where a valid consented attribution identity is available.

Do not create custom events or import offline conversions by matching booking references, email addresses, phone numbers or other customer identifiers.

## UTM naming standard

Use lowercase values and a consistent vocabulary:

| Parameter | Standard |
|---|---|
| `utm_source` | `facebook`, `instagram`, `tiktok`, `google`, `newsletter`, `partner` |
| `utm_medium` | `paid_social`, `organic_social`, `cpc`, `email`, `referral`, `influencer` |
| `utm_campaign` | Stable campaign name in kebab-case, e.g. `red-sea-snorkeling-winter-2026` |
| `utm_content` | Creative/placement variant, e.g. `reef-video-vertical-a` |
| `utm_term` | Paid-search keyword only |

Never put a person's name, email, phone number, booking reference or other customer data in a UTM value. Do not invent new source/medium spellings for each campaign. GA4 already provides standard session source, medium, campaign and manual campaign dimensions; do not create duplicate custom dimensions for them.

The first-party session metadata currently stores UTM values when a consented session is created. Full first-touch/last-touch attribution across sessions and a verified booking attribution join are **not** implemented by this PR. They require a separate consent, retention and data-model decision.

## Verification after the manual steps

1. Use GA4 DebugView with a consented test session and confirm the event parameters above appear on the expected events.
2. Confirm `booking_submitted` and `qualify_lead` occur once per successful submission.
3. Confirm `purchase` does not appear for pending or unpaid bookings.
4. After creating the custom definitions, wait 24–48 hours and verify the dimensions/metrics in Explorations.
5. Compare GA4 counts with the first-party visitor funnel only over identical date ranges and with consent coverage noted. They are not expected to match when visitors deny consent or use blockers.
