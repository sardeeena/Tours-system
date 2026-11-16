export const DEFAULT_WHATSAPP_LOCALE_LANGUAGE_MAP: Readonly<Record<string, string>> = {
  en: 'en',
  de: 'de',
  it: 'it',
  ro: 'ro',
  ru: 'ru',
};

const SUPPORTED_CUSTOMER_LOCALES = new Set(['en', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'pt', 'ro', 'ru']);
const META_LANGUAGE_CODE = /^[a-z]{2}(?:_[A-Z]{2})?$/;

export interface WhatsAppLocaleLanguageConfig {
  valid: boolean;
  mapping: Record<string, string>;
  approvedLanguageCodes: string[];
}

/**
 * The optional JSON map is an explicit operator allowlist of Meta-approved
 * template language codes. New app locales remain on the configured fallback
 * until their matching template language has been approved in Meta.
 */
export function resolveWhatsAppLocaleLanguageMap(
  raw: string | null | undefined,
  fallbackLanguage = 'en',
): WhatsAppLocaleLanguageConfig {
  const mapping: Record<string, string> = { ...DEFAULT_WHATSAPP_LOCALE_LANGUAGE_MAP };
  const fallbackBase = fallbackLanguage.split('_')[0];
  if (!raw?.trim()) {
    if (mapping[fallbackBase]) mapping[fallbackBase] = fallbackLanguage;
    return {
      valid: META_LANGUAGE_CODE.test(fallbackLanguage) && Object.values(mapping).includes(fallbackLanguage),
      mapping,
      approvedLanguageCodes: [...new Set(Object.values(mapping))],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, mapping, approvedLanguageCodes: [...new Set(Object.values(mapping))] };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, mapping, approvedLanguageCodes: [...new Set(Object.values(mapping))] };
  }

  for (const [locale, languageCode] of Object.entries(parsed as Record<string, unknown>)) {
    if (!SUPPORTED_CUSTOMER_LOCALES.has(locale) || typeof languageCode !== 'string' || !META_LANGUAGE_CODE.test(languageCode)) {
      return { valid: false, mapping, approvedLanguageCodes: [...new Set(Object.values(mapping))] };
    }
    mapping[locale] = languageCode;
  }

  const approvedLanguageCodes = [...new Set(Object.values(mapping))];
  return {
    valid: approvedLanguageCodes.includes(fallbackLanguage),
    mapping,
    approvedLanguageCodes,
  };
}

export function selectWhatsAppTemplateLanguage(
  preferredLocale: string,
  fallbackLanguage: string,
  mapping: Readonly<Record<string, string>>,
): string {
  return mapping[preferredLocale.trim().toLowerCase()] || fallbackLanguage;
}
