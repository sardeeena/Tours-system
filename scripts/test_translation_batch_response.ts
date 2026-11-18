import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateTranslationBatchResponse } from '../src/server/translationBatchResponse';

const expected = [
  { entity_type: 'tour', entity_key: 'tour-1' },
  { entity_type: 'blog_post', entity_key: 'post-2' },
];
const first = { ...expected[0], title: 'Translated tour', content: { title: 'Translated tour' } };
const second = { ...expected[1], title: 'Translated post', content: { title: 'Translated post' } };

const valid = validateTranslationBatchResponse(expected, [second, first]);
assert.equal(valid.size, 2);
assert.equal(valid.get('tour:tour-1')?.title, 'Translated tour');
assert.throws(() => validateTranslationBatchResponse(expected, [first]), /omitted translation records/);
assert.throws(() => validateTranslationBatchResponse(expected, [first, first]), /duplicate translation record/);
assert.throws(() => validateTranslationBatchResponse(expected, [first, { ...second, entity_key: 'unexpected' }]), /unexpected translation record/);
assert.throws(() => validateTranslationBatchResponse(expected, [first, null]), /malformed translation record/);
assert.throws(() => validateTranslationBatchResponse(expected, [first, { ...second, entity_type: 42 }]), /without a valid source identity/);
assert.throws(() => validateTranslationBatchResponse([expected[0], expected[0]], [first]), /duplicate expected source identity/);
const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const routeStart = server.indexOf("app.post('/api/admin/translations/generate-batch'");
const validationCall = server.indexOf('validateTranslationBatchResponse(', routeStart);
const preflightStart = server.indexOf('// Validate the entire model response before the first database write.', validationCall);
const firstDraftWrite = server.indexOf(".upsert(record,{onConflict:'entity_type,entity_key,locale'})", routeStart);
assert.ok(routeStart >= 0 && validationCall > routeStart, 'The generation endpoint validates Gemini response identities.');
assert.ok(preflightStart > validationCall && firstDraftWrite > preflightStart,
  'The endpoint validates the complete response before its first draft upsert.');
console.log('Translation batch response integrity tests passed.');
