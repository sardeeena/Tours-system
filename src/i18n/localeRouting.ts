/**
 * Locale-prefixed URL helpers for the fixed 11-language public catalogue.
 * A prefix is recognized independently from publication state; public URLs and
 * hreflang targets are generated only for locales confirmed by the server.
 */
export const ROUTABLE_LOCALE_CODES = [
  'en', 'de', 'it', 'ro', 'ru', 'fr', 'nl', 'pl', 'cs', 'sv', 'es',
] as const;

export type RoutableLocaleCode = typeof ROUTABLE_LOCALE_CODES[number];
const ROUTABLE_LOCALE_SET: ReadonlySet<string> = new Set(ROUTABLE_LOCALE_CODES);

export interface ParsedLocalePath {
  locale: RoutableLocaleCode;
  pathname: string;
}
export interface HreflangAlternate {
  hreflang: string;
  href: string;
}

export function parseLocalePath(pathname: string): ParsedLocalePath | null {
  if (!pathname.startsWith('/')) return null;
  const match = pathname.match(/^\/([a-z]{2})(?=\/|$)(.*)$/i);
  if (!match) return null;
  const locale = match[1].toLowerCase();
  if (!ROUTABLE_LOCALE_SET.has(locale)) return null;
  const normalizedPath = match[2] || '/';
  return { locale: locale as RoutableLocaleCode, pathname: normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}` };
}

/** Match browser language tags (for example es-ES or pl-PL) to published base locales. */
export function detectPreferredLocale(
  browserLanguages: readonly string[],
  availableLocales: readonly string[],
): RoutableLocaleCode {
  const available = new Set(availableLocales.filter((locale) => ROUTABLE_LOCALE_SET.has(locale)));
  for (const browserLanguage of browserLanguages) {
    const normalized = browserLanguage.trim().toLowerCase().replace(/_/g, '-');
    if (!normalized) continue;
    const exact = normalized.split('-')[0];
    if (available.has(exact)) return exact as RoutableLocaleCode;
  }
  return 'en';
}

export function buildLocalizedPath(
  locale: RoutableLocaleCode,
  pathname: string,
  publishedLocales: readonly string[],
): string | null {
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const normalizedPath = cleanPath.replace(/\/{2,}/g, '/');
  if (locale === 'en') return normalizedPath;
  if (!publishedLocales.includes(locale)) return null;
  return `/${locale}${normalizedPath === '/' ? '' : normalizedPath}`;
}

export function buildHreflangAlternates(pathname: string, publishedLocales: readonly string[]): HreflangAlternate[] {
  const alternatives: HreflangAlternate[] = [];
  const englishPath = buildLocalizedPath('en', pathname, publishedLocales);
  alternatives.push({ hreflang: 'en', href: englishPath || pathname });
  alternatives.push({ hreflang: 'x-default', href: englishPath || pathname });
  for (const locale of ROUTABLE_LOCALE_CODES) {
    if (locale === 'en' || !publishedLocales.includes(locale)) continue;
    alternatives.push({ hreflang: locale, href: buildLocalizedPath(locale, pathname, publishedLocales)! });
  }
  return alternatives;
}
