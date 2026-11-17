# Production Pickup Mapping Audit — 17 November 2026

Scope: Awesome Adventure Tours production database only. This is a read-only audit snapshot; no tour mapping, pickup zone, fee, booking, payment, or customer record was changed.

## Executive findings

- Published tours: **25**
- Published tours with at least one active explicit pickup mapping: **14**
- Published tours with no active explicit pickup mapping: **11**
- Active pickup zones: **7**
- Active tour-to-zone mapping rows: **35**
- All 25 published tours currently have `pickup_available = true`.
- All 35 existing mapping rows point to active pickup zones.
- No pickup schedules currently exist.

## Published tours missing an active explicit mapping

All of these currently have `pickup_available = true`; none has an active row in `tour_pickup_locations`.

| Destination | Published tour | Existing pickup copy |
|---|---|---|
| Cairo | Grand Egyptian Museum Guided Tour with Entry Ticket | Complimentary lobby pickup and return across Cairo and Giza included |
| Cairo | Old Cairo Full-Day Tour: Islamic & Coptic Heritage with Lunch | Complimentary lobby pickup and return across Cairo and Giza included |
| El Gouna | El Gouna: Desert Quad Safari, Bedouin Village & Camel Ride | Complimentary lobby pickup and return across El Gouna included |
| El Gouna | El Gouna: Jeep Desert Safari, BBQ Dinner & Stargazing Experience | Complimentary lobby pickup and return across El Gouna included |
| Hurghada | From Hurghada: Luxor Day Trip, Karnak Temple & Valley of the Kings | Complimentary lobby pickup and return across Hurghada included |
| Hurghada | Hurghada Airport to Hotel – Private Arrival Transfer | Complimentary lobby pickup and return across Hurghada included |
| Hurghada | Hurghada Desert Quad Safari: ATV Adventure, Camel Ride & Bedouin Village | Complimentary lobby pickup and return across Hurghada included |
| Hurghada | Hurghada Parasailing & Banana Boat Adventure with Hotel Pickup | Complimentary lobby pickup and return across Hurghada included |
| Hurghada | Hurghada: Hula Hula Island Yacht Trip with Snorkeling & Lunch | Complimentary lobby pickup and return across Hurghada included |
| Sharm El Sheikh | Ras Mohamed & White Island: Diving & Snorkeling Boat Trip | Pick-up and drop-off included |
| Sharm El Sheikh | Ultimate Sinai Desert Safari: Quad, Camel & BBQ Adventure | Pick-up and drop-off included |

**Required operator input:** for each row, confirm whether pickup is offered, the exact eligible hotel zones, and whether each zone is complimentary or charged. If pickup is not offered, the tour's `pickup_available` setting and public copy need an explicit owner decision. No mapping has been inferred.

## Existing active pickup zones and fees

All flat fees are currently EUR 0.00.

| Zone code | Customer-facing name | Fee per person | Area description |
|---|---|---:|---|
| `hurghada-city` | Hurghada City Hotels | €0 | Missing |
| `makadi-bay` | Makadi Bay Hotels | €5 | Present |
| `sahl-hasheesh` | Sahl Hasheesh Hotels | €5 | Present |
| `el-gouna` | El Gouna Hotels | €10 | Present |
| `sharm-el-sheikh` | Sharm El Sheikh Hotels | €0 | Missing |
| `soma-bay` | Soma Bay Hotels | €10 | Present |
| `safaga` | Safaga Hotels | €10 | Present |

Every pickup-zone `description` field is blank. The Hurghada City and Sharm El Sheikh zones also have blank `area` fields. Operators should provide precise hotel coverage / exclusions for these zones.

## Existing explicit mappings

- **Giftun Island & Orange Bay Yacht Trip with Snorkeling & Lunch (Hurghada):** Hurghada City (€0), Makadi Bay (€5/person), Sahl Hasheesh (€5/person), El Gouna (€10/person), Soma Bay (€10/person), Safaga (€10/person).
- **Hurghada Desert Stargazing Safari: Jeep Adventure, Bedouin Dinner & Telescope Experience:** same six zones and fees.
- **Hurghada Dolphin Watching & Snorkeling Boat Trip:** Hurghada City only (€0).
- **Hurghada Quad Bike Safari: Desert Ride, Camel Experience & Bedouin Village:** Hurghada City (€0), Makadi Bay (€5/person), Sahl Hasheesh (€5/person), El Gouna (€10/person), Soma Bay (€10/person), Safaga (€10/person), **Sharm El Sheikh (€0)**.
- **Orange Bay Island Boat Trip from Hurghada:** same six Red Sea zones as the Giftun Island trip.
- **Afternoon Desert Safari with Echo Mountains & Bedouin Village (Sharm):** Sharm El Sheikh (€0).
- **Cairo Pyramids, Sphinx & Egyptian Museum Day Trip from Sharm El Sheikh:** Sharm El Sheikh (€0).
- **From Sharm: White Island and Ras Mohamed Snorkeling Trip:** Sharm El Sheikh (€0).
- **Mount Sinai Sunrise Hike & St. Catherine’s Monastery from Sharm El Sheikh:** Sharm El Sheikh (€0).
- **Sharm El Sheikh Private City Tour: Old Market, Mosque & Cathedral:** Sharm El Sheikh (€0).
- **Sharm El Sheikh: Ras Mohammed, Magic Lake & Snorkeling Adventure:** Sharm El Sheikh (€0).
- **Sharm: Super Safari ATV, Camel Ride, Stargazing & BBQ Dinner:** Sharm El Sheikh (€0).
- **Sinai Adventure: Colored Canyon, Blue Hole & Dahab:** Sharm El Sheikh (€0).
- **St. Catherine Monastery & Dahab Day Trip from Sharm El Sheikh:** Sharm El Sheikh (€0).

### Mapping requiring owner verification

The Hurghada Quad Bike Safari has an explicit mapping to `sharm-el-sheikh`. This is a geographic anomaly relative to the tour's destination and pickup description. It is preserved in the database and must not be deleted or hidden without operator confirmation.

## Pricing and copy discrepancies

The four mapped Hurghada tours with multiple zones use pickup copy saying complimentary pickup across Hurghada, while their explicit El Gouna, Makadi Bay, Sahl Hasheesh, Soma Bay, and Safaga mappings carry €5 or €10 per-person fees. The checkout currently calculates the zone fee from the database, but the tour-level copy can mislead customers. Confirm the correct commercial policy and then update copy to distinguish included zones from surcharged zones.

## Code-path defects confirmed

1. The booking page previously called `getPublishedPickupLocations(currentTour.destination || currentTour.id)`. Because a destination name is present, the service was not given the tour UUID and therefore did not load the explicit tour mapping; it fell back to destination heuristics.
2. The service's destination fallback could return a general coastal zone list for tours with no explicit mappings; a missing destination-specific zone list could fall back to all active zones.
3. The booking RPC previously enforced tour mapping only when at least one mapping row existed. A tour with no mapping could therefore submit any active pickup zone.

The strict-policy PR changes these paths to require tour-specific active mappings, removes destination-based fallback, and rejects checkout for pickup-enabled tours with no approved active mapping. The admin editor also prevents publishing a pickup-enabled tour with zero selected zones.

## Rollout impact and safety

Until an operator adds approved mappings or explicitly disables pickup for a tour, the 11 currently unmapped tours remain visible but their booking checkout will stop at the pickup step and direct customers to contact the booking team. This is intentional fail-closed behavior under Option A; it avoids promising unapproved transfers.

No production mappings or fees have been added, deleted, or edited by this audit.
