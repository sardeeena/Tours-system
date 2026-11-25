import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html');
const tracker = read('../src/components/common/VisitorAnalyticsTracker.tsx');
const cookieConsent = read('../src/components/common/CookieConsent.tsx');
const service = read('../src/services/visitorAnalyticsService.ts');
const bookingPage = read('../src/pages/BookingPage.tsx');

const denied = html.indexOf("analytics_storage: 'denied'");
const loader = html.indexOf("var containerId = 'GTM-5SSVKB24'");
assert.ok(denied >= 0 && loader > denied, 'Consent Mode defaults are denied before the GTM loader');
assert.match(html, /choices\.version !== '2'/, 'Only the current consent version is accepted');
assert.match(html, /choices\.analytics \? 'granted' : 'denied'/, 'Analytics consent controls analytics storage');
assert.match(html, /choices\.marketing \? 'granted' : 'denied'/, 'Marketing consent controls advertising storage');
assert.match(html, /!choices\.analytics && !choices\.marketing/, 'GTM is not loaded when optional consent is denied');
assert.match(html, /awesome:visitor-consent-saved/, 'GTM responds to consent changes');
assert.match(html, /googletagmanager\.com\/gtm\.js/, 'The configured GTM container is loaded');

assert.match(tracker, /window\.gtag\?\.\('event', 'page_view'/, 'Initial and SPA routes send consented GA4 page views');
assert.match(service, /if \(!consent\?\.analytics\) return/, 'No GA4 events are sent without analytics consent');
assert.match(service, /const allowedKeys = new Set\(\[/, 'Google Analytics event parameters use an explicit allowlist');
assert.match(service, /window\.gtag\?\.\('event', input\.event_name/, 'Booking events are forwarded with their accurate event names');
assert.doesNotMatch(service, /gtag\?\.\('event', 'purchase'/, 'Pending reservations are not mislabeled as completed purchases');
assert.match(bookingPage, /event_name: 'booking_submitted'/, 'A successful reservation is tracked as one booking submission');
assert.doesNotMatch(bookingPage, /event_name: 'booking_confirmed'/, 'A payment-pending reservation is not mislabeled as confirmed');
assert.match(bookingPage, /booking_reference: newBooking\.bookingReference/, 'The authoritative booking reference is included');
assert.match(bookingPage, /booking_value: pricing\.totalEur/, 'Booking value is included as a custom parameter');
assert.match(bookingPage, /currency: currency\.code/, 'The selected currency is included');

const allowlist = service.match(/const allowedKeys = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';
assert.doesNotMatch(allowlist, /email|phone|first_name|last_name/i, 'PII fields are not added to the GA4 allowlist');

assert.match(html, /var measurementId = 'G-XGYXLWF4FG'/, 'The verified GA4 web stream is configured');
assert.match(html, /choices\.analytics && !gaLoaded/, 'Direct GA4 only loads after analytics consent');
assert.match(html, /send_page_view: false/, 'Automatic page views are disabled to prevent duplicates');
assert.match(html, /aat-ga4-script/, 'Direct GA4 loader has a duplicate-load guard');
assert.match(html, /document\.getElementById\('aat-gtm-script'\)/, 'The early and React consent loaders cannot inject GTM twice');
assert.match(cookieConsent, /GA4_MEASUREMENT_ID = 'G-XGYXLWF4FG'/, 'Consent changes load the same GA4 property');
assert.match(cookieConsent, /choices\.analytics && !document\.getElementById\('aat-ga4-script'\)/, 'GA4 loads when consent is granted after initial render');
assert.match(service, /input\.event_name === 'booking_submitted'/, 'The submitted-booking event carries the booking value');
assert.match(service, /gaEventData\.value = safeEventData\.booking_value/, 'Booking conversion value uses the GA4 value parameter');
console.log('Consent-gated GTM, SPA page views, non-PII events and booking conversion checks passed.');
