import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const expectedCoverage = {
  tour: 26,
  blog_post: 50,
  destination: 7,
  communication_template: 18,
  static_page: 10,
  ui_catalog: 1,
};
const locales = ['fr', 'nl', 'pl'] as const;
const expectedTotal = Object.values(expectedCoverage).reduce((sum, count) => sum + count, 0);

for (const locale of locales) {
  const file = join(process.cwd(), 'translations', locale, 'all-content.review-draft.json');
  const bundle = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(bundle.schema_version, 1, locale + ': unsupported review bundle schema');
  assert.equal(bundle.locale, locale, locale + ': bundle locale mismatch');
  assert.equal(bundle.status, 'translation-review-draft', locale + ': bundle must remain a review draft');
  assert.equal(bundle.source_project, 'uvtbtpxtrrmaublrztgv', locale + ': bundle source project mismatch');
  assert.equal(bundle.records.length, expectedTotal, locale + ': source record coverage is incomplete');

  const counts: Record<string, number> = {};
  const keys = new Set<string>();
  for (const record of bundle.records) {
    assert.equal(record.locale, locale, locale + ': record locale mismatch');
    assert.ok(record.entity_key && String(record.entity_key).trim(), locale + ': empty source entity key');
    assert.ok(record.content && typeof record.content === 'object' && !Array.isArray(record.content), locale + ': missing structured content');
    const key = record.entity_type + ':' + record.entity_key;
    assert.ok(!keys.has(key), locale + ': duplicate record ' + key);
    keys.add(key);
    counts[record.entity_type] = (counts[record.entity_type] || 0) + 1;
  }

  for (const [type, count] of Object.entries(expectedCoverage)) {
    assert.equal(counts[type], count, locale + ': expected ' + count + ' ' + type + ' records');
    assert.equal(bundle.coverage[type], count, locale + ': declared ' + type + ' coverage does not match records');
  }
  assert.equal(bundle.coverage.source_records, expectedTotal, locale + ': declared source record total mismatch');
  assert.equal(bundle.coverage.ui_catalog_messages, bundle.coverage.public_ui_messages + bundle.coverage.private_ui_messages,
    locale + ': UI message coverage does not reconcile');
  console.log(locale.toUpperCase() + ': validated ' + bundle.records.length + ' review-draft records (' + Object.entries(counts).map(([type, count]) => count + ' ' + type).join(', ') + ').');
}

console.log('French, Dutch and Polish review bundles cover all 112 CMS/UI source records each. No translations are published by this test.');
