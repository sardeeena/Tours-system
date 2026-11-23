export type EuropeanLocaleCode =
  | 'en' | 'de' | 'it' | 'ro' | 'ru'
  | 'fr' | 'nl' | 'pl' | 'cs' | 'sv' | 'es';

export type LanguageCode = EuropeanLocaleCode;

export interface LanguageConfig {
  code: LanguageCode;
  name: string;
  localName: string;
  flag: string;
}

/** The exact public language scope approved for Awesome Adventure Tours. */
export const SUPPORTED_LANGUAGES: Record<LanguageCode, LanguageConfig> = {
  en: { code: 'en', name: 'English', localName: 'English', flag: '🇬🇧' },
  de: { code: 'de', name: 'German', localName: 'Deutsch', flag: '🇩🇪' },
  it: { code: 'it', name: 'Italian', localName: 'Italiano', flag: '🇮🇹' },
  ro: { code: 'ro', name: 'Romanian', localName: 'Română', flag: '🇷🇴' },
  ru: { code: 'ru', name: 'Russian', localName: 'Русский', flag: '🇷🇺' },
  fr: { code: 'fr', name: 'French', localName: 'Français', flag: '🇫🇷' },
  nl: { code: 'nl', name: 'Dutch', localName: 'Nederlands', flag: '🇳🇱' },
  pl: { code: 'pl', name: 'Polish', localName: 'Polski', flag: '🇵🇱' },
  cs: { code: 'cs', name: 'Czech', localName: 'Čeština', flag: '🇨🇿' },
  sv: { code: 'sv', name: 'Swedish', localName: 'Svenska', flag: '🇸🇪' },
  es: { code: 'es', name: 'Spanish', localName: 'Español', flag: '🇪🇸' },
};

export interface LocaleRolloutConfig {
  code: EuropeanLocaleCode;
  englishName: string;
  nativeName: string;
  region: 'europe';
  rollout: 'active' | 'planned';
  direction: 'ltr';
}

/**
 * "Active" here describes an existing source-language dictionary, not public
 * publication. Public availability is always decided by the server's complete,
 * reviewed content + UI + communication-template publication gate.
 */
export const EUROPEAN_LOCALE_ROLLOUT: readonly LocaleRolloutConfig[] = [
  { code: 'en', englishName: 'English', nativeName: 'English', region: 'europe', rollout: 'active', direction: 'ltr' },
  { code: 'de', englishName: 'German', nativeName: 'Deutsch', region: 'europe', rollout: 'active', direction: 'ltr' },
  { code: 'it', englishName: 'Italian', nativeName: 'Italiano', region: 'europe', rollout: 'active', direction: 'ltr' },
  { code: 'ro', englishName: 'Romanian', nativeName: 'Română', region: 'europe', rollout: 'active', direction: 'ltr' },
  { code: 'ru', englishName: 'Russian', nativeName: 'Русский', region: 'europe', rollout: 'active', direction: 'ltr' },
  { code: 'fr', englishName: 'French', nativeName: 'Français', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'nl', englishName: 'Dutch', nativeName: 'Nederlands', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'pl', englishName: 'Polish', nativeName: 'Polski', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'cs', englishName: 'Czech', nativeName: 'Čeština', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'sv', englishName: 'Swedish', nativeName: 'Svenska', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'es', englishName: 'Spanish', nativeName: 'Español', region: 'europe', rollout: 'planned', direction: 'ltr' },
] as const;

export const isEuropeanLocaleCode = (value: string): value is EuropeanLocaleCode =>
  EUROPEAN_LOCALE_ROLLOUT.some((locale) => locale.code === value);

export const getLocaleRollout = (value: string): LocaleRolloutConfig | undefined =>
  EUROPEAN_LOCALE_ROLLOUT.find((locale) => locale.code === value);
