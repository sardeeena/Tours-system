import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const pkg = readJson('../package.json');
const workflow = readText('../.github/workflows/ci.yml');
const server = readText('../server.ts');
const migration = readText('../supabase/migrations/20261117212644_correct_inconsistent_tour_itinerary_and_faq.sql');
const migrationRetry = readText('../supabase/migrations/20261117212701_correct_inconsistent_tour_itinerary_and_faq.sql');
const migrationRelease = readText('../supabase/migrations/20261117213711_correct_inconsistent_tour_itinerary_and_faq.sql');
const quadFaqCleanup = readText('../supabase/migrations/20261117213225_remove_unrelated_snorkeling_faqs_from_quad_tour.sql');
const quadFaqCleanupRetry = readText('../supabase/migrations/20261117213227_remove_unrelated_snorkeling_faqs_from_quad_tour.sql');
const nonMarineFaqCleanup = readText('../supabase/migrations/20261117213351_remove_unrelated_snorkeling_faqs_from_non_marine_tours.sql');

for (const name of ['vite', '@vitejs/plugin-react', '@tailwindcss/vite']) {
  assert.ok(pkg.devDependencies?.[name], name + ' must remain a development/build dependency');
  assert.equal(pkg.dependencies?.[name], undefined, name + ' must not be installed in the production runtime dependency tree');
}
assert.doesNotMatch(server, /from ['"]vite['"]|from ['"]@vitejs\/plugin-react['"]|from ['"]@tailwindcss\/vite['"]/,
  'The production Express server must not import the Vite build toolchain');
assert.match(workflow, /npm audit --omit=dev --audit-level=low/,
  'CI must audit the actual production runtime dependency graph');
assert.match(workflow, /test:source-content-corrections/,
  'CI must execute the source correction and build-toolchain isolation test');

assert.equal(migrationRetry, migration, 'Both already-recorded migration versions are represented consistently');
assert.equal(migrationRelease, migration, 'A new forward-only migration reapplies the correction because the earlier versions are already recorded in production');
assert.match(migration, /el-gouna-desert-quad-safari-bedouin-village-camel-ride/);
assert.match(migration, /sharm-el-sheikh-ras-mohammed-magic-lake-snorkeling-adventure/);
assert.doesNotMatch(migration, /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  'Data correction migration must resolve records by stable slugs, not generated UUIDs');
assert.match(migration, /known_old_rows = 7/);
assert.match(migration, /refusing to overwrite unreviewed content/);
assert.match(migration, /Guided desert quad ride/);
assert.match(migration, /Bedouin village and camel ride/);
assert.match(migration, /Return transfer to El Gouna/);
assert.match(migration, /corrected_faq_answer text := 'A: The itinerary includes a snorkeling stop at Coral Gardens\./);
assert.match(migration, /refusing to overwrite it/);
const itineraryInsert = migration.split('INSERT INTO public.tour_itinerary')[1]?.split('END IF;')[0] || '';
assert.ok(itineraryInsert, 'The corrected quad itinerary insert is present');
assert.doesNotMatch(itineraryInsert, /sailing|snorkeling|onboard lunch|island beach|marina/i,
  'The corrected quad itinerary must not retain the unrelated boat excursion');


assert.equal(quadFaqCleanupRetry, quadFaqCleanup, 'Both already-recorded FAQ cleanup migration versions are represented consistently');
assert.match(quadFaqCleanup, /el-gouna-desert-quad-safari-bedouin-village-camel-ride/);
assert.match(quadFaqCleanup, /Is snorkeling equipment provided or should I bring my own\?/);
assert.match(quadFaqCleanup, /Can non-swimmers participate safely\?/);
assert.match(quadFaqCleanup, /refusing to delete changed FAQ content/);
assert.match(quadFaqCleanup, /DELETE FROM public\.tour_faqs/);
assert.match(nonMarineFaqCleanup, /hurghada-desert-quad-safari-atv-adventure-camel-ride-bedouin-village/);
assert.match(nonMarineFaqCleanup, /st-catherine-monastery-dahab-day-trip-from-sharm-el-sheikh/);
assert.match(nonMarineFaqCleanup, /refusing to delete changed FAQ content/);
assert.match(nonMarineFaqCleanup, /DELETE FROM public\.tour_faqs/);


const tourChunkFiles = ['tours-01-02','tours-03-04','tours-05-06','tours-07-08','tours-09-10','tours-11-12','tours-13-14','tours-15-16','tours-17-18','tours-19-20','tours-21-22','tours-23-25'];
const allTourChunkRecords = tourChunkFiles.flatMap((file: string) => readJson('../translations/fr/' + file + '.review-draft.json').records || []);
for (const record of allTourChunkRecords) {
  assert.deepEqual(record.source_content_warnings || [], [], 'Split French tour draft has no unresolved source warning: ' + record.source_slug);
}
console.log('Source corrections and production dependency isolation checks passed.');
