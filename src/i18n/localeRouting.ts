/**
 * Locale-prefixed URL helpers.
 *
 * A locale prefix is recognized independently from whether translated content
 * is published. Callers must pass the actual published locale set before
 * generating public localized URLs or hreflang alternates.
 */
export const ROUTABLE_LOCALE_CODES = [
  'en', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'pt', 'ro', 'ru',
  'sv', 'da', 'nb', 'fi', 'el', 'bg', 'hr', 'cs', 'sk', 'sl',
  'hu', 'et', 'lv', 'lt', 'uk', 'sr', 'sq', 'tr', 'ar',
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
  return {
    locale: locale as RoutableLocaleCode,
    pathname: normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`,
  };
}

/**
 * English remains on the established unprefixed URLs. A non-English URL is
 * returned only when its locale is explicitly present in the published set.
 */
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

/**
 * Generates reciprocal alternate targets only from confirmed published locales.
 * English is the default source URL and x-default target.
 */
export function buildHreflangAlternates(
  pathname: string,
  publishedLocales: readonly string[],
): HreflangAlternate[] {
  const alternatives: HreflangAlternate[] = [];
  const englishPath = buildLocalizedPath('en', pathname, publishedLocales);
  alternatives.push({ hreflang: 'en', href: englishPath || pathname });
  alternatives.push({ hreflang: 'x-default', href: englishPath || pathname });

  for (const locale of ROUTABLE_LOCALE_CODES) {
    if (locale === 'en' || !publishedLocales.includes(locale)) continue;
    alternatives.push({
      hreflang: locale,
      href: buildLocalizedPath(locale, pathname, publishedLocales)!,
    });
  }
  return alternatives;
}
