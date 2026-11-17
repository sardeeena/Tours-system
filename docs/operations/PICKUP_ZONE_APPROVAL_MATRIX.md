# Pickup-zone approval matrix — 17 November 2026

**Scope:** Awesome Adventure Tours production catalogue and pickup configuration only.  
**Purpose:** Collect operator decisions required by the strict, tour-specific pickup policy in PR #172.  
**Source:** Read-only production query against Supabase project `uvtbtpxtrrmaublrztgv`, cross-checked against `docs/reports/audits/TOUR_PICKUP_MAPPING_AUDIT.md`.

> This is an approval worksheet, not authorization to change production. No zone is inferred from a destination. Do not add, remove, or price mappings until the operator confirms each row.

## Current production snapshot

- 25 published tours.
- All 25 currently have `pickup_available = true`.
- 14 tours have one or more active explicit pickup-zone mappings; 11 have none.
- 7 active pickup zones and 35 active mapping rows.
- All flat fees are €0.00.
- The strict policy now blocks pickup-enabled tours with no active mapping at checkout. An operator must either approve exact zones and fees or explicitly confirm that pickup is not offered.

## Decisions required for tours with no active mapping

For each row, the operator must record: **pickup offered?**, exact eligible hotel zones, fee per person or flat fee for each zone, and approved customer-facing pickup wording. If pickup is not offered, explicitly approve disabling pickup for that tour.

| Destination | Published tour | Current mapping | Operator decision |
|---|---|---|---|
| Cairo | Grand Egyptian Museum Guided Tour with Entry Ticket | None | Confirm whether Cairo/Giza hotel pickup is actually supplied; list eligible zones and fees, or approve no pickup |
| Cairo | Old Cairo Full-Day Tour: Islamic & Coptic Heritage with Lunch | None | Confirm whether Cairo/Giza hotel pickup is actually supplied; list eligible zones and fees, or approve no pickup |
| El Gouna | El Gouna: Desert Quad Safari, Bedouin Village & Camel Ride | None | Confirm exact El Gouna hotel coverage and fee, or approve no pickup |
| El Gouna | El Gouna: Jeep Desert Safari, BBQ Dinner & Stargazing Experience | None | Confirm exact El Gouna hotel coverage and fee, or approve no pickup |
| Hurghada | From Hurghada: Luxor Day Trip, Karnak Temple & Valley of the Kings | None | Confirm Hurghada pickup coverage, transfer supplier and fees, or approve no pickup |
| Hurghada | Hurghada Airport to Hotel – Private Arrival Transfer | None | Confirm whether the pickup selector applies to airport arrival transfers; specify airport/terminal and service scope rather than assuming hotel zones |
| Hurghada | Hurghada Desert Quad Safari: ATV Adventure, Camel Ride & Bedouin Village | None | Confirm exact eligible hotel zones and fees, or approve no pickup |
| Hurghada | Hurghada Parasailing & Banana Boat Adventure with Hotel Pickup | None | Confirm exact eligible hotel zones and fees, or approve no pickup |
| Hurghada | Hurghada: Hula Hula Island Yacht Trip with Snorkeling & Lunch | None | Confirm exact eligible hotel zones and fees, or approve no pickup |
| Sharm El Sheikh | Ras Mohamed & White Island: Diving & Snorkeling Boat Trip | None | Confirm Sharm hotel coverage and fees, or approve no pickup |
| Sharm El Sheikh | Ultimate Sinai Desert Safari: Quad, Camel & BBQ Adventure | None | Confirm exact eligible hotel zones and fees, or approve no pickup |

## Existing explicit mappings — operator confirmation still required

These mappings are present in production and have not been changed. Confirm that each is operationally valid and that its fee and public copy are accurate.

