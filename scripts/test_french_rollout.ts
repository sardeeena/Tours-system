import assert from 'node:assert/strict';
import { TRANSLATIONS } from '../src/i18n/translations';
import { EUROPEAN_LOCALE_ROLLOUT, SUPPORTED_LANGUAGES } from '../src/types/i18n';

const english = TRANSLATIONS.en || {};
const french = TRANSLATIONS.fr || {};
const englishKeys = Object.keys(english).sort();
const frenchKeys = Object.keys(french).sort();
assert.deepEqual(frenchKeys, englishKeys, 'French public interface dictionary must cover every English source key.');
for (const key of englishKeys) {
  assert.ok(french[key]?.trim(), 'French translation must not be empty: ' + key);
}
const frenchRollout = EUROPEAN_LOCALE_ROLLOUT.find((locale) => locale.code === 'fr');
assert.equal(frenchRollout?.rollout, 'planned', 'French must remain hidden until all content and UI catalogs are reviewed and published.');
assert.equal(SUPPORTED_LANGUAGES.fr, undefined, 'French must not be advertised from a static dictionary alone.');

for (const locale of ['es', 'ar'] as const) {
  const dictionary = TRANSLATIONS[locale] || {};
  assert.deepEqual(
    Object.keys(dictionary).sort(),
    englishKeys,
    locale.toUpperCase() + ' public interface dictionary must cover every English source key.',
  );
  for (const key of englishKeys) {
    assert.ok(dictionary[key]?.trim(), locale.toUpperCase() + ' translation must not be empty: ' + key);
  }
  const rollout = EUROPEAN_LOCALE_ROLLOUT.find((item) => item.code === locale);
  assert.equal(rollout?.rollout, 'planned', locale.toUpperCase() + ' must remain staged until all content is reviewed and published.');
  assert.equal(SUPPORTED_LANGUAGES[locale], undefined, locale.toUpperCase() + ' must not be advertised from a static dictionary alone.');
}

console.log('French, Spanish and Arabic interface dictionary coverage and staged-publication checks passed.');
