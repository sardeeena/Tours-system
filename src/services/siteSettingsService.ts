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

export interface StaticPageContent {
  id: string;
  title: string;
  slug: string;
  heroHeadline: string;
  heroSubtitle: string;
  lastUpdated: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
  seoTitle?: string;
  seoDescription?: string;
}

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'Awesome Adventure Tours',
  email: 'reservations@awesomeadventure.tours',
  phone: '+20 151 5212741',
  whatsapp: '+20 151 5212741',
  whatsappUrl: 'https://wa.me/201515212741',
  address: 'Hurghada Marina Boulevard, Pier 4 Dispatch Office, Red Sea Governorate, Egypt',
  operatingHours: '06:00 - 23:00 EEST (Daily Pier Operations)',
  defaultCurrency: 'EUR',
  supportedCurrencies: ['EUR', 'USD', 'GBP', 'EGP'],
  defaultCountry: 'Egypt',
};

const DEFAULT_BOOKING_POLICIES: BookingPolicySettings = {
  bookingNoticeCutoffHours: 12,
  cancellationNoticeHours: 24,
  cancellationPolicyText: 'Free 100% cancellation up to 24 hours before trip departure time. Full automatic refund or free rescheduling in case of Coast Guard harbor weather closures.',
  depositRequired: false,
  depositPercent: 0,
  childAgeLimit: 11,
  infantAgeLimit: 2,
  coastGuardManifestRequired: true,
};

const DEFAULT_SOCIAL_LINKS: SocialLinksSettings = {
  facebook: 'https://facebook.com/AwesomeAdventureTours',
  instagram: 'https://instagram.com/awesomeadventuretours',
  youtube: 'https://youtube.com/@awesomeadventuretours',
  tripadvisor: 'https://tripadvisor.com/Attraction_Review-Hurghada-Red_Sea.html',
};

