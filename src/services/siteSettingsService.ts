import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import { DbSiteSetting } from '../types/database';
import { APP_CONFIG } from '../config/appConfig';

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
  website?: string;
  invoiceTagline?: string;
  billingAddress?: string;
  billingCity?: string;
  billingCountry?: string;
  taxRegistrationNumber?: string;
  commercialRegistryNumber?: string;
  bankName?: string;
  iban?: string;
  swiftBic?: string;
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
  companyName: APP_CONFIG.COMPANY_NAME,
  website: 'https://awesomeadventure.tours',
  invoiceTagline: 'Tours & Experiences',
  billingAddress: '',
  billingCity: 'Hurghada',
  billingCountry: 'Egypt',
  taxRegistrationNumber: '',
  commercialRegistryNumber: '',
  bankName: '',
  iban: '',
  swiftBic: '',
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
  copyrightNotice: `© ${new Date().getFullYear()} ${APP_CONFIG.COMPANY_NAME}.`,
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

function normalizeCompanyText(value: string | undefined, fallback: string): string {
  const text = (value || '').trim();
  if (!text || /kemet\s*spirit|kemetspirit\.com/i.test(text)) return fallback;
  return text.replace(/kemetspirit\.com/gi, 'awesomeadventure.tours');
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const [saved, invoiceBilling] = await Promise.all([
    getSetting<Partial<CompanySettings>>('company_info', DEFAULT_COMPANY_SETTINGS),
    getSetting<Partial<CompanySettings>>('invoice_billing', {}),
  ]);
  return {
    ...DEFAULT_COMPANY_SETTINGS,
    ...saved,
    ...invoiceBilling,
    companyName: normalizeCompanyText(saved.companyName, APP_CONFIG.COMPANY_NAME),
    website: normalizeCompanyText(saved.website, 'https://awesomeadventure.tours'),
  };
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  const normalized: CompanySettings = {
    ...settings,
    companyName: normalizeCompanyText(settings.companyName, APP_CONFIG.COMPANY_NAME),
    website: normalizeCompanyText(settings.website, 'https://awesomeadventure.tours'),
  };
  const {
    billingAddress,
    billingCity,
    billingCountry,
    taxRegistrationNumber,
    commercialRegistryNumber,
    bankName,
    iban,
    swiftBic,
    ...publicCompanySettings
  } = normalized;

  // Public contact/brand information remains in the public allowlisted setting.
  // Tax, registry and bank details are stored separately behind finance/settings RLS.
  await saveSetting('invoice_billing', {
    billingAddress,
    billingCity,
    billingCountry,
    taxRegistrationNumber,
    commercialRegistryNumber,
    bankName,
    iban,
    swiftBic,
  }, 'Restricted invoice billing and settlement details');
  await saveSetting<CompanySettings>('company_info', publicCompanySettings, 'Master company identity and contact details');
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

function normalizeFooterText(value: string): string {
  return value.replace(/Kemet\s*Spirit/gi, APP_CONFIG.COMPANY_NAME).replace(/kemetspirit\.com/gi, 'awesomeadventure.tours');
}

export async function getFooterContent(): Promise<FooterContentSettings> {
  const saved = await getSetting<FooterContentSettings>('footer_content', DEFAULT_FOOTER_CONTENT);
  return {
    ...saved,
    copyrightNotice: normalizeFooterText(saved.copyrightNotice || DEFAULT_FOOTER_CONTENT.copyrightNotice),
    aboutSnippet: normalizeFooterText(saved.aboutSnippet || DEFAULT_FOOTER_CONTENT.aboutSnippet),
    paymentIconsText: normalizeFooterText(saved.paymentIconsText || DEFAULT_FOOTER_CONTENT.paymentIconsText),
    badges: (saved.badges || []).map(normalizeFooterText),
  };
}

export async function saveFooterContent(content: FooterContentSettings): Promise<void> {
  const normalized = {
    ...content,
    copyrightNotice: normalizeFooterText(content.copyrightNotice),
    aboutSnippet: normalizeFooterText(content.aboutSnippet),
    paymentIconsText: normalizeFooterText(content.paymentIconsText),
    badges: (content.badges || []).map(normalizeFooterText),
  };
  return saveSetting<FooterContentSettings>('footer_content', normalized, 'Footer copy, copyright, and compliance badges');
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
