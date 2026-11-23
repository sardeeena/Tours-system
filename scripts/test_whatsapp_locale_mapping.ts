import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveWhatsAppLocaleLanguageMap, selectWhatsAppTemplateLanguage } from '../src/lib/whatsappLocaleMapping';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

const defaults = resolveWhatsAppLocaleLanguageMap(undefined, 'en');
assert.equal(defaults.valid, true);
assert.equal(selectWhatsAppTemplateLanguage('fr', 'en', defaults.mapping), 'en', 'Locales without an explicitly approved Meta template safely fall back.');
assert.equal(selectWhatsAppTemplateLanguage('cs', 'en', defaults.mapping), 'en', 'Newly added locales remain on the approved fallback until their Meta templates are approved.');
assert.equal(selectWhatsAppTemplateLanguage('de', 'en', defaults.mapping), 'de', 'Existing approved locales keep their existing Meta language codes.');

const approved = resolveWhatsAppLocaleLanguageMap(JSON.stringify({
  fr: 'fr_FR', es: 'es_ES', nl: 'nl', pl: 'pl', cs: 'cs', sv: 'sv',
}), 'en');
assert.equal(approved.valid, true);
assert.equal(selectWhatsAppTemplateLanguage('fr', 'en', approved.mapping), 'fr_FR');
assert.equal(selectWhatsAppTemplateLanguage('es', 'en', approved.mapping), 'es_ES');
assert.equal(selectWhatsAppTemplateLanguage('cs', 'en', approved.mapping), 'cs');
assert.equal(selectWhatsAppTemplateLanguage('sv', 'en', approved.mapping), 'sv');

const regionalFallback = resolveWhatsAppLocaleLanguageMap(undefined, 'en_US');
assert.equal(regionalFallback.valid, true, 'An explicitly configured existing regional fallback remains supported.');
assert.equal(regionalFallback.mapping.en, 'en_US');

assert.equal(resolveWhatsAppLocaleLanguageMap('{not-json', 'en').valid, false);
assert.equal(resolveWhatsAppLocaleLanguageMap(JSON.stringify({ xx: 'xx_XX' }), 'en').valid, false, 'Unknown application locales cannot be allowlisted.');
assert.equal(resolveWhatsAppLocaleLanguageMap(JSON.stringify({ pt: 'pt_BR' }), 'en').valid, false, 'Locales outside the agreed 11-language scope cannot be allowlisted.');
assert.equal(resolveWhatsAppLocaleLanguageMap(JSON.stringify({ ar: 'ar' }), 'en').valid, false, 'Locales outside the agreed 11-language scope cannot be allowlisted.');
assert.equal(resolveWhatsAppLocaleLanguageMap(JSON.stringify({ fr: 'fr-fr' }), 'en').valid, false, 'Meta language codes must use the documented case-sensitive format.');
assert.equal(resolveWhatsAppLocaleLanguageMap(JSON.stringify({ fr: 'fr_FR' }), 'xx').valid, false, 'Fallback language must also be explicitly approved.');

assert.ok(server.includes('resolveWhatsAppLocaleLanguageMap(process.env.WHATSAPP_TEMPLATE_LANGUAGE_MAP'));
assert.ok(server.includes('selectWhatsAppTemplateLanguage(preferredLocale'));
assert.ok(!server.includes("['en', 'de', 'it', 'ro', 'ru'].includes(preferredLocale)"), 'The former hard-coded locale allowlist is removed.');
console.log('WhatsApp locale mapping and safe fallback checks passed.');
