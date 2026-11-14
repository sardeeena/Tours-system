import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const routeStart = serverSource.indexOf("app.get('/api/tours'");
const routeEnd = serverSource.indexOf('// 5. Booking Creation', routeStart);

assert.notEqual(routeStart, -1, 'public tours endpoint exists');
assert.notEqual(routeEnd, -1, 'public tours endpoint has a clear boundary');

const route = serverSource.slice(routeStart, routeEnd);

assert.match(route, /if\s*\(!publicSupabase\)/, 'catalogue checks the public Supabase client');
assert.match(route, /return res\.status\(503\)\.json/, 'missing public client returns a controlled service-unavailable response');
assert.match(route, /publicSupabase\s*\.from\('tours'\)/, 'catalogue reads through the public Supabase client');
assert.doesNotMatch(route, /serverSupabase/, 'catalogue never uses the privileged server client');
assert.match(route, /\.eq\('status',\s*'published'\)/, 'only published tours are requested');
assert.match(route, /if\s*\(error\)[\s\S]*?res\.status\(503\)/, 'database query errors return a controlled service-unavailable response');
assert.match(route, /tours:\s*\[\],[\s\S]*?count:\s*0[\s\S]*?total:\s*0/, 'unavailable responses contain an empty catalogue and zero counts');
assert.doesNotMatch(route, /TOUR_CATALOG_SUMMARY|images\.unsplash\.com|reviewCount:\s*45|rating:\s*4\.8/, 'catalogue never returns static sample tours, sample imagery, or invented ratings');
assert.doesNotMatch(route, /cancellation_policy|pickup_info|minimum_booking_notice_hours|max_guests/, 'catalogue query does not select unrelated operational fields');

console.log('Public catalogue fail-closed source checks passed.');
