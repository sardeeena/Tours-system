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
assert.equal(count('tour'), 26, 'All 26 published tours have French drafts');
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
assert.equal(records.length, 112, 'The full French review bundle contains every known source candidate');
assert.deepEqual(bundle.source_data_warnings || [], [], 'The two previously flagged source-data issues have approved, source-backed corrections in the PR migration');
const correctedQuad = records.find((record) => record.entity_type === 'tour' && record.entity_key === '18375e31-b866-4f07-b3a8-c13b2a5c243b');
assert.equal(correctedQuad.content.itinerary.length, 5, 'El Gouna quad safari has five corrected itinerary steps');
assert.equal(correctedQuad.content.faqs.length, 0, 'Unrelated boat/snorkeling FAQs are removed from the desert quad safari');
const desertSafari = records.find((record) => record.entity_type === 'tour' && record.entity_key === 'b3524f6e-ef5a-4585-ae5a-d6569e3a1468');
assert.equal(desertSafari.content.faqs.length, 15, 'Desert safari preserves all source FAQ and information rows');
const horseRiding = records.find((record) => record.entity_type === 'tour' && record.entity_key === 'c343a962-c9b3-4789-8a2d-a260e1d4c2ce');
assert.equal(horseRiding.content.faqs.length, 28, 'Horse riding preserves all source FAQ and information rows');
const toursWithoutSourceFaqs = ["17e6cedc-b281-4528-a42b-35faee49ac57","5a15257b-d664-4957-be77-c2cb87bd174a","cda285d8-1119-4118-bb73-3a3c433f8daf","b2303c4d-0803-4526-9246-31a19b8901c3","87f5ab47-2499-4511-9a68-39a279e5bb85","a66d28fb-505c-4cf6-b326-c47bbabe2624","8737c07b-794e-4189-a7d3-401fd9c8c02b","e2019bda-5664-4dd3-ac21-a38c2fd95c9f","0bf0a28b-b49e-4c3e-a076-6d5eb53e8c7d","fb31d1b8-e3ed-4596-afd3-3adc5241111c","cc09c496-09f9-4036-aa69-fe5f20208a3d","86f2d93f-33bf-420a-88a5-4c6035ae05ba","66490ba5-3887-4dca-985d-d5f85b7c01e4","56fdd9fc-3a63-4faf-89b4-ac9e7332b86d","2f2ca1a1-f0c7-4737-9700-57e801a08d99"];
for (const key of toursWithoutSourceFaqs) {
  const tour = records.find((record) => record.entity_type === 'tour' && record.entity_key === key);
  assert.ok(tour, 'Non-marine tour is included in the French source bundle: ' + key);
  assert.deepEqual(tour.content.faqs, [], 'French draft must not invent FAQ entries absent from the English source: ' + key);
}

const nonMarineTourSlugs = ["afternoon-desert-safari-with-echo-mountains-bedouin-village","cairo-pyramids-sphinx-egyptian-museum-day-trip-from-sharm-el-sheikh","el-gouna-jeep-desert-safari-bbq-dinner-stargazing-experience","from-hurghada-luxor-day-trip-karnak-temple-valley-of-the-kings","grand-egyptian-museum-guided-tour-with-entry-ticket","hurghada-airport-to-hotel-private-arrival-transfer","hurghada-desert-quad-safari-atv-adventure-camel-ride-bedouin-village","hurghada-desert-stargazing-safari-jeep-adventure-bedouin-dinner-telescope-experience","hurghada-parasailing-banana-boat-adventure-with-hotel-pickup","hurghada-quad-bike-safari-desert-ride-camel-experience-bedouin-village","mount-sinai-sunrise-hike-st-catherines-monastery-from-sharm-el-sheikh","old-cairo-full-day-tour-islamic-coptic-heritage-with-lunch","sharm-el-sheikh-private-city-tour-old-market-mosque-cathedral","st-catherine-monastery-dahab-day-trip-from-sharm-el-sheikh","ultimate-sinai-desert-safari-quad-camel-bbq-adventure","ultimate-sinai-desert-safari-quad-camel-bbq-adventure-copy-757"];
for (const slug of nonMarineTourSlugs) {
  const tour = records.find((record) => record.entity_type === 'tour' && record.source_slug === slug);
  assert.ok(tour, 'Non-marine source tour is present: ' + slug);
  assert.equal(tour.content.faqs.length, 0, 'Unrelated snorkeling FAQs are removed from non-marine tour: ' + slug);
}
assert.match(JSON.stringify(correctedQuad.content.itinerary), /quad|quadri|bédouin|chameau/i);
assert.doesNotMatch(JSON.stringify(correctedQuad.content.itinerary), /marina|snorkeling|bateau|navigation|île|island|à bord/i, 'Quad itinerary no longer contains boat-trip content');
const rasMohammed = records.find((record) => record.entity_type === 'tour' && record.entity_key === '2f7cbd8c-bda2-4915-b5e4-5fc98927a388');
assert.match(rasMohammed.content.faqs.find((faq: any) => /snorkeling est-il inclus/i.test(faq.question))?.answer || '', /Coral Gardens/);
assert.match(rasMohammed.content.faqs.find((faq: any) => /snorkeling est-il inclus/i.test(faq.question))?.answer || '', /option de réservation/);

console.log('French draft coverage passed: 26 tours, 50 articles, 7 destinations, 18 communication templates, homepage, public UI and ' + expectedPrivateKeys.length + ' private UI messages.');
