import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const configPath = path.join(root, 'supabase', 'config.toml');
const expectedProjectRef = 'uvtbtpxtrrmaublrztgv';

assert.ok(fs.existsSync(migrationsDir), 'supabase/migrations directory exists');
assert.ok(fs.existsSync(configPath), 'supabase/config.toml exists');

const config = fs.readFileSync(configPath, 'utf8');
const projectRef = config.match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];
assert.equal(projectRef, expectedProjectRef, 'migration config targets the Awesome Adventure Tours Supabase project');

const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
const unexpectedEntries = entries.filter((entry) => !entry.isFile() || !entry.name.endsWith('.sql'));
assert.deepEqual(
  unexpectedEntries.map((entry) => entry.name),
  [],
  'migration directory contains only SQL migration files'
);

const filenames = entries.map((entry) => entry.name).sort();
assert.ok(filenames.length > 0, 'at least one migration exists');

const versions = new Set<string>();
let previousVersion = '';

for (const filename of filenames) {
  const match = filename.match(/^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/);
  assert.ok(match, `migration filename follows YYYYMMDDHHMMSS_snake_case.sql: ${filename}`);

  const [, version, name] = match;
  assert.ok(!versions.has(version), `migration version is unique: ${version}`);
  versions.add(version);

  assert.ok(version > previousVersion, `migration timestamps are strictly increasing: ${filename}`);
  previousVersion = version;

  const year = Number(version.slice(0, 4));
  const month = Number(version.slice(4, 6));
  const day = Number(version.slice(6, 8));
  const hour = Number(version.slice(8, 10));
  const minute = Number(version.slice(10, 12));
  const second = Number(version.slice(12, 14));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  assert.equal(date.getUTCFullYear(), year, `valid year in ${filename}`);
  assert.equal(date.getUTCMonth() + 1, month, `valid month in ${filename}`);
  assert.equal(date.getUTCDate(), day, `valid day in ${filename}`);
  assert.equal(date.getUTCHours(), hour, `valid hour in ${filename}`);
  assert.equal(date.getUTCMinutes(), minute, `valid minute in ${filename}`);
  assert.equal(date.getUTCSeconds(), second, `valid second in ${filename}`);

  const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
  assert.ok(sql.trim().length > 0, `migration is not empty: ${filename}`);
  assert.ok(name.length > 0, `migration has a descriptive name: ${filename}`);
}

console.log(`Migration history guard passed: ${filenames.length} ordered, uniquely versioned SQL migrations target ${expectedProjectRef}.`);
