import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html');
const tracker = read('../src/components/common/VisitorAnalyticsTracker.tsx');
const service = read('../src/services/visitorAnalyticsService.ts');

const denied = html.indexOf("analytics_storage: 'denied'");
const loader = html.indexOf("var containerId = 'GTM-5SSVKB24'");
assert.ok(denied >= 0 && loader > denied, 'Consent Mode defaults are denied before the GTM loader');
assert.match(html, /choices\.version !== '2'/, 'Only the current consent version is accepted');
assert.match(html, /choices\.analytics \? 'granted' : 'denied'/, 'Analytics consent controls analytics storage');
assert.match(html, /choices\.marketing \? 'granted' : 'denied'/, 'Marketing consent controls advertising storage');
assert.match(html, /!choices\.analytics && !choices\.marketing/, 'GTM is not loaded when optional consent is denied');
assert.match(html, /awesome:visitor-consent-saved/, 'GTM responds to consent changes');
assert.match(html, /googletagmanager\.com\/gtm\.js/, 'The configured GTM container is loaded');

assert.match(tracker, /window\.gtag\?\.\('event', 'page_view'/, 'SPA navigation sends a consented GA4 page view');
assert.match(service, /if \(!consent\?\.analytics\) return/, 'No GA4 events are sent without analytics consent');
assert.match(service, /new Set\(\[/, 'Google Analytics event parameters use an explicit allowlist');
assert.match(service, /'booking_reference'/, 'Booking reference can be used as a transaction identifier');
assert.match(service, /window\.gtag\?\.\('event', 'purchase'/, 'Confirmed bookings send the GA4 purchase event');
const bookingPage = read('../src/pages/BookingPage.tsx');
assert.match(bookingPage, /booking_reference: newBooking\.bookingReference/);
assert.match(bookingPage, /currency,/);
const allowlist = service.match(/const allowedKeys = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';
assert.doesNotMatch(allowlist, /email|phone|first_name|last_name/i, 'PII fields are not added to the GA4 allowlist');
assert.match(bookingPage, /booking_reference: newBooking\.bookingReference/);
assert.match(bookingPage, /value: pricing\.totalEur/);
assert.match(bookingPage, /currency: currency\.code/);

console.log('Consent-gated GTM, SPA page views, safe GA4 events and booking purchase tracking checks passed.');
