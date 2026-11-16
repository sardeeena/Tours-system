import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { renderBrandedEmailHtml, renderBookingTicketEmailHtml, EMAIL_LOGO_URL } from '../src/utils/emailTemplate';

const rendered = renderBrandedEmailHtml({
  heading: '<Welcome>',
  preheader: 'Preview text',
  bodyText: 'Hello <script>alert(1)</script>\n\nUnsubscribe: https://awesomeadventure.tours/unsubscribe?token=a&source=email',
});

assert.equal(EMAIL_LOGO_URL, 'https://awesomeadventure.tours/logo.png');
assert.match(rendered, /https:\/\/awesomeadventure\.tours\/logo\.png/);
assert.doesNotMatch(rendered, /logo\.jpg/);
assert.match(rendered, /alt="Awesome Adventure Tours"/);
assert.match(rendered, /&lt;Welcome&gt;/);
assert.doesNotMatch(rendered, /<script>alert\(1\)<\/script>/);
assert.match(rendered, /href="https:\/\/awesomeadventure\.tours\/unsubscribe\?token=a&amp;source=email"/);

const templates = [
  'confirm-signup.html', 'invite.html', 'magic-link.html', 'recovery.html',
  'email-change.html', 'reauthentication.html', 'password-changed.html',
  'email-changed.html', 'phone-changed.html', 'identity-linked.html',
  'identity-unlinked.html', 'verification-added.html', 'verification-removed.html',
];
const ticket = renderBookingTicketEmailHtml({
  heading: 'Your booking ticket',
  bookingReference: 'AWE-K7Q9M-2PX8C',
  customerName: 'Guest <script>alert(1)</script>',
  customerEmail: 'guest@example.test',
  tourName: 'Red Sea Adventure',
  tourDate: '16 Nov 2026',
  adultCount: 2,
  childCount: 1,
  infantCount: 0,
  pickupLocation: 'Hurghada',
  hotelName: 'Test Hotel',
  roomNumber: '204',
  tourLanguage: 'English',
  bookingStatus: 'pending',
  paymentStatus: 'pending',
  paymentMethod: 'pay at pickup',
  totalAmount: 'EUR 125.00',
  extras: [{ name: 'GoPro', quantity: 1, total: 'EUR 15.00' }],
});
assert.match(ticket, /OFFICIAL BOOKING TICKET/);
assert.match(ticket, /AWE-K7Q9M-2PX8C/);
assert.match(ticket, /Red Sea Adventure/);
assert.match(ticket, /Hurghada/);
assert.match(ticket, /EUR 125\.00/);
assert.match(ticket, /GoPro/);
assert.doesNotMatch(ticket, /<script>alert\(1\)<\/script>/);

for (const template of templates) {
  const path = 'supabase/templates/' + template;
  assert.ok(existsSync(path), 'Auth template exists: ' + template);
  const html = readFileSync(path, 'utf8');
  assert.match(html, /https:\/\/awesomeadventure\.tours\/logo\.png/, 'Auth template uses the final production logo: ' + template);
  assert.doesNotMatch(html, /logo\.jpg/, 'Auth template does not reference the retired logo: ' + template);
}
const config = readFileSync('supabase/config.toml', 'utf8');
assert.match(config, /\[auth\.email\.template\.confirmation\]/);
assert.match(config, /\[auth\.email\.notification\.mfa_factor_unenrolled\]/);

const reviewEmail = renderBrandedEmailHtml({
  heading: 'Thank you for joining us',
  bodyText: [
    'Google: https://share.google/zOClg9BBAjmz6TIR5',
    'Tripadvisor: https://www.tripadvisor.co.uk/Attraction_Review-g297549-d34759384-Reviews-Awesome_Adventure_Tours-Hurghada_Red_Sea_and_Sinai.html',
    'Your tour: https://awesomeadventure.tours/excursions/orange-bay-island-snorkeling',
  ].join('\n\n'),
});
assert.match(reviewEmail, /google\.com\/maps\/search/);
assert.match(reviewEmail, /tripadvisor\.co\.uk\/Attraction_Review/);
assert.match(reviewEmail, /awesomeadventure\.tours\/excursions\/orange-bay-island-snorkeling/);

const reviewWorker = readFileSync('src/server/bookingNotificationWorker.ts', 'utf8');
assert.match(reviewWorker, /event\.event_name === 'booking\.completed'/);
assert.match(reviewWorker, /booking_review_request/);
assert.match(reviewWorker, /awesome-adventure-booking-\$\{eventId\}-review-email/);
assert.match(reviewWorker, /tours\(title,departure_time,slug\)/);

console.log('Branded email renderer, booking ticket HTML and all 13 Supabase Auth templates passed.');
