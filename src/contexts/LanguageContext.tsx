import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { LanguageCode, LanguageConfig, SUPPORTED_LANGUAGES, EUROPEAN_LOCALE_ROLLOUT } from '../types/i18n';
import { TRANSLATIONS } from '../i18n/translations';
import { parseLocalePath } from '../i18n/localeRouting';

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  currentLanguageConfig: LanguageConfig;
  supportedLanguages: LanguageConfig[];
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    if (typeof window === 'undefined') return 'en';
    // Locale-prefixed URLs are authoritative, including newly published locales.
    return (parseLocalePath(window.location.pathname)?.locale || 'en') as LanguageCode;
  });
  const [publishedUiLocales, setPublishedUiLocales] = useState<string[]>([]);
  const [remoteDictionary, setRemoteDictionary] = useState<Record<string, string>>({});
  const languageSwitchRequest = useRef(0);

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
    if (typeof window === 'undefined') {
      setLanguageState(newLang);
      return;
    }
    const currentRouteLocale = parseLocalePath(window.location.pathname)?.locale || 'en';
    if (currentRouteLocale === newLang) {
      languageSwitchRequest.current += 1;
      setLanguageState(newLang);
      return;
    }
    const requestId = ++languageSwitchRequest.current;
    const params = new URLSearchParams({
      locale: newLang,
      pathname: window.location.pathname || '/',
    });
    fetch('/api/content-translations/target?' + params.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.success || typeof payload.path !== 'string' || !payload.path.startsWith('/')) {
          throw new Error(payload?.error || 'This page is not translated into the selected language yet.');
        }
        if (requestId !== languageSwitchRequest.current) return;
        const nextUrl = payload.path + window.location.search + window.location.hash;
        window.history.pushState({}, '', nextUrl);
        setLanguageState(newLang);
        window.dispatchEvent(new PopStateEvent('popstate'));
      })
      .catch((error) => {
        if (requestId !== languageSwitchRequest.current) return;
        window.dispatchEvent(new CustomEvent('rse_language_route_unavailable', {
          detail: { locale: newLang, message: error instanceof Error ? error.message : 'This page is not translated yet.' },
        }));
      });
  };

  useEffect(() => {
    const syncLocaleFromUrl = () => {
      const adminPath = /^\/(?:[a-z]{2}\/)?admin(?:\/|$)/i.test(window.location.pathname);
      const routeLocale = parseLocalePath(window.location.pathname)?.locale;
      if (adminPath && routeLocale) {
        const unprefixedPath = window.location.pathname.replace(/^\/[a-z]{2}(?=\/admin(?:\/|$))/i, '');
        window.history.replaceState({}, '', unprefixedPath + window.location.search + window.location.hash);
        window.dispatchEvent(new PopStateEvent('popstate'));
        setLanguageState('en');
        return;
      }
      setLanguageState((routeLocale || 'en') as LanguageCode);
    };
    window.addEventListener('popstate', syncLocaleFromUrl);
    syncLocaleFromUrl();
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

  const adminPath = typeof window !== 'undefined' && /^\/(?:[a-z]{2}\/)?admin(?:\/|$)/i.test(window.location.pathname);
  const dynamicConfigs: LanguageConfig[] = EUROPEAN_LOCALE_ROLLOUT
    .filter((locale) => !adminPath && publishedUiLocales.includes(locale.code) && !SUPPORTED_LANGUAGES[locale.code])
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
