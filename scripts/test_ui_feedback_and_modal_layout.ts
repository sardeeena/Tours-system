import assert from 'node:assert/strict';
import fs from 'node:fs';

const toast = fs.readFileSync('src/contexts/ToastContext.tsx', 'utf8');
assert.match(toast, /role=\{isError \? 'alert' : 'status'\}/);
assert.match(toast, /aria-live=\{isError \? 'assertive' : 'polite'\}/);
assert.match(toast, /DEFAULT_DURATIONS/);
assert.match(toast, /z-\[10000\]/);

const css = fs.readFileSync('src/index.css', 'utf8');
assert.match(css, /\.aat-modal-overlay/);
assert.match(css, /\.aat-modal-panel/);
assert.match(css, /100dvh/);
assert.match(css, /env\(safe-area-inset-bottom\)/);
assert.match(css, /\.aat-modal-body/);
assert.match(css, /\.aat-modal-actions/);
assert.match(css, /\.aat-modal-panel-scroll > button:first-child[\s\S]*position: sticky/, 'Long confirmation dialogs keep their close control visible');

const dialogs = [
  'src/components/auth/AuthModal.tsx',
  'src/components/common/ConfirmationModal.tsx',
  'src/components/common/MyBookingModal.tsx',
  'src/components/common/HelpInquiryModal.tsx',
  'src/components/common/CompareModal.tsx',
  'src/components/home/QuickBookModal.tsx',
  'src/components/home/TourPreviewModal.tsx',
  'src/components/admin/PlatformIntegrationModal.tsx',
];
for (const path of dialogs) {
  const source = fs.readFileSync(path, 'utf8');
  assert.match(source, /aat-modal-overlay/, path + ' uses the shared responsive overlay');
  assert.match(source, /aat-modal-panel/, path + ' uses the shared responsive panel');
}

