import React, { createContext, useContext, useState, useEffect } from 'react';
import { LanguageCode, LanguageConfig, SUPPORTED_LANGUAGES } from '../types/i18n';
import { TRANSLATIONS } from '../i18n/translations';

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
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
      if (saved && (saved === 'en' || saved === 'de' || saved === 'ru' || saved === 'it' || saved === 'ro')) {
        return saved;
      }
      // Detect browser language
      const browserLang = navigator.language?.toLowerCase() || '';
      if (browserLang.startsWith('de')) return 'de';
      if (browserLang.startsWith('ru')) return 'ru';
      if (browserLang.startsWith('it')) return 'it';
      if (browserLang.startsWith('ro')) return 'ro';
    } catch {
      // Ignore localStorage security/privacy restrictions
    }
    return 'en';
  });

  const setLanguage = (newLang: LanguageCode) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
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
