import React, { createContext, useContext, useState, useEffect } from 'react';
import { LanguageCode, LanguageConfig, SUPPORTED_LANGUAGES } from '../types/i18n';
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
    const routeLocale = parseLocalePath(window.location.pathname)?.locale;
    if (routeLocale && Object.prototype.hasOwnProperty.call(SUPPORTED_LANGUAGES, routeLocale)) {
      return routeLocale as LanguageCode;
    }
    // The URL is authoritative. Do not silently change page language from
    // localStorage or browser preferences while the URL remains English.
    return 'en';
  });

  const setLanguage = (newLang: LanguageCode) => {
    setLanguageState(newLang);
    if (typeof window !== 'undefined') {
      const parsed = parseLocalePath(window.location.pathname);
      const pathname = parsed?.pathname || window.location.pathname || '/';
      const localized = buildLocalizedPath(newLang, pathname, Object.keys(SUPPORTED_LANGUAGES));
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
      const next = routeLocale && Object.prototype.hasOwnProperty.call(SUPPORTED_LANGUAGES, routeLocale)
        ? routeLocale as LanguageCode
        : 'en';
      setLanguageState(next);
    };
    window.addEventListener('popstate', syncLocaleFromUrl);
    return () => window.removeEventListener('popstate', syncLocaleFromUrl);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    const dict = TRANSLATIONS[language];
    if (dict && dict[key] !== undefined) {
      return dict[key];
    }
    // Fallback to English if missing in current language
    const enDict = TRANSLATIONS.en;
    if (enDict && enDict[key] !== undefined) {
      return enDict[key];
    }
    return fallback || key;
  };

  const currentLanguageConfig = SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES.en;
  const supportedLanguages = Object.values(SUPPORTED_LANGUAGES);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        currentLanguageConfig,
        supportedLanguages,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
