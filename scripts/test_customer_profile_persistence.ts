import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/services/authService.ts', import.meta.url), 'utf8');
const start = source.indexOf('export async function updateUserProfile(');
const end = source.indexOf('\n}\n\n/**\n * Validates password strength', start);
assert.ok(start >= 0 && end > start, 'updateUserProfile implementation must exist');
const implementation = source.slice(start, end);

assert.match(
  implementation,
  /\.from\(['"]profiles['"]\)[\s\S]*?\.update\(profileUpdates\)[\s\S]*?\.eq\(['"]id['"],\s*userId\)[\s\S]*?\.select\(['"]id,/,
  'Profile updates must persist to the signed-in user profile and confirm the updated row.',
);
assert.match(
  implementation,
  /if \(dbError\)\s*\{\s*return \{ success: false/,
  'A database profile update error must be returned to the caller.',
);
assert.match(
  implementation,
  /if \(!savedProfile\)\s*\{\s*return \{ success: false/,
  'A missing profile row must not be reported as a successful update.',
);
assert.match(
  implementation,
  /if \(authError\)[\s\S]*?Profile was saved, but Auth metadata could not be synchronized/,
  'Auth metadata is a best-effort mirror after the authoritative profile save.',
);
assert.match(
  implementation,
  /return \{ success: false, error: ['"]No active account was found/,
  'Missing local sessions must not be reported as successful profile updates.',
);

console.log('Customer profile persistence reports success only after the authoritative profile row is saved.');
