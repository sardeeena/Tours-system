export type LanguageCode = EuropeanLocaleCode;

export interface LanguageConfig {
  code: LanguageCode;
  name: string;
  localName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Partial<Record<LanguageCode, LanguageConfig>> = {
  en: {
    code: 'en',
    name: 'English',
    localName: 'English',
    flag: '🇬🇧',
  },
  de: {
    code: 'de',
    name: 'German',
    localName: 'Deutsch',
    flag: '🇩🇪',
  },
  it: {
    code: 'it',
    name: 'Italian',
    localName: 'Italiano',
    flag: '🇮🇹',
  },
  nl: {
    code: 'nl',
    name: 'Dutch',
    localName: 'Nederlands',
    flag: '🇳🇱',
  },
  ro: {
    code: 'ro',
    name: 'Romanian',
    localName: 'Română',
    flag: '🇷🇴',
  },
  ru: {
    code: 'ru',
    name: 'Russian',
    localName: 'Русский',
    flag: '🇷🇺',
  },
};



/**
 * Europe-wide locale catalogue. These are planned translation targets, not
 * a claim that translated content is already published. LanguageCode is the
 * complete route-code union; SUPPORTED_LANGUAGES lists the built-in dictionaries,
 * while additional locales are advertised only after a complete reviewed UI catalog exists.
 */
export type EuropeanLocaleCode =
  | 'en' | 'de' | 'fr' | 'it' | 'es' | 'nl' | 'pl' | 'pt' | 'ro' | 'ru'
  | 'sv' | 'da' | 'nb' | 'fi' | 'el' | 'bg' | 'hr' | 'cs' | 'sk' | 'sl'
  | 'hu' | 'et' | 'lv' | 'lt' | 'uk' | 'sr' | 'sq' | 'tr' | 'ar';

export interface LocaleRolloutConfig {
  code: EuropeanLocaleCode;
  englishName: string;
  nativeName: string;
  region: 'europe' | 'additional';
  rollout: 'active' | 'planned';
  direction: 'ltr' | 'rtl';
}

export const EUROPEAN_LOCALE_ROLLOUT: readonly LocaleRolloutConfig[] = [
  { code: 'en', englishName: 'English', nativeName: 'English', region: 'europe', rollout: 'active', direction: 'ltr' },
  { code: 'de', englishName: 'German', nativeName: 'Deutsch', region: 'europe', rollout: 'active', direction: 'ltr' },
  { code: 'it', englishName: 'Italian', nativeName: 'Italiano', region: 'europe', rollout: 'active', direction: 'ltr' },
  { code: 'ro', englishName: 'Romanian', nativeName: 'Română', region: 'europe', rollout: 'active', direction: 'ltr' },
  { code: 'ru', englishName: 'Russian', nativeName: 'Русский', region: 'europe', rollout: 'active', direction: 'ltr' },
  { code: 'fr', englishName: 'French', nativeName: 'Français', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'es', englishName: 'Spanish', nativeName: 'Español', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'nl', englishName: 'Dutch', nativeName: 'Nederlands', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'pl', englishName: 'Polish', nativeName: 'Polski', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'pt', englishName: 'Portuguese', nativeName: 'Português', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'sv', englishName: 'Swedish', nativeName: 'Svenska', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'da', englishName: 'Danish', nativeName: 'Dansk', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'nb', englishName: 'Norwegian Bokmål', nativeName: 'Norsk bokmål', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'fi', englishName: 'Finnish', nativeName: 'Suomi', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'el', englishName: 'Greek', nativeName: 'Ελληνικά', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'bg', englishName: 'Bulgarian', nativeName: 'Български', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'hr', englishName: 'Croatian', nativeName: 'Hrvatski', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'cs', englishName: 'Czech', nativeName: 'Čeština', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'sk', englishName: 'Slovak', nativeName: 'Slovenčina', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'sl', englishName: 'Slovenian', nativeName: 'Slovenščina', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'hu', englishName: 'Hungarian', nativeName: 'Magyar', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'et', englishName: 'Estonian', nativeName: 'Eesti', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'lv', englishName: 'Latvian', nativeName: 'Latviešu', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'lt', englishName: 'Lithuanian', nativeName: 'Lietuvių', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'uk', englishName: 'Ukrainian', nativeName: 'Українська', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'sr', englishName: 'Serbian', nativeName: 'Српски', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'sq', englishName: 'Albanian', nativeName: 'Shqip', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'tr', englishName: 'Turkish', nativeName: 'Türkçe', region: 'europe', rollout: 'planned', direction: 'ltr' },
  { code: 'ar', englishName: 'Arabic', nativeName: 'العربية', region: 'additional', rollout: 'planned', direction: 'rtl' },
] as const;

export const isEuropeanLocaleCode = (value: string): value is EuropeanLocaleCode =>
  EUROPEAN_LOCALE_ROLLOUT.some((locale) => locale.code === value);

export const getLocaleRollout = (value: string): LocaleRolloutConfig | undefined =>
  EUROPEAN_LOCALE_ROLLOUT.find((locale) => locale.code === value);
