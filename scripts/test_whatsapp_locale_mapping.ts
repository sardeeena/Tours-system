import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveWhatsAppLocaleLanguageMap, selectWhatsAppTemplateLanguage } from '../src/lib/whatsappLocaleMapping';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

const defaults = resolveWhatsAppLocaleLanguageMap(undefined, 'en');
assert.equal(defaults.valid, true);
assert.equal(selectWhatsAppTemplateLanguage('fr', 'en', defaults.mapping), 'en', 'Unapproved new locales safely fall back to the configured approved language.');
assert.equal(selectWhatsAppTemplateLanguage('de', 'en', defaults.mapping), 'de', 'Existing approved locales keep their existing Meta language codes.');

const approved = resolveWhatsAppLocaleLanguageMap(JSON.stringify({ fr: 'fr_FR', es: 'es_ES', nl: 'nl', pl: 'pl', pt: 'pt_BR', ar: 'ar', tr: 'tr', uk: 'uk' }), 'en');
assert.equal(approved.valid, true);
assert.equal(selectWhatsAppTemplateLanguage('fr', 'en', approved.mapping), 'fr_FR');
assert.equal(selectWhatsAppTemplateLanguage('pt', 'en', approved.mapping), 'pt_BR');
assert.equal(selectWhatsAppTemplateLanguage('ar', 'en', approved.mapping), 'ar', 'Arabic is supported when its Meta template language is explicitly approved.');
assert.equal(selectWhatsAppTemplateLanguage('tr', 'en', approved.mapping), 'tr');
assert.equal(selectWhatsAppTemplateLanguage('uk', 'en', approved.mapping), 'uk');

const regionalFallback = resolveWhatsAppLocaleLanguageMap(undefined, 'en_US');
assert.equal(regionalFallback.valid, true, 'An explicitly configured existing regional fallback remains supported.');
assert.equal(regionalFallback.mapping.en, 'en_US');

assert.equal(resolveWhatsAppLocaleLanguageMap('{not-json', 'en').valid, false);
assert.equal(resolveWhatsAppLocaleLanguageMap(JSON.stringify({ xx: 'xx_XX' }), 'en').valid, false, 'Unknown application locales cannot be allowlisted.');
assert.equal(resolveWhatsAppLocaleLanguageMap(JSON.stringify({ fr: 'fr-fr' }), 'en').valid, false, 'Meta language codes must use the documented case-sensitive format.');
assert.equal(resolveWhatsAppLocaleLanguageMap(JSON.stringify({ fr: 'fr_FR' }), 'xx').valid, false, 'Fallback language must also be explicitly approved.');

assert.match(server, /resolveWhatsAppLocaleLanguageMap\(process\.env\.WHATSAPP_TEMPLATE_LANGUAGE_MAP/);
assert.match(server, /selectWhatsAppTemplateLanguage\(preferredLocale/);
assert.doesNotMatch(server, /\['en', 'de', 'it', 'ro', 'ru'\]\.includes\(preferredLocale\)/, 'The former hard-coded locale allowlist is removed.');
console.log('WhatsApp locale mapping and safe fallback checks passed.');
