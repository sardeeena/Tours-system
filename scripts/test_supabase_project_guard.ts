import assert from 'node:assert/strict';
import {
  EXPECTED_KEMET_SUPABASE_PROJECT_REF,
  isExpectedKemetSupabaseUrl,
} from '../src/lib/supabaseProjectGuard';

const kemetUrl = `https://${EXPECTED_KEMET_SUPABASE_PROJECT_REF}.supabase.co`;
const legacyProjectUrl = 'https://cyifhjqqvtiguitrziqs.supabase.co';

assert.equal(isExpectedKemetSupabaseUrl(kemetUrl), true, 'production accepts the Kemet Spirit project');
assert.equal(isExpectedKemetSupabaseUrl(legacyProjectUrl), false, 'production rejects the unrelated legacy project');
assert.equal(isExpectedKemetSupabaseUrl('http://mktrtoctcjyokclpdeui.supabase.co'), false, 'production requires HTTPS');
assert.equal(isExpectedKemetSupabaseUrl('https://another-project.supabase.co'), false, 'production rejects other Supabase projects');
assert.equal(isExpectedKemetSupabaseUrl(kemetUrl, true), true, 'development accepts the Kemet project');
assert.equal(isExpectedKemetSupabaseUrl(legacyProjectUrl, true), true, 'development may use a separate hosted test project');
assert.equal(isExpectedKemetSupabaseUrl('http://127.0.0.1:54321', true), true, 'development accepts local Supabase');
assert.equal(isExpectedKemetSupabaseUrl('not-a-url', true), false, 'invalid URLs are rejected');

console.log('Supabase project guard checks passed.');
