import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../supabase/migrations/20261125140000_supplier_managed_departure_notifications.sql');
const communication = read('../src/services/communicationService.ts');
const html = read('../index.html');
const hero = read('../src/components/home/Hero.tsx');
const exclusivePage = read('../src/pages/ExclusiveTripsPage.tsx');

assert.match(migration, /resource_management_mode TEXT/);
assert.match(migration, /SET resource_management_mode = 'supplier'/);
assert.match(migration, /DEFAULT 'supplier'/);
assert.match(migration, /CHECK \(resource_management_mode IN \('supplier','internal'\)\)/);
assert.match(migration, /resource_management_mode = ''internal''/);
assert.match(migration, /idx_departures_internal_unassigned_date/);
assert.match(migration, /archived_at TIMESTAMPTZ/);
assert.match(migration, /idx_staff_notifications_active_created_at_id/);
assert.match(migration, /dedup_key = 'archived:' \|\| dedup_key/);
assert.match(migration, /archived_at = COALESCE\(archived_at, now\(\)\)/);
assert.match(migration, /is_read = TRUE/);
assert.match(migration, /v_count <> 1/);

const start = communication.indexOf('export async function listStaffNotifications');
const end = communication.indexOf('export async function markNotificationRead', start);
assert.ok(start >= 0 && end > start, 'notification list function exists');
const list = communication.slice(start, end);
assert.doesNotMatch(list, /checkAndGenerateStaffNotifications\(/, 'opening the inbox does not run the scanner');
assert.match(list, /\.is\('archived_at', null\)/, 'archived false-positive records are hidden without deletion');
assert.match(list, /\.order\('created_at',[\s\S]*?\.order\('id'/);
assert.match(communication, /export async function checkAndGenerateStaffNotifications/, 'manual/background scanner remains available');

const firstHeroImage = hero.match(/imageUrl: '([^']+)'/)?.[1];
assert.ok(firstHeroImage, 'hero has a first slide image');
assert.ok(html.includes('rel="preload" as="image" href="' + firstHeroImage + '" fetchpriority="high"'), 'HTML preloads the actual first hero image');
assert.doesNotMatch(html, /rel="preload" as="image" href="https:\/\/images\.unsplash\.com/, 'unrelated Unsplash image is not preloaded');

assert.match(exclusivePage, /available dates, departure times and guest limits/);
assert.match(exclusivePage, /total price for the whole trip/);
assert.match(exclusivePage, /contact our team/);
assert.match(exclusivePage, /Plan a private boat trip on Egypt’s Red Sea/);
assert.match(exclusivePage, /Meals, drinks, hotel transfers, snorkeling equipment/);
assert.match(exclusivePage, /Dates, routes and sea conditions/);
const robots = read('../public/robots.txt');
assert.match(robots, /User-agent: OpenSEO-Audit\s+Crawl-delay: 2/);

console.log('Supplier-managed departure, archived notification, hero preload and exclusive SEO checks passed.');
