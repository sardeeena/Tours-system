import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const pkg = read('../package.json');
const workflow = read('../.github/workflows/ci.yml');
const server = read('../server.ts');
const migration = read('../supabase/migrations/20261117212644_correct_inconsistent_tour_itinerary_and_faq.sql');
const migrationRetry = read('../supabase/migrations/20261117212701_correct_inconsistent_tour_itinerary_and_faq.sql');

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

assert.equal(migrationRetry, migration, 'Both already-recorded Supabase migration versions are represented and the correction is idempotent');
assert.match(migration, /18375e31-b866-4f07-b3a8-c13b2a5c243b/);
assert.match(migration, /2f7cbd8c-bda2-4915-b5e4-5fc98927a388/);
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

console.log('Source corrections and production dependency isolation checks passed.');