| Destination | Published tour | Existing active zones and per-person fee |
|---|---|---|
| Hurghada | Giftun Island & Orange Bay Yacht Trip with Snorkeling & Lunch | Hurghada City €0; Makadi Bay €5; Sahl Hasheesh €5; El Gouna €10; Soma Bay €10; Safaga €10 |
| Hurghada | Hurghada Desert Stargazing Safari: Jeep Adventure, Bedouin Dinner & Telescope Experience | Hurghada City €0; Makadi Bay €5; Sahl Hasheesh €5; El Gouna €10; Soma Bay €10; Safaga €10 |
| Hurghada | Hurghada Dolphin Watching & Snorkeling Boat Trip | Hurghada City €0 |
| Hurghada | Hurghada Quad Bike Safari: Desert Ride, Camel Experience & Bedouin Village | Hurghada City €0; Makadi Bay €5; Sahl Hasheesh €5; El Gouna €10; **Sharm El Sheikh €0 (geographic anomaly — verify urgently)**; Soma Bay €10; Safaga €10 |
| Hurghada | Orange Bay Island Boat Trip from Hurghada | Hurghada City €0; Makadi Bay €5; Sahl Hasheesh €5; El Gouna €10; Soma Bay €10; Safaga €10 |
| Sharm El Sheikh | Afternoon Desert Safari with Echo Mountains & Bedouin Village | Sharm El Sheikh €0 |
| Sharm El Sheikh | Cairo Pyramids, Sphinx & Egyptian Museum Day Trip from Sharm El Sheikh | Sharm El Sheikh €0 |
| Sharm El Sheikh | From Sharm: White Island and Ras Mohamed Snorkeling Trip | Sharm El Sheikh €0 |
| Sharm El Sheikh | Mount Sinai Sunrise Hike & St. Catherine’s Monastery from Sharm El Sheikh | Sharm El Sheikh €0 |
| Sharm El Sheikh | Sharm El Sheikh Private City Tour: Old Market, Mosque & Cathedral | Sharm El Sheikh €0 |
| Sharm El Sheikh | Sharm El Sheikh: Ras Mohammed, Magic Lake & Snorkeling Adventure | Sharm El Sheikh €0 |
| Sharm El Sheikh | Sharm: Super Safari ATV, Camel Ride, Stargazing & BBQ Dinner | Sharm El Sheikh €0 |
| Sharm El Sheikh | Sinai Adventure: Colored Canyon, Blue Hole & Dahab | Sharm El Sheikh €0 |
| Sharm El Sheikh | St. Catherine Monastery & Dahab Day Trip from Sharm El Sheikh | Sharm El Sheikh €0 |

## Pickup-zone master data requiring completion

All flat fees are currently €0.00. Every pickup-zone `description` is blank. The Hurghada City and Sharm El Sheikh zones also have blank `area` fields.

| Zone code | Current customer-facing name | Current fee/person | Required operator input |
|---|---|---:|---|
| `hurghada-city` | Hurghada City Hotels | €0 | Define hotel coverage, exclusions and area description |
| `makadi-bay` | Makadi Bay Hotels | €5 | Confirm coverage and €5 fee |
| `sahl-hasheesh` | Sahl Hasheesh Hotels | €5 | Confirm coverage and €5 fee |
| `el-gouna` | El Gouna Hotels | €10 | Confirm coverage and €10 fee |
| `sharm-el-sheikh` | Sharm El Sheikh Hotels | €0 | Define hotel coverage, exclusions and area description |
| `soma-bay` | Soma Bay Hotels | €10 | Confirm coverage and €10 fee |
| `safaga` | Safaga Hotels | €10 | Confirm coverage and €10 fee |

## Commercial-copy mismatch

The four multi-zone Hurghada tours with surcharged zones currently contain pickup copy describing pickup as complimentary across Hurghada. That wording conflicts with €5/€10 per-person fees for several mapped zones. Confirm which zones are included and which are surcharged, then align tour copy and checkout display.

## Approval record

For every tour and zone decision, record the operator name, decision date, exact approved zone(s), fee type and amount, and any exclusions. The implementation team should apply only those written decisions. Do not clear the suspicious Sharm mapping from the Hurghada quad tour until the operator explicitly confirms the intended correction.

## Release note

PR #172 enforces the strict policy in application code and the booking RPC. The current production data remains unchanged: 11 pickup-enabled tours have no active mapping and therefore cannot complete pickup checkout until an operator makes the decisions above. This is intentional fail-closed behavior.
