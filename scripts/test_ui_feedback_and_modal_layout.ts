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
assert.match(worker, /BOOKING_NOTIFICATION_WORKER_ENABLED.*=== 'false'/, 'Worker is enabled by default when configured and can be explicitly disabled');

const migration = fs.readFileSync('supabase/migrations/20261116000000_branded_booking_ticket_email_template.sql', 'utf8');
assert.match(migration, /Awesome Adventure Tours/);
assert.doesNotMatch(migration, /Kemet Spirit/i);
assert.match(migration, /ON CONFLICT \(template_key\) DO UPDATE/);

console.log('Toast accessibility, responsive modal layout and booking ticket workflow checks passed.');
