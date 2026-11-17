import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../src/i18n/translations';

const draft = JSON.parse(readFileSync(new URL('../translations/es/public-ui.review-draft.json', import.meta.url), 'utf8'));
const source = TRANSLATIONS.en;
const translated = draft.content as Record<string, string>;
const sourceKeys = Object.keys(source).sort();
const translatedKeys = Object.keys(translated).sort();
assert.equal(draft.locale, 'es');
assert.equal(draft.status, 'translation-review-draft');
assert.deepEqual(translatedKeys, sourceKeys, 'Spanish public UI draft must cover every English source key exactly once');
const protectedTokens = (value: string) => value.match(/https?:\/\/[^\s)]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d\s()./-]{3,}\d|\{\{[^{}]+\}\}/g) || [];
for (const key of sourceKeys) {
  assert.ok(translated[key]?.trim(), 'Spanish translation must not be empty: ' + key);
  for (const token of protectedTokens(source[key])) {
    assert.ok(translated[key].includes(token), 'Protected source token must be preserved for ' + key + ': ' + token);
  }
}
assert.equal(draft.coverage.public_ui_messages, sourceKeys.length);
console.log('Spanish public UI draft checks passed (' + sourceKeys.length + ' messages).');
