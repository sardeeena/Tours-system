import { Tour } from '../types';

export interface SeoMetadata {
  title: string;
  description: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogType?: 'website' | 'article' | 'product';
  ogImage?: string;
  ogImageAlt?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  schemaJsonLd?: Record<string, unknown>;
}

const DEFAULT_TITLE = 'Awesome Adventure Tours | Excursions, Boat Trips & Safaris';
const DEFAULT_DESCRIPTION = 'Awesome Adventure Tours - Professional tour operator and excursion booking platform specializing in boat trips, coral snorkeling, diving, and desert safaris.';
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80';
const SITE_NAME = 'Awesome Adventure Tours';

/**
 * Updates or creates a <meta> element in the document head
 */
function setMetaTag(attribute: 'name' | 'property', attrValue: string, content: string): void {
  if (typeof document === 'undefined') return;

  let element = document.head.querySelector(`meta[${attribute}="${attrValue}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Updates or creates a canonical <link> element
 */
function setCanonicalUrl(url: string): void {
  if (typeof document === 'undefined') return;

  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

/**
 * Injects or updates Schema.org JSON-LD structured data in the document head
 */
function setSchemaJsonLd(schemaData?: Record<string, unknown>): void {
  if (typeof document === 'undefined') return;

  const SCRIPT_ID = 'rse-schema-jsonld';
  let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

  if (!schemaData) {
    if (script) script.remove();
    return;
  }

  if (!script) {
    script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(schemaData, null, 2);
}

/**
 * Dynamic Meta-Tag Generator Service
 * Updates titles, meta descriptions, OpenGraph, Twitter Cards, canonical URLs, and Schema.org JSON-LD
 */
export const seoService = {
  /**
   * Applies metadata configuration dynamically to the document head
   */
  apply(meta: SeoMetadata): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // 1. Browser Title
    document.title = meta.title || DEFAULT_TITLE;

    // 2. Standard Meta Description
    setMetaTag('name', 'description', meta.description || DEFAULT_DESCRIPTION);

    // 3. Keywords
    if (meta.keywords && meta.keywords.length > 0) {
      setMetaTag('name', 'keywords', meta.keywords.join(', '));
    }

    // 4. Canonical URL
    const canonical = meta.canonicalUrl || `${window.location.origin}${window.location.pathname}`;
    setCanonicalUrl(canonical);

    // 5. OpenGraph Tags
    setMetaTag('property', 'og:title', meta.title || DEFAULT_TITLE);
    setMetaTag('property', 'og:description', meta.description || DEFAULT_DESCRIPTION);
    setMetaTag('property', 'og:url', canonical);
    setMetaTag('property', 'og:site_name', SITE_NAME);
    setMetaTag('property', 'og:type', meta.ogType || 'website');

    const ogImg = meta.ogImage || DEFAULT_IMAGE;
    setMetaTag('property', 'og:image', ogImg);
    if (meta.ogImageAlt) {
      setMetaTag('property', 'og:image:alt', meta.ogImageAlt);
    }

    // 6. Twitter / X Cards
    setMetaTag('name', 'twitter:card', meta.twitterCard || 'summary_large_image');
    setMetaTag('name', 'twitter:title', meta.title || DEFAULT_TITLE);
    setMetaTag('name', 'twitter:description', meta.description || DEFAULT_DESCRIPTION);
    setMetaTag('name', 'twitter:image', ogImg);

    // 7. Schema.org JSON-LD
    setSchemaJsonLd(meta.schemaJsonLd);
  },

  /**
   * Generates tailored SEO metadata for an Excursion Detail Page
   */
  generateTourSeo(tour: Tour): SeoMetadata {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kemetspirit.com';
    const tourUrl = `${origin}/excursions/${tour.slug}`;
    const formattedPrice = `€${tour.priceEur}`;

    const title = `${tour.title} (${tour.destination}) | Direct Booking`;
    const description = `Book ${tour.title} in ${tour.destination}. ${tour.durationLabel}, hotel lobby pickup included, free 24h cancellation. Starting from ${formattedPrice}/person.`;

    const schemaJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'TouristTrip',
      name: tour.title,
      description: tour.shortDescription,
      image: [tour.primaryImage, ...(tour.galleryImages || [])],
      touristType: ['Snorkelers', 'Couples', 'Families', 'Divers'],
      offers: {
        '@type': 'Offer',
        price: tour.priceEur,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        validFrom: new Date().toISOString().split('T')[0],
        url: tourUrl,
        seller: {
          '@type': 'TravelAgency',
          name: SITE_NAME,
          telephone: '+201515212741',
        },
      },
      provider: {
        '@type': 'TravelAgency',
        name: SITE_NAME,
        telephone: '+201515212741',
        url: origin,
      },
      itinerary: {
        '@type': 'ItemList',
        itemListElement: (tour.itinerary || []).map((item, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: `${item.time} - ${item.title}`,
          description: item.description || '',
        })),
      },
    };

    if (tour.reviewCount > 0 && tour.rating > 0) {
      schemaJsonLd.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: tour.rating.toFixed(1),
        reviewCount: tour.reviewCount,
        bestRating: '5',
        worstRating: '1',
      };
    }

    return {
      title,
      description,
      keywords: [
        tour.title,
        tour.destination,
        tour.category,
        'Red Sea excursion',
        'Hurghada boat trip',
        'hotel pickup included',
      ],
      canonicalUrl: tourUrl,
      ogType: 'product',
      ogImage: tour.primaryImage,
      ogImageAlt: tour.title,
      twitterCard: 'summary_large_image',
      schemaJsonLd,
    };
  },

  /**
   * Generates tailored SEO metadata for Category & Filter Views
   */
  generateCategorySeo(categoryName: string, tourCount: number, matchingTours: Tour[] = []): SeoMetadata {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kemetspirit.com';
    const isAll = categoryName === 'All' || !categoryName;

    const title = isAll
      ? 'All Red Sea Excursions & Boat Trips | Hurghada, El Gouna & Sinai'
      : `${categoryName} Excursions in Red Sea | Boat Trips & Safaris`;

    const description = isAll
      ? `Compare ${tourCount} Red Sea boat trips, island cruises, snorkeling reefs, and desert safaris. Direct local operator with free cancellation and hotel pickup.`
      : `Explore ${tourCount} ${categoryName.toLowerCase()} in Hurghada and the Red Sea. Direct harbor departures, snorkeling equipment, and door-to-door hotel transfers included.`;

    const schemaJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: isAll ? 'Red Sea Excursions & Tours' : `${categoryName} Excursions`,
      description,
      numberOfItems: tourCount,
      itemListElement: matchingTours.slice(0, 10).map((t, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: t.title,
        url: `${origin}/excursions/${t.slug}`,
      })),
    };

    return {
      title,
      description,
      keywords: [
        categoryName,
        'Red Sea excursions',
        'Hurghada boat trips',
        'Giftun island',
        'snorkeling reefs',
        'desert safari',
      ],
      canonicalUrl: `${origin}/excursions`,
      ogType: 'website',
      ogImage: matchingTours[0]?.primaryImage || DEFAULT_IMAGE,
      ogImageAlt: title,
      twitterCard: 'summary_large_image',
      schemaJsonLd,
    };
  },

  /**
   * Generates tailored SEO metadata for Destination Views
   */
  generateDestinationSeo(destinationName: string, tourCount: number): SeoMetadata {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kemetspirit.com';
    const title = `${destinationName} Excursions & Boat Tours | Red Sea Direct Booking`;
    const description = `Discover ${tourCount} excursions departing directly from ${destinationName}. Island cruises, coral reef snorkeling, PADI diving, and desert quad safaris.`;

    return {
      title,
      description,
      canonicalUrl: `${origin}/excursions`,
      ogType: 'website',
      ogImage: DEFAULT_IMAGE,
      ogImageAlt: title,
      twitterCard: 'summary_large_image',
    };
  },

  /**
   * Default Homepage SEO & Organization Schema
   */
  generateDefaultSeo(): SeoMetadata {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kemetspirit.com';

    const schemaJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'TravelAgency',
      name: SITE_NAME,
      alternateName: 'Awesome Adventure Tours',
      description: DEFAULT_DESCRIPTION,
      url: origin,
      telephone: '+201515212741',
      priceRange: '€€',
      currenciesAccepted: 'EUR, USD, GBP, EGP',
      paymentAccepted: 'Cash, Credit Card, Pay at Pickup',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Hurghada',
        addressRegion: 'Red Sea Governorate',
        addressCountry: 'EG',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: '27.2579',
        longitude: '33.8116',
      },
      openingHoursSpecification: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: '06:00',
        closes: '22:00',
      },
    };

    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      canonicalUrl: origin,
      ogType: 'website',
      ogImage: DEFAULT_IMAGE,
      ogImageAlt: SITE_NAME,
      twitterCard: 'summary_large_image',
      schemaJsonLd,
    };
  },
};

export {
  SEO_DEFAULTS,
  HOMEPAGE_FAQS,
  generateHomeJsonLd,
  generateTourJsonLd,
  generateDestinationJsonLd,
  generateBreadcrumbsJsonLd,
  STATIC_ROUTE_SEO,
  getPageSeo,
} from './seoConfig';
