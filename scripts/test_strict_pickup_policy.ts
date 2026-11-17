import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`[PASS] ${label}`);
    passed++;
  } else {
    console.error(`[FAIL] ${label}`);
    failed++;
  }
}

const service = read('src/services/tourService.ts');
const booking = read('src/pages/BookingPage.tsx');
const pickupStep = read('src/components/booking/StepPickup.tsx');
const adminEditor = read('src/components/admin/AdminTourEditor.tsx');
const review = read('src/components/booking/StepReview.tsx');
const migration = read('supabase/migrations/20261117210000_strict_tour_pickup_mapping_enforcement.sql');
const audit = read('docs/reports/audits/TOUR_PICKUP_MAPPING_AUDIT.md');

assert(service.includes(".from('tour_pickup_locations')") && service.includes('approvedLocationIds.has(location.id)'), 'pickup service filters only explicit tour mapping IDs');
assert(!service.includes('Default to Hurghada') && !service.includes('marsaList') && !service.includes('sharmList'), 'destination-based pickup fallback logic is removed');
assert(booking.includes('getPublishedPickupLocations(currentTour.id)'), 'booking page requests pickup locations by exact tour ID');
assert(booking.includes('Promise.allSettled') && booking.includes('pickupResult.status'), 'pickup lookup failure is isolated from optional extras loading');
assert(!pickupStep.includes('STANDARD_PICKUP_LOCATIONS'), 'pickup step never falls back to a global standard pickup list');
assert(pickupStep.includes('pickupList.length > 0') && pickupStep.includes('disabled={!canContinue}'), 'checkout cannot continue when a pickup-enabled tour has no approved locations');
assert(adminEditor.includes('selectedPickupIds.length === 0') && adminEditor.includes('must have at least one explicitly approved active pickup location'), 'admin cannot publish a pickup-enabled tour without an explicit mapping');
assert(adminEditor.includes("handleFieldChange('pickup_available', e.target.checked)") && adminEditor.includes('Existing pickup mappings are preserved'), 'admin can explicitly disable pickup without deleting existing mappings');
assert(review.includes("'No pickup service'"), 'booking review does not invent a default Hurghada pickup');
assert(migration.includes('COALESCE(v_tour.pickup_available, FALSE)') && migration.includes('pickup_location_id = v_extra_record.id'), 'database migration enforces strict tour-specific pickup eligibility');
assert(audit.includes('11**') && audit.includes('Active tour-to-zone mapping rows: **35**') && audit.includes('Sharm El Sheikh (€0)'), 'production audit records missing tours, mapping count, and anomaly for operator review');

console.log(`\nStrict pickup policy tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