const quickBook = fs.readFileSync('src/components/home/QuickBookModal.tsx', 'utf8');
assert.match(quickBook, /aat-modal-actions/, 'Quick booking submit action remains sticky and visible');
const help = fs.readFileSync('src/components/common/HelpInquiryModal.tsx', 'utf8');
assert.match(help, /aat-modal-actions/, 'Help request submit actions remain sticky and visible');
assert.match(help, /catch \(error\)/, 'Unexpected help form failures are surfaced instead of leaving the form loading');
assert.match(help, /showToast\(messageText, 'error'\)/, 'Help form failures also use the global error notification');
const authModal = fs.readFileSync('src/components/auth/AuthModal.tsx', 'utf8');
assert.match(authModal, /showToast\(message, 'error'\)/, 'Authentication form errors use visible notifications');
assert.match(authModal, /catch \(error\)/, 'Authentication network failures are handled');
assert.match(authModal, /setErrorMsg\(message\);\s*showToast\(message, 'error'\)/, 'Authentication errors update inline state and toast notifications');
const bookingLookup = fs.readFileSync('src/components/common/MyBookingModal.tsx', 'utf8');
assert.match(bookingLookup, /showToast\(message, 'error'\)/, 'Booking lookup errors use visible notifications');
const availabilityStep = fs.readFileSync('src/components/booking/StepDateGuests.tsx', 'utf8');
assert.match(availabilityStep, /showToast\('We could not verify availability/, 'Availability service failures use visible notifications');

const tourPreview = fs.readFileSync('src/components/home/TourPreviewModal.tsx', 'utf8');
assert.match(tourPreview, /aat-modal-footer[\s\S]*Select Date & Book Now/, 'Tour preview keeps the primary booking action in the visible sticky footer');

const bookingPage = fs.readFileSync('src/pages/BookingPage.tsx', 'utf8');
assert.doesNotMatch(bookingPage, /notificationService\.sendBookingConfirmation/, 'Booking page does not call the inactive browser notification stub');
const worker = fs.readFileSync('src/server/bookingNotificationWorker.ts', 'utf8');
assert.match(worker, /renderBookingTicketEmailHtml/, 'Booking worker sends the dedicated ticket HTML');
assert.match(worker, /booking_extras\(/, 'Booking worker includes persisted add-ons');
assert.match(worker, /pickup_locations\(/, 'Booking worker includes the persisted pickup location');
assert.match(worker, /BOOKING_NOTIFICATION_WORKER_ENABLED.*!== 'true'/, 'Booking email delivery remains explicitly opt-in until provider acceptance is verified');

const migration = fs.readFileSync('supabase/migrations/20261116000000_branded_booking_ticket_email_template.sql', 'utf8');
assert.match(migration, /Awesome Adventure Tours/);
assert.match(migration, /ON CONFLICT \(template_key\) DO UPDATE/);

console.log('Toast accessibility, responsive modal layout and booking ticket workflow checks passed.');


const motionSystem = fs.readFileSync('src/components/common/SiteMotionSystem.tsx', 'utf8');
assert.match(motionSystem, /prefers-reduced-motion: reduce/, 'Site motion respects reduced-motion preferences');
assert.match(motionSystem, /IntersectionObserver/, 'Sections reveal as they enter the viewport without a scroll listener');
assert.match(motionSystem, /MutationObserver/, 'Newly rendered route and admin content receives the same motion treatment');
assert.match(motionSystem, /data-scroll-to/, 'Explicit scroll triggers bring their target into view');
assert.match(motionSystem, /aria-controls/, 'Expandable controls and tabs scroll their newly revealed content into view');
assert.match(motionSystem, /scrollIntoView/, 'Smart scrolling uses the browser native scroll API');
assert.match(motionSystem, /aat-visible/, 'Revealed content transitions into its visible state');

const app = fs.readFileSync('src/App.tsx', 'utf8');
assert.match(app, /SiteMotionSystem/, 'The global motion system is mounted across the website');
assert.match(app, /prefers-reduced-motion: reduce.*\? 'auto' : 'smooth'/, 'Route and section navigation avoid forced smooth motion for users who request reduced motion');

assert.match(css, /scroll-behavior: smooth/, 'In-page anchor navigation scrolls smoothly');
assert.match(css, /\.aat-reveal/, 'Shared reveal animation styles are available site-wide');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, 'Global motion styles disable movement when requested');
assert.match(css, /\.admin-shell/, 'Motion styling covers the admin workspace as well as public pages');

console.log('Site-wide motion, smart scrolling and reduced-motion accessibility checks passed.');


// Full booking and tour-discovery redesign: guard against reverting to cosmetic-only controls.
const dateGuestStep = fs.readFileSync('src/components/booking/StepDateGuests.tsx', 'utf8');
assert.match(dateGuestStep, /aa-date-tile/, 'Booking dates are presented as selectable date tiles');
assert.match(dateGuestStep, /Previous week[\s\S]*Next week/, 'Booking date tiles support week navigation');
assert.match(dateGuestStep, /aa-departure-card/, 'Departure times are distinct selectable cards');
assert.match(dateGuestStep, /aria-pressed=\{selected\}/, 'Departure selection exposes its selected state');
assert.match(dateGuestStep, /remainingCapacity/, 'Departure cards retain capacity-aware availability');
assert.match(dateGuestStep, /aa-guest-card/, 'Adult, child and infant counts use dedicated traveller cards');

const pickupStep = fs.readFileSync('src/components/booking/StepPickup.tsx', 'utf8');
assert.match(pickupStep, /aa-pickup-option/, 'Approved pickup locations use prominent choice cards');
assert.match(pickupStep, /pickupAvailable/, 'Pickup eligibility remains enforced');

const extrasStep = fs.readFileSync('src/components/booking/StepExtras.tsx', 'utf8');
assert.match(extrasStep, /aa-extra-card/, 'Optional extras use dedicated selectable cards');
assert.match(extrasStep, /onUpdateQuantity/, 'Optional extra quantity controls remain available');

const tourBookingPanel = fs.readFileSync('src/components/tours/TourBookingPanel.tsx', 'utf8');
assert.match(tourBookingPanel, /aa-date-tile/, 'Tour detail booking panel uses quick-pick date tiles');
assert.match(tourBookingPanel, /type="date"/, 'Tour detail booking panel retains full date selection');

const tourSearch = fs.readFileSync('src/components/tours/TourSearch.tsx', 'utf8');
assert.match(tourSearch, /aa-search-panel/, 'Tour discovery uses a prominent search panel');
assert.match(tourSearch, /aa-search-field/, 'Destination, activity, date and traveller filters have distinct field cards');
assert.match(tourSearch, /aa-category-pill/, 'Tour categories use dedicated navigation pills');

for (const path of ['src/components/booking/StepCustomerInfo.tsx', 'src/components/booking/StepPayment.tsx']) {
  const source = fs.readFileSync(path, 'utf8');
  assert.match(source, /aa-booking-section/, path + ' uses the shared booking-step hierarchy');
}
assert.match(css, /\.aa-date-tile\.is-selected/, 'Date tiles have a distinct selected state');
assert.match(css, /\.aa-departure-card\.is-selected/, 'Departure cards have a distinct selected state');
assert.match(css, /\.aa-search-field/, 'Search filter fields receive responsive styling');
console.log('Full booking experience and tour discovery interaction checks passed.');
