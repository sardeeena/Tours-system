import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRIVATE_UI_SOURCE_CATALOG } from '../src/i18n/privateUiCatalog.generated';
import { TRANSLATIONS } from '../src/i18n/translations';
import { INITIAL_STATIC_PAGES } from '../src/data/staticPages';

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
assert.equal(bundle.coverage?.tour, count('tour'));
assert.equal(bundle.coverage?.blog_post, count('blog_post'));
assert.equal(bundle.coverage?.destination, count('destination'));
assert.equal(bundle.coverage?.communication_template, count('communication_template'));
assert.equal(bundle.coverage?.static_page, count('static_page'));
assert.equal(bundle.coverage?.private_ui_messages, expectedPrivateKeys.length);
assert.equal(bundle.coverage?.source_records, records.length);

const ui = records.find((record) => record.entity_type === 'ui_catalog');
assert.equal(bundle.coverage?.ui_catalog_messages, Object.keys(ui.content).length);
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
  const declared = new Set(record.content.variables);
  const placeholders = ((record.content.subject || '') + ' ' + (record.content.body_text || '')).match(/\{\{([^{}]+)\}\}/g) || [];
  for (const token of placeholders) {
    const variable = token.slice(2, -2);
    assert.ok(declared.has(variable), record.entity_key + ' declares placeholder ' + token);
  }
}
const slugs = records.map((x) => x.translated_slug).filter(Boolean);
assert.equal(new Set(slugs).size, slugs.length, 'French translated slugs are unique');
for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'French slug is normalized: ' + slug);

const protectedTokens = (value: string) => {
  const matches = value.match(/https?:\/\/[^\s)]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+\d[\d\s()./-]{5,}\d|\d+(?:[.,]\d+)?/g) || [];
  return matches.map((token) => token.replace(/\s+/g, ' ').trim()).sort();
};
const privateTokenFailures: Array<{ key: string; source: string; translated: string; sourceTokens: string[]; translatedTokens: string[] }> = [];
for (const [key, source] of Object.entries(PRIVATE_UI_SOURCE_CATALOG)) {
  const translated = privateDraft.content[key];
  const sourceTokens = protectedTokens(source);
  const translatedTokens = protectedTokens(translated);
  if (JSON.stringify(translatedTokens) !== JSON.stringify(sourceTokens)) {
    privateTokenFailures.push({ key, source, translated, sourceTokens, translatedTokens });
  }
}
assert.deepEqual(privateTokenFailures, [], 'Private UI translations must preserve all source numbers, URLs, email addresses and phone numbers: ' + JSON.stringify(privateTokenFailures));


const structureMatches = (source: any, translated: any): boolean => {
  if (typeof source === 'string') {
    if (typeof translated !== 'string') return false;
    if (!source.trim()) return !translated.trim();
    const protectedTokens = source.match(/\{\{[^{}]+\}\}|https?:\/\/[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{4,}\d|\b\d+(?:[.,]\d+)?\b/g) || [];
    return Boolean(translated.trim()) && protectedTokens.every((token) => translated.includes(token));
  }
  if (Array.isArray(source)) return Array.isArray(translated) && source.length === translated.length
    && source.every((value, index) => structureMatches(value, translated[index]));
  if (source && typeof source === 'object') {
    if (!translated || typeof translated !== 'object' || Array.isArray(translated)) return false;
    const sourceKeys = Object.keys(source).sort(), translatedKeys = Object.keys(translated).sort();
    return sourceKeys.length === translatedKeys.length
      && sourceKeys.every((key, index) => key === translatedKeys[index] && structureMatches(source[key], translated[key]));
  }
  return source === translated;
};

for (const [key, source] of Object.entries(TRANSLATIONS.en)) {
  assert.ok(ui.content[key], 'Public UI key translated: ' + key);
  assert.ok(structureMatches(source, ui.content[key]), 'Public UI translation preserves source placeholders, links and numbers: ' + key);
}
for (const record of records.filter((x) => ['tour','blog_post','destination'].includes(x.entity_type))) {
  assert.ok(record.seo_title?.trim(), record.entity_type + ' SEO title is translated: ' + record.entity_key);
  assert.ok(record.seo_description?.trim(), record.entity_type + ' SEO description is translated: ' + record.entity_key);
}

const staticRecords = records.filter((record) => record.entity_type === 'static_page');
const homeSource = {
  title:'Explore Egypt’s Red Sea Coast',
  heroHeadline:'Explore Egypt’s Red Sea Coast',
  heroSubtitle:'Boat trips, island visits, snorkeling, diving and desert safaris across Egypt’s Red Sea coast.',
  sections:[], paragraphs:[],
};
const staticSources = [homeSource, ...INITIAL_STATIC_PAGES];
for (const source of staticSources) {
  const pageSource = source as any;
  const key = pageSource.id || pageSource.slug || 'home';
  const draft = staticRecords.find((record) => record.entity_key === key);
  assert.ok(draft, 'Static page translated: ' + key);
  assert.ok(draft.seo_title?.trim(), 'Static page SEO title is translated: ' + key);
  assert.ok(draft.seo_description?.trim(), 'Static page SEO description is translated: ' + key);
  const expected = {
    title:pageSource.title || pageSource.name || 'Explore the Red Sea',
    summary:pageSource.heroSubtitle || pageSource.description || pageSource.excerpt || '',
    content:{
      heroHeadline:pageSource.heroHeadline || pageSource.title || '',
      heroSubtitle:pageSource.heroSubtitle || pageSource.description || '',
      sections:pageSource.sections || [], paragraphs:[],
      labels:{browseMore:'Explore more',bookNow:'Book now'},
    },
  };
  assert.ok(structureMatches(expected, {title:draft.title,summary:draft.summary,content:draft.content}),
    'Static page preserves all source sections, keys, placeholders, links and numeric facts: ' + key);
}
assert.equal(staticSources.length, 10, 'Home plus all nine fallback static pages are covered');
assert.equal(records.length, 111, 'The full French review bundle contains every known source candidate');
assert.equal(bundle.source_data_warnings?.length, 2, 'Known source-data issues remain visible and block publication review');

console.log('French draft coverage passed: 25 tours, 50 articles, 7 destinations, 18 communication templates, homepage, public UI and ' + expectedPrivateKeys.length + ' private UI messages.');
