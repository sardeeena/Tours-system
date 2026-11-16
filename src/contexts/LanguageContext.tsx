import React, { createContext, useContext, useState, useEffect } from 'react';
import { LanguageCode, LanguageConfig, SUPPORTED_LANGUAGES, EUROPEAN_LOCALE_ROLLOUT } from '../types/i18n';
import { TRANSLATIONS } from '../i18n/translations';
import { buildLocalizedPath, parseLocalePath } from '../i18n/localeRouting';

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  currentLanguageConfig: LanguageConfig;
  supportedLanguages: LanguageConfig[];
  t: (key: string, fallback?: string) => string;
}

const STORAGE_KEY = 'rse_preferred_language';
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    if (typeof window === 'undefined') return 'en';
    // Locale-prefixed URLs are authoritative, including newly published locales.
    return (parseLocalePath(window.location.pathname)?.locale || 'en') as LanguageCode;
  });
  const [publishedUiLocales, setPublishedUiLocales] = useState<string[]>([]);
  const [remoteDictionary, setRemoteDictionary] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    fetch('/api/content-translations/locales', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (active && payload?.success && Array.isArray(payload.locales)) {
          setPublishedUiLocales(payload.locales.filter((value: unknown): value is string => typeof value === 'string'));
        }
      })
      .catch(() => { if (active) setPublishedUiLocales([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setRemoteDictionary({});
    if (language === 'en') return () => { active = false; };
    fetch('/api/content-translations/ui?locale=' + encodeURIComponent(language), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!active || !payload?.success || !payload.messages || typeof payload.messages !== 'object') return;
        const safeMessages: Record<string, string> = {};
        for (const [key, value] of Object.entries(payload.messages)) {
          if (typeof value === 'string' && value.trim()) safeMessages[key] = value;
        }
        setRemoteDictionary(safeMessages);
      })
      .catch(() => { if (active) setRemoteDictionary({}); });
    return () => { active = false; };
  }, [language]);

  const setLanguage = (newLang: LanguageCode) => {
    setLanguageState(newLang);
    if (typeof window !== 'undefined') {
      const parsed = parseLocalePath(window.location.pathname);
      const pathname = parsed?.pathname || window.location.pathname || '/';
      const published = [...Object.keys(SUPPORTED_LANGUAGES), ...publishedUiLocales];
      const localized = buildLocalizedPath(newLang, pathname, published);
      if (localized) {
        const nextUrl = localized + window.location.search + window.location.hash;
        if (window.location.pathname + window.location.search + window.location.hash !== nextUrl) {
          window.history.pushState({}, '', nextUrl);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
      document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    } catch {
      // Ignore storage restrictions.
    }
  };

  useEffect(() => {
    const syncLocaleFromUrl = () => {
      const routeLocale = parseLocalePath(window.location.pathname)?.locale;
      setLanguageState((routeLocale || 'en') as LanguageCode);
    };
    window.addEventListener('popstate', syncLocaleFromUrl);
    return () => window.removeEventListener('popstate', syncLocaleFromUrl);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    if (remoteDictionary[key] !== undefined) return remoteDictionary[key];
    const dict = TRANSLATIONS[language] || {};
    if (dict[key] !== undefined) return dict[key];
    const enDict = TRANSLATIONS.en || {};
    if (enDict[key] !== undefined) return enDict[key];
    return fallback || key;
  };

  const dynamicConfigs: LanguageConfig[] = EUROPEAN_LOCALE_ROLLOUT
    .filter((locale) => publishedUiLocales.includes(locale.code) && !SUPPORTED_LANGUAGES[locale.code])
    .map((locale) => ({
      code: locale.code,
      name: locale.englishName,
      localName: locale.nativeName,
      flag: locale.direction === 'rtl' ? '🌐' : '🌍',
    }));
  const supportedLanguages = [
    ...Object.values(SUPPORTED_LANGUAGES).filter((value): value is LanguageConfig => Boolean(value)),
    ...dynamicConfigs,
  ];
  const currentLanguageConfig = supportedLanguages.find((item) => item.code === language) || SUPPORTED_LANGUAGES.en!;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, currentLanguageConfig, supportedLanguages, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};
