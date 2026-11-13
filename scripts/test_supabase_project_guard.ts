import assert from 'node:assert/strict';
import {
  EXPECTED_AWESOME_ADVENTURE_TOURS_SUPABASE_PROJECT_REF,
  isExpectedAwesomeAdventureToursSupabaseUrl,
} from '../src/lib/supabaseProjectGuard';

const awesomeAdventureToursUrl = `https://${EXPECTED_AWESOME_ADVENTURE_TOURS_SUPABASE_PROJECT_REF}.supabase.co`;
const legacyProjectUrl = 'https://cyifhjqqvtiguitrziqs.supabase.co';

assert.equal(isExpectedAwesomeAdventureToursSupabaseUrl(awesomeAdventureToursUrl), true, 'production accepts the Awesome Adventure Tours project');
assert.equal(isExpectedAwesomeAdventureToursSupabaseUrl(legacyProjectUrl), false, 'production rejects the unrelated legacy project');
assert.equal(isExpectedAwesomeAdventureToursSupabaseUrl('https://mktrtoctcjyokclpdeui.supabase.co'), false, 'production rejects the separate legacy project');
assert.equal(isExpectedAwesomeAdventureToursSupabaseUrl('http://mktrtoctcjyokclpdeui.supabase.co'), false, 'production requires HTTPS');
assert.equal(isExpectedAwesomeAdventureToursSupabaseUrl('https://another-project.supabase.co'), false, 'production rejects other Supabase projects');
assert.equal(isExpectedAwesomeAdventureToursSupabaseUrl(awesomeAdventureToursUrl, true), true, 'development accepts the Awesome Adventure Tours project');
assert.equal(isExpectedAwesomeAdventureToursSupabaseUrl(legacyProjectUrl, true), true, 'development may use a separate hosted test project');
assert.equal(isExpectedAwesomeAdventureToursSupabaseUrl('http://127.0.0.1:54321', true), true, 'development accepts local Supabase');
assert.equal(isExpectedAwesomeAdventureToursSupabaseUrl('not-a-url', true), false, 'invalid URLs are rejected');

console.log('Supabase project guard checks passed.');
