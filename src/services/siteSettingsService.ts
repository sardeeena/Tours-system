import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import { DbSiteSetting } from '../types/database';
import { clearPublicDataCache, readPublicDataCache, writePublicDataCache } from './publicDataCache';

export interface CompanySettings {
  companyName: string;
  legalEntityName: string;
  registeredAddress: string;
  registeredCity: string;
  registeredCountry: string;
  taxRegistrationNumber: string;
  commercialRegistryNumber: string;
  bankName: string;
  iban: string;
  swiftBic: string;
  website: string;
  email: string;
  phone: string;
  whatsapp: string;
  whatsappUrl: string;
  address: string;
  operatingHours: string;
  defaultCurrency: string;
  supportedCurrencies: string[];
  defaultCountry: string;
}

export interface BookingPolicySettings {
  bookingNoticeCutoffHours: number;
  cancellationNoticeHours: number;
  cancellationPolicyText: string;
  depositRequired: boolean;
  depositPercent: number;
  childAgeLimit: number;
  infantAgeLimit: number;
  coastGuardManifestRequired: boolean;
}

export interface SocialLinksSettings {
  facebook: string;
  instagram: string;
  youtube: string;
  tripadvisor: string;
  tiktok?: string;
}

export interface FooterContentSettings {
  copyrightNotice: string;
  aboutSnippet: string;
  badges: string[];
  paymentIconsText: string;
}

import { INITIAL_STATIC_PAGES, StaticPageContent } from '../data/staticPages';
export { INITIAL_STATIC_PAGES };
export type { StaticPageContent };

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'Awesome Adventure Tours',
  legalEntityName: '',
  registeredAddress: '',
  registeredCity: '',
  registeredCountry: '',
  taxRegistrationNumber: '',
  commercialRegistryNumber: '',
  bankName: '',
  iban: '',
  swiftBic: '',
  website: 'https://awesomeadventure.tours',
  email: '',
  phone: '',
  whatsapp: '',
  whatsappUrl: '',
  address: '',
  operatingHours: '',
  defaultCurrency: 'EUR',
  supportedCurrencies: ['EUR', 'USD', 'GBP', 'EGP'],
  defaultCountry: 'Egypt',
};

const DEFAULT_BOOKING_POLICIES: BookingPolicySettings = {
  bookingNoticeCutoffHours: 12,
  cancellationNoticeHours: 24,
  cancellationPolicyText: 'Cancellation, refund and rescheduling terms depend on the selected excursion. Review the terms shown on the tour page and during checkout before booking.',
  depositRequired: false,
  depositPercent: 0,
  childAgeLimit: 11,
  infantAgeLimit: 2,
  coastGuardManifestRequired: true,
};

const DEFAULT_SOCIAL_LINKS: SocialLinksSettings = {
  facebook: '',
  instagram: '',
  youtube: '',
  tripadvisor: '',
};

const DEFAULT_FOOTER_CONTENT: FooterContentSettings = {
  copyrightNotice: `© ${new Date().getFullYear()} Awesome Adventure Tours.`,
  aboutSnippet: 'Explore excursions and experiences across Egypt’s Red Sea coast. Review each tour’s details, inclusions and booking information before reserving.',
  badges: [],
  paymentIconsText: '',
};

const LOCAL_PREFIX = 'rse_settings_';

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) throw new Error('Supabase is not configured; site settings cannot be loaded in production.');
    try {
      const raw = localStorage.getItem(`${LOCAL_PREFIX}${key}`);
      return raw ? JSON.parse(raw) as T : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  return data?.value !== undefined && data?.value !== null ? data.value as unknown as T : defaultValue;
}

