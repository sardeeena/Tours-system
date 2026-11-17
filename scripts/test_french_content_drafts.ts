import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRIVATE_UI_SOURCE_CATALOG } from '../src/i18n/privateUiCatalog.generated';
import { TRANSLATIONS } from '../src/i18n/translations';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const bundle = read('../translations/fr/all-content.review-draft.json');
const privateDraft = read('../translations/fr/private-ui-messages.review-draft.json');
const records = bundle.records as any[];
const count = (type: string) => records.filter((record) => record.entity_type === type).length;

assert.equal(bundle.locale, 'fr');
assert.equal(count('tour'), 25, 'All 25 published tours have French drafts');
assert.equal(count('blog_post'), 50, 'All 50 published blog posts have French drafts');
assert.equal(count('destination'), 7, 'All 7 published destinations have French drafts');
assert.equal(count('communication_template'), 18, 'All 18 English communication templates in the rollout source have French drafts');
assert.equal(count('static_page'), 10, 'The French homepage and all nine fallback public pages have French drafts');
assert.equal(count('ui_catalog'), 1, 'The French UI catalogue draft is present');

const expectedPrivateKeys = Object.keys(PRIVATE_UI_SOURCE_CATALOG);
const translatedPrivateKeys = Object.keys(privateDraft.content || {});
const missingPrivate = expectedPrivateKeys.filter((key) => !privateDraft.content?.[key]);
const extraPrivate = translatedPrivateKeys.filter((key) => !(key in PRIVATE_UI_SOURCE_CATALOG));
assert.deepEqual(missingPrivate, [], 'Every extracted private customer UI message has a French translation');
assert.deepEqual(extraPrivate, [], 'The private French catalogue contains no unknown source keys');
assert.equal(translatedPrivateKeys.length, expectedPrivateKeys.length);
assert.equal(privateDraft.coverage, translatedPrivateKeys.length);

const ui = records.find((record) => record.entity_type === 'ui_catalog');
for (const key of Object.keys(TRANSLATIONS.en)) assert.ok(ui.content[key], 'Public UI key translated: ' + key);
for (const key of expectedPrivateKeys) assert.ok(ui.content[key], 'Private UI key translated: ' + key);
assert.equal(Object.keys(ui.content).length, Object.keys(TRANSLATIONS.en).length + expectedPrivateKeys.length);

const tourRequired = ['title','description','durationLabel','highlights','itinerary','included','excluded','faqs','pickupInfo','cancellationPolicy','ageRestrictions','labels'];
for (const record of records.filter((x) => x.entity_type === 'tour')) {
  for (const key of tourRequired) assert.ok(key in record.content, record.entity_key + ' includes ' + key);
  assert.ok(Array.isArray(record.content.highlights));
  assert.ok(Array.isArray(record.content.itinerary));
  assert.ok(Array.isArray(record.content.included));
  assert.ok(Array.isArray(record.content.excluded));
  assert.ok(Array.isArray(record.content.faqs));
}
for (const record of records.filter((x) => x.entity_type === 'blog_post')) {
  for (const key of ['title','excerpt','content']) assert.ok(typeof record.content[key] === 'string' && record.content[key].trim(), record.entity_key + ' includes ' + key);
}
for (const record of records.filter((x) => x.entity_type === 'destination')) {
  for (const key of ['title','description','tagline','paragraphs','labels']) assert.ok(key in record.content, record.entity_key + ' includes ' + key);
}
for (const record of records.filter((x) => x.entity_type === 'communication_template')) {
  assert.ok(Array.isArray(record.content.variables));
  for (const variable of record.content.variables) {
    const token = '{{' + variable + '}}';
    assert.ok((record.content.subject + ' ' + record.content.body_text).includes(token), record.entity_key + ' preserves ' + token);
  }
}
const slugs = records.map((x) => x.translated_slug).filter(Boolean);
assert.equal(new Set(slugs).size, slugs.length, 'French translated slugs are unique');
for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'French slug is normalized: ' + slug);

const protectedTokens = (value: string) => {
  const matches = value.match(/https?:\/\/[^\s)]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d\s()./-]{4,}\d|\d+(?:[.,]\d+)?/g) || [];
  return matches.map((token) => token.replace(/\s+/g, ' ').trim()).sort();
};
for (const [key, source] of Object.entries(PRIVATE_UI_SOURCE_CATALOG)) {
  const translated = privateDraft.content[key];
  const sourceTokens = protectedTokens(source);
  const translatedTokens = protectedTokens(translated);
  assert.deepEqual(translatedTokens, sourceTokens, 'Private UI translation preserves numbers, URLs, email addresses and phone numbers: ' + key);
}

console.log('French draft coverage passed: 25 tours, 50 articles, 7 destinations, 15 communication templates, homepage, public UI and ' + expectedPrivateKeys.length + ' private UI messages.');
