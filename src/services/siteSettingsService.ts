import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import { DbSiteSetting } from '../types/database';

export interface CompanySettings {
  companyName: string;
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
  // Try Supabase first if configured
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();

      if (!error && data?.value) {
        return data.value as unknown as T;
      }
    } catch (err) {
      console.warn(`Supabase setting read error for ${key}:`, err);
    }
  }

  // Fallback to local storage
  try {
    const raw = localStorage.getItem(`${LOCAL_PREFIX}${key}`);
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // ignore
  }

  return defaultValue;
}

export async function saveSetting<T>(key: string, value: T, description?: string): Promise<void> {
  // Always update local cache
  try {
    localStorage.setItem(`${LOCAL_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // ignore
  }

  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    const { error } = await supabase.from('site_settings').upsert({
      key,
      value: value as any,
      description: description || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn(`Supabase setting write warning for ${key}:`, error);
      throw new Error(formatSupabaseError(error));
    }
  } catch (err: any) {
    console.error(`Error writing setting ${key} to Supabase:`, err);
    throw err;
  }
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const settings = await getSetting<CompanySettings>('company_info', DEFAULT_COMPANY_SETTINGS);
  return { ...settings, companyName: 'Awesome Adventure Tours' };
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  return saveSetting<CompanySettings>('company_info', { ...settings, companyName: 'Awesome Adventure Tours' }, 'Master company identity and contact details');
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
    .replace(/Kemet\\s*Spirit/gi, 'Awesome Adventure Tours')
    .replace(/Red\\s*Sea\\s+Voyages/gi, 'Awesome Adventure Tours')
    .replace(/Red\\s*Sea\\s+Excursions?/gi, 'Egypt tours and experiences');
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

export async function getStaticPages(): Promise<StaticPageContent[]> {
  const customPages = await getSetting<StaticPageContent[]>('pages_content', INITIAL_STATIC_PAGES);
  const savedPages = Array.isArray(customPages) ? customPages : [];
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

  const savedSlugs = new Set(mergedSavedPages.map((page) => page?.slug).filter(Boolean));
  return [
    ...mergedSavedPages,
    ...INITIAL_STATIC_PAGES.filter((page) => !savedSlugs.has(page.slug)),
  ];
}

export async function saveStaticPages(pages: StaticPageContent[]): Promise<void> {
  return saveSetting<StaticPageContent[]>('pages_content', pages, 'CMS static pages content and copy');
}