const DEFAULT_FOOTER_CONTENT: FooterContentSettings = {
  copyrightNotice: '© 2026 Awesome Adventure Tours SAE. Registered Tour Operator License #8421.',
  aboutSnippet: 'Awesome Adventure Tours - professional maritime tour operator based in Hurghada Marina. Certified vessels, private yacht charters, island transfers, and desert safaris.',
  badges: ['Egyptian Ministry of Tourism Certified', 'PADI Certified Dive Centers', 'Coast Guard Safety Compliant'],
  paymentIconsText: 'Cash on Pickup • Visa • MasterCard • Bank Transfer',
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
  return getSetting<CompanySettings>('company_info', DEFAULT_COMPANY_SETTINGS);
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  return saveSetting<CompanySettings>('company_info', settings, 'Master company identity and contact details');
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

export async function getFooterContent(): Promise<FooterContentSettings> {
  return getSetting<FooterContentSettings>('footer_content', DEFAULT_FOOTER_CONTENT);
}

export async function saveFooterContent(content: FooterContentSettings): Promise<void> {
  return saveSetting<FooterContentSettings>('footer_content', content, 'Footer copy, copyright, and compliance badges');
}

export const INITIAL_STATIC_PAGES: StaticPageContent[] = [
  {
    id: 'about',
    title: 'About Red Sea Excursions & Voyages',
    slug: 'about',
    heroHeadline: 'Pioneering Maritime Tourism & Desert Expeditions Across Egypt',
    heroSubtitle: 'From private luxury catamarans to desert safari bivouacs, we craft authentic experiences backed by strict Coast Guard maritime safety compliance.',
    lastUpdated: '2026-10-01',
    sections: [
      {
        title: 'Our Heritage & Fleet',
        content: 'Founded in Hurghada in 2014, Red Sea Excursions operates a modern fleet of 8 vessels registered with the Egyptian Maritime Safety Authority (EMSA). Every yacht is inspected biannually and staffed by licensed marine captains and emergency first response certified divemasters.',
      },
      {
        title: 'Direct Tour Operator Commitment',
        content: 'Unlike booking aggregators or third-party resellers, we own and manage our vessels, quad bike centers, and private transfer vehicles. When you reserve through Red Sea Excursions, you speak directly with the pier dispatchers who launch your trip.',
      },
    ],
  },
  {
    id: 'why-us',
    title: 'Why Choose Red Sea Voyages',
    slug: 'why-us',
    heroHeadline: 'Excellence In Every Departure: Verified Reliability & Transparent Service',
    heroSubtitle: 'No hidden marina surcharges, transparent pickup scheduling, and certified safety gear on every excursion.',
    lastUpdated: '2026-10-01',
    sections: [
      {
        title: 'Guaranteed 24-Hour Free Cancellation',
        content: 'Plans change when traveling. Enjoy complete flexibility with our unconditional 24-hour notice cancellation policy and immediate refunds.',
      },
      {
        title: 'Official Coast Guard Weather Protection',
        content: 'Safety is paramount. If the Red Sea Port Authority restricts nautical departures due to winds or swells, you are rebooked automatically or issued an instant 100% refund.',
      },
    ],
  },
  {
    id: 'marine-safety',
    title: 'Marine Safety & Coast Guard Compliance',
    slug: 'marine-safety',
    heroHeadline: 'Naval Port Clearance & Maritime Safety Standards',
    heroSubtitle: 'Operating strictly in accordance with Egyptian Coast Guard regulations and international maritime safety protocols.',
    lastUpdated: '2026-10-01',
    sections: [
      {
        title: 'Passenger Manifest Protocols',
        content: 'In accordance with Red Sea Naval Port Authority regulations, all vessels submit passenger manifests with passenger names and nationalities prior to harbor departure. Our dispatch software automates this compliance to eliminate dock delays.',
      },
      {
        title: 'Onboard Life Support & Rescue Equipment',
        content: 'Every yacht carries automated SOLAS-approved inflatable liferafts, hydrostatic release units, satellite EPIRB beacons, marine VHF radios, and commercial oxygen kits for certified dive safety.',
      },
    ],
  },
  {
    id: 'booking-conditions',
    title: 'Booking Terms & Conditions',
    slug: 'booking-conditions',
    heroHeadline: 'Official Reservation Terms & Pier Desk Policies',
    heroSubtitle: 'Clear, traveler-friendly policies designed for seamless Red Sea experiences.',
    lastUpdated: '2026-10-01',
    sections: [
      {
        title: 'Reservations & Confirmation',
        content: 'Upon completing your booking online, an instant reference number (RST-YYYY-XXXX) is issued alongside a digital voucher. No paper printing is necessary—simply present your smartphone confirmation to your transfer driver.',
      },
      {
        title: 'Hotel Pickup & Logistics',
        content: 'Complimentary lobby pickup is provided from all central Hurghada resorts. Drivers arrive within the stated pickup window and hold a Red Sea Voyages passenger name card.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    slug: 'privacy',
    heroHeadline: 'Data Protection & Traveler Privacy Commitment',
    heroSubtitle: 'How we collect, protect, and process your travel and booking information.',
    lastUpdated: '2026-10-01',
    sections: [
      {
        title: 'Data Collection & Port Compliance',
        content: 'We only collect necessary travel information (name, contact email, phone number, hotel pickup location) required to fulfill your reservation and submit legal passenger manifests to the Egyptian Maritime Safety Authority.',
      },
      {
        title: 'Secure Payment Processing',
        content: 'We never store sensitive credit card credentials on our servers. All digital transactions are processed through PCI-DSS Level 1 compliant payment gateways.',
      },
    ],
  },
];

export async function getStaticPages(): Promise<StaticPageContent[]> {
  const customPages = await getSetting<StaticPageContent[]>('pages_content', INITIAL_STATIC_PAGES);
  return customPages || INITIAL_STATIC_PAGES;
}

export async function saveStaticPages(pages: StaticPageContent[]): Promise<void> {
  return saveSetting<StaticPageContent[]>('pages_content', pages, 'CMS static pages content and copy');
}