export async function saveSetting<T>(key: string, value: T, description?: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) throw new Error('Supabase is not configured; site settings cannot be saved in production.');
    try {
      localStorage.setItem(`${LOCAL_PREFIX}${key}`, JSON.stringify(value));
    } catch {
      throw new Error('The development setting could not be saved to local storage.');
    }
    return;
  }

  const { error } = await supabase.from('site_settings').upsert({
    key,
    value: value as any,
    description: description || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(formatSupabaseError(error));

  // Cache only after the authoritative database write succeeds.
  try {
    localStorage.setItem(`${LOCAL_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // The cache is optional; the database write already succeeded.
  }
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const settings = await getSetting<Partial<CompanySettings>>('company_info', DEFAULT_COMPANY_SETTINGS);
  return { ...DEFAULT_COMPANY_SETTINGS, ...settings, companyName: 'Awesome Adventure Tours' };
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  return saveSetting<CompanySettings>(
    'company_info',
    { ...DEFAULT_COMPANY_SETTINGS, ...settings, companyName: 'Awesome Adventure Tours' },
    'Master company identity, verified legal billing details, and contact details'
  );
}

export async function getBookingPolicies(): Promise<BookingPolicySettings> {
  return getSetting<BookingPolicySettings>('booking_policies', DEFAULT_BOOKING_POLICIES);
}

export async function saveBookingPolicies(policies: BookingPolicySettings): Promise<void> {
  return saveSetting<BookingPolicySettings>('booking_policies', policies, 'Booking and cancellation policies');
}

export async function getSocialLinks(): Promise<SocialLinksSettings> {
  return getSetting<SocialLinksSettings>('social_links', DEFAULT_SOCIAL_LINKS);
}

export async function saveSocialLinks(links: SocialLinksSettings): Promise<void> {
  return saveSetting<SocialLinksSettings>('social_links', links, 'Social media profile links');
}

function normalizePublicBrandText(value: string): string {
  return value
    .replace(/Kemet\s*Spirit/gi, 'Awesome Adventure Tours')
    .replace(/Red\s*Sea\s+Voyages/gi, 'Awesome Adventure Tours')
    .replace(/Red\s*Sea\s+Excursions?/gi, 'Egypt tours and experiences');
}

export async function getFooterContent(): Promise<FooterContentSettings> {
  const content = await getSetting<FooterContentSettings>('footer_content', DEFAULT_FOOTER_CONTENT);
  return {
    ...content,
    copyrightNotice: normalizePublicBrandText(content.copyrightNotice || DEFAULT_FOOTER_CONTENT.copyrightNotice),
    aboutSnippet: normalizePublicBrandText(content.aboutSnippet || DEFAULT_FOOTER_CONTENT.aboutSnippet),
    badges: (content.badges || []).map(normalizePublicBrandText),
  };
}

export async function saveFooterContent(content: FooterContentSettings): Promise<void> {
  return saveSetting<FooterContentSettings>('footer_content', {
    ...content,
    copyrightNotice: normalizePublicBrandText(content.copyrightNotice || ''),
    aboutSnippet: normalizePublicBrandText(content.aboutSnippet || ''),
    badges: (content.badges || []).map(normalizePublicBrandText),
  }, 'Footer copy, copyright, and compliance badges');
}

let refreshingStaticPages = false;

export async function getStaticPages(forceRefresh = false): Promise<StaticPageContent[]> {
  if (!forceRefresh) {
    const cached = readPublicDataCache<StaticPageContent[]>('site:static-pages');
    if (cached) {
      if (!cached.isFresh && !refreshingStaticPages) {
        refreshingStaticPages = true;
        void getStaticPages(true)
          .catch((error) => console.warn('Background public page refresh failed:', error))
          .finally(() => { refreshingStaticPages = false; });
      }
      return cached.data;
    }
  }

  const customPages = await getSetting<StaticPageContent[]>('pages_content', INITIAL_STATIC_PAGES);
  const savedPages = (Array.isArray(customPages) ? customPages : []).filter((page) =>
    page?.slug && page.published !== false && page.status !== 'draft' && page.status !== 'unpublished'
  );
  const defaultsBySlug = new Map(INITIAL_STATIC_PAGES.map((page) => [page.slug, page]));
  const legalPolicySlugs = new Set(['privacy', 'terms', 'cancellation-policy', 'cookie-policy']);

  // Upgrade legacy legal placeholders in the CMS without overwriting a newer
  // policy that an administrator has deliberately edited and published.
  const mergedSavedPages = savedPages.map((savedPage) => {
    const defaultPage = defaultsBySlug.get(savedPage?.slug);
    if (!defaultPage || !legalPolicySlugs.has(defaultPage.slug)) return savedPage;
    const savedText = (savedPage.sections || []).map((section) => section.content || '').join(' ');
    const isPlaceholder = /placeholder|under review|requires confirmation|policy information under review/i.test(savedText);
    const isOlderThanCurrentPolicy = !savedPage.lastUpdated || savedPage.lastUpdated < defaultPage.lastUpdated;
    return isPlaceholder || isOlderThanCurrentPolicy ? defaultPage : savedPage;
  });

  const normalizedSavedPages = mergedSavedPages.map((page) => ({
    ...page,
    title: normalizePublicBrandText(page.title || ''),
    heroHeadline: normalizePublicBrandText(page.heroHeadline || ''),
    heroSubtitle: normalizePublicBrandText(page.heroSubtitle || ''),
    seoTitle: page.seoTitle ? normalizePublicBrandText(page.seoTitle) : page.seoTitle,
    seoDescription: page.seoDescription ? normalizePublicBrandText(page.seoDescription) : page.seoDescription,
    sections: (page.sections || []).map((section) => ({
      ...section,
      title: normalizePublicBrandText(section.title || ''),
      content: normalizePublicBrandText(section.content || ''),
    })),
  }));
  const savedSlugs = new Set(normalizedSavedPages.map((page) => page?.slug).filter(Boolean));
  const result = [
    ...normalizedSavedPages,
    ...INITIAL_STATIC_PAGES.filter((page) => !savedSlugs.has(page.slug)),
  ];
  writePublicDataCache('site:static-pages', result);
  return result;
}

export async function saveStaticPages(pages: StaticPageContent[]): Promise<void> {
  await saveSetting<StaticPageContent[]>('pages_content', pages, 'CMS static pages content and copy');
  clearPublicDataCache('site:static-pages');
}
