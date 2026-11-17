import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../src/i18n/translations';
import { EUROPEAN_LOCALE_ROLLOUT, SUPPORTED_LANGUAGES } from '../src/types/i18n';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const nl = read('../translations/nl/all-content.review-draft.json');
const reference = read('../translations/fr/all-content.review-draft.json');
const privateReference = read('../translations/fr/private-ui-messages.review-draft.json');
const publicDraft = read('../translations/nl/ui-catalog-public.review-draft.json');
const records = nl.records as any[];
const refRecords = reference.records as any[];
const key = (record: any) => record.entity_type + ':' + record.entity_key;
const counts = (type: string) => records.filter((record) => record.entity_type === type).length;

assert.equal(nl.locale, 'nl');
assert.equal(nl.source_project, 'uvtbtpxtrrmaublrztgv');
assert.equal(counts('tour'), 25);
assert.equal(counts('blog_post'), 50);
assert.equal(counts('destination'), 7);
assert.equal(counts('static_page'), 10);
assert.equal(counts('communication_template'), 18);
assert.equal(counts('ui_catalog'), 1);
assert.equal(records.length, 111);
assert.deepEqual(nl.coverage, {
  tour: 25, blog_post: 50, destination: 7, static_page: 10,
  communication_template: 18, ui_catalog: 1,
  public_ui_messages: 81, private_ui_messages: 1075,
  ui_catalog_messages: 1156, source_records: 111,
});

const sourceKeys = new Set(refRecords.map(key));
const draftKeys = records.map(key);
assert.equal(new Set(draftKeys).size, draftKeys.length, 'No duplicate entity records');
assert.deepEqual([...sourceKeys].filter((item) => !draftKeys.includes(item)), [], 'Every reference source record has a Dutch draft');
assert.deepEqual(draftKeys.filter((item) => !sourceKeys.has(item)), [], 'No unexpected Dutch records');

const sourceByKey = new Map(refRecords.map((record) => [key(record), record]));
for (const record of records) {
  const source = sourceByKey.get(key(record)) as any;
  assert.ok(record.translated_slug, key(record) + ' has a translated slug');
  assert.ok(record.title?.trim(), key(record) + ' has a translated title');
  if (['tour','blog_post','destination','static_page'].includes(record.entity_type)) {
    assert.ok(record.summary?.trim(), key(record) + ' has a translated summary');
    assert.ok(record.seo_title?.trim(), key(record) + ' has an SEO title');
    assert.ok(record.seo_description?.trim(), key(record) + ' has an SEO description');
  }
  assert.deepEqual(Object.keys(record.content || {}).sort(), Object.keys(source.content || {}).sort(), key(record) + ' preserves the content schema');
  for (const field of ['highlights','itinerary','included','excluded','faqs','sections','paragraphs']) {
    if (Array.isArray(source.content?.[field])) {
      assert.ok(Array.isArray(record.content[field]), key(record) + ' preserves array ' + field);
      assert.equal(record.content[field].length, source.content[field].length, key(record) + ' preserves ' + field + ' row count');
    }
  }
}
const slugs = records.map((record) => record.translated_slug);
assert.equal(new Set(slugs).size, slugs.length, 'Translated slugs are unique');
for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Normalized Dutch slug: ' + slug);

const ui = records.find((record) => record.entity_type === 'ui_catalog');
const publicContent = publicDraft.records[0].content;
const privateContent = privateReference.content;
const privateUi = Object.fromEntries(Object.entries(ui.content).filter(([k]) => k.startsWith('private.text.')));
assert.equal(Object.keys(publicContent).length, 81);
assert.deepEqual(Object.keys(publicContent).sort(), Object.keys(TRANSLATIONS.en).sort());
assert.deepEqual(Object.keys(TRANSLATIONS.nl).sort(), Object.keys(TRANSLATIONS.en).sort());
for (const [k, v] of Object.entries(TRANSLATIONS.nl)) {
  assert.equal(v, publicContent[k], 'Runtime public UI value matches review draft: ' + k);
  assert.ok((v as string).trim(), 'Runtime public UI value is non-empty: ' + k);
}
assert.deepEqual(Object.keys(privateUi).sort(), Object.keys(privateContent).sort(), 'Every extracted private UI source key is represented exactly once');
assert.equal(Object.keys(privateUi).length, 1075);
for (const [k, v] of Object.entries(privateUi)) {
  assert.equal(typeof v, 'string');
  assert.ok((v as string).trim(), 'Private UI value is non-empty: ' + k);
  const placeholders = (s: string) => (s.match(/\{\{[^{}]+\}\}|\{[A-Za-z0-9_.-]+\}|%[sd]|\$\{[^}]+\}/g) || []).sort();
  assert.deepEqual(placeholders(v as string), placeholders(privateContent[k]), 'Private UI placeholders are preserved: ' + k);
}
assert.equal(Object.keys(ui.content).length, 1156);
assert.equal(EUROPEAN_LOCALE_ROLLOUT.find((locale) => locale.code === 'nl')?.rollout, 'planned');
assert.ok(SUPPORTED_LANGUAGES.nl, 'Dutch runtime dictionary is registered but remains hidden until published');

for (const record of records.filter((item) => item.entity_type === 'communication_template')) {
  const source = sourceByKey.get(key(record)) as any;
  assert.deepEqual([...record.content.variables].sort(), [...source.content.variables].sort(), key(record) + ' preserves template variables');
  assert.equal(record.content.channel, source.content.channel, key(record) + ' preserves delivery channel');
  assert.equal(record.content.template_key, source.content.template_key, key(record) + ' preserves template key');
  for (const field of ['subject','body_text']) {
    const placeholders = (s: string) => (s.match(/\{\{[^{}]+\}\}/g) || []).sort();
    assert.deepEqual(placeholders(record.content[field] || ''), placeholders(source.content[field] || ''), key(record) + ' preserves ' + field + ' placeholders');
  }
}
assert.equal(nl.source_data_warnings.length, 4, 'Known source schedule defects are documented, not silently corrected');
assert.ok(nl.source_data_warnings.some((warning: any) => warning.source_value === '13:30 AM'));
assert.ok(nl.source_data_warnings.some((warning: any) => warning.source_value === '13:00 PM'));

console.log('Dutch review bundle checks passed: 111 content records, 1,156 UI messages, complete IDs and schema, unique slugs, and preserved placeholders.');
