export type LanguageCode = 'en' | 'de' | 'ru' | 'it' | 'ro';

export interface LanguageConfig {
  code: LanguageCode;
  name: string;
  localName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Record<LanguageCode, LanguageConfig> = {
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

