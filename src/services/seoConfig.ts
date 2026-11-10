import { Tour, Destination } from '../types';
import { SeoMetadata } from './seoService';
import { APP_CONFIG } from '../config/appConfig';

/**
 * Global Site-Wide SEO Constants & Branding Identifiers
 */
export const SEO_DEFAULTS = {
  SITE_NAME: 'Awesome Adventure Tours',
  LEGAL_NAME: 'Awesome Adventure Tours S.A.E.',
  DEFAULT_TITLE: 'Awesome Adventure Tours | Excursions, Boat Trips & Safaris',
  DEFAULT_DESCRIPTION:
    'Direct booking for Red Sea boat trips, coral reef snorkeling, scuba diving, and desert safaris. Pickup arrangements, inclusions, and cancellation terms are listed for each excursion.',
  DEFAULT_OG_IMAGE: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
  DEFAULT_LOCALE: 'en_US',
  PRICE_RANGE: '€€',
  CURRENCY: 'EUR',
  FOUNDING_DATE: '2016',
  CONTACT_PHONE: '+20 151 5212741',
  CONTACT_EMAIL: 'reservations@awesomeadventure.tours',
  HEADQUARTERS: {
    streetAddress: 'Berth B-14, Hurghada Marina Boulevard',
    addressLocality: 'Hurghada',
    addressRegion: 'Red Sea Governorate',
    postalCode: '84511',
    addressCountry: 'EG',
    latitude: 27.2289,
    longitude: 33.8447,
  },
  KEYWORDS: [
    'Red Sea excursions',
    'Hurghada boat trips',
    'Orange Bay Giftun Island',
    'Ras Mohammed snorkeling',
    'Sharm El-Sheikh yacht charter',
    'El Gouna catamaran tour',
    'Makadi Bay quad safari',
    'Dolphin House Hurghada',
    'Beginner scuba diving Red Sea',
    'Pay at hotel pickup tours',
  ],
};

/**
 * Standard FAQs for Schema.org FAQPage rich snippets on Google Search
 */
export const HOMEPAGE_FAQS = [
  {
    question: 'How do I check pickup availability and transfer fees?',
    answer:
      'Pickup areas, meeting points, and any transfer supplements are listed in each excursion’s Pickup & Departure Details. Select your hotel area during booking and review the total before submitting your reservation.',
  },
  {
    question: 'Can I pay upon hotel pickup rather than paying in advance online?',
    answer:
      'Yes! We offer a flexible "Pay at Hotel Pickup" reservation option. You can book your excursion seats today to secure your departure and pay in cash (EUR, USD, GBP, or EGP) when our transfer vehicle arrives at your resort.',
  },
  {
    question: 'What is your cancellation and weather refund policy?',
    answer:
      'Cancellation windows are shown on each excursion and can differ by tour. If maritime port closures prevent departure, the operations team will contact affected guests about the available refund or rescheduling arrangements.',
  },
  {
    question: 'Are snorkeling gear and buffet lunch included on full-day boat trips?',
    answer:
      'Inclusions differ by excursion. Check the Included and Not Included lists on the tour page; some trips include masks and fins, while others offer equipment for an additional charge.',
  },
];

/**
 * Resolves current website origin safely across SSR / browser contexts
 */
export function getAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://kemetspirit.com';
}

/**
 * Generates comprehensive Schema.org JSON-LD structured data for the Homepage
 * Combines TravelAgency Organization, WebSite with SearchAction, and FAQPage schemas
 */
export function generateHomeJsonLd(origin = getAppOrigin()): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      // 1. Organization / TravelAgency Entity
      {
        '@type': 'TravelAgency',
        '@id': `${origin}/#organization`,
        name: SEO_DEFAULTS.SITE_NAME,
        legalName: SEO_DEFAULTS.LEGAL_NAME,
        url: origin,
        logo: {
          '@type': 'ImageObject',
          url: `${origin}/icon.svg`,
          width: 512,
          height: 512,
        },
        image: SEO_DEFAULTS.DEFAULT_OG_IMAGE,
        description: SEO_DEFAULTS.DEFAULT_DESCRIPTION,
        telephone: SEO_DEFAULTS.CONTACT_PHONE,
        email: SEO_DEFAULTS.CONTACT_EMAIL,
        foundingDate: SEO_DEFAULTS.FOUNDING_DATE,
        priceRange: SEO_DEFAULTS.PRICE_RANGE,
        currenciesAccepted: 'EUR, USD, GBP, EGP',
        paymentAccepted: 'Cash, Credit Card, Pay at Hotel Pickup',
        address: {
          '@type': 'PostalAddress',
          streetAddress: SEO_DEFAULTS.HEADQUARTERS.streetAddress,
          addressLocality: SEO_DEFAULTS.HEADQUARTERS.addressLocality,
          addressRegion: SEO_DEFAULTS.HEADQUARTERS.addressRegion,
          postalCode: SEO_DEFAULTS.HEADQUARTERS.postalCode,
          addressCountry: SEO_DEFAULTS.HEADQUARTERS.addressCountry,
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: SEO_DEFAULTS.HEADQUARTERS.latitude,
          longitude: SEO_DEFAULTS.HEADQUARTERS.longitude,
        },
        openingHoursSpecification: [
          {
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
            opens: '07:00',
            closes: '22:00',
          },
        ],
      },

      // 2. WebSite with SearchAction (Sitelinks Searchbox)
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: origin,
        name: SEO_DEFAULTS.SITE_NAME,
        description: SEO_DEFAULTS.DEFAULT_DESCRIPTION,
        publisher: {
          '@id': `${origin}/#organization`,
        },
        inLanguage: 'en-US',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin}/excursions?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },

      // 3. FAQPage Schema for Rich Search Snippets
      {
        '@type': 'FAQPage',
        '@id': `${origin}/#faq`,
        mainEntity: HOMEPAGE_FAQS.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  };
}

/**
 * Generates rich Schema.org structured data for an individual excursion detail page
 * Combines TouristTrip, Product, Offer, AggregateRating, and Itinerary ItemList
 */
export function generateTourJsonLd(tour: Tour, origin = getAppOrigin()): Record<string, unknown> {
  const tourUrl = `${origin}/excursions/${tour.slug}`;
  const images = [tour.primaryImage, ...(tour.galleryImages || [])].filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    '@id': `${tourUrl}#touristtrip`,
    name: tour.title,
    description: tour.fullDescription || tour.shortDescription,
    image: images,
    url: tourUrl,
    touristType: ['Snorkelers', 'Couples', 'Families', 'Scuba Divers', 'Adventure Travelers'],
    subjectOf: {
      '@type': 'Product',
      name: tour.title,
      image: images,
      description: tour.shortDescription,
      sku: `RSE-${tour.id}`,
      offers: {
        '@type': 'Offer',
        url: tourUrl,
        price: tour.priceEur,
        priceCurrency: 'EUR',
        seller: {
          '@type': 'TravelAgency',
          name: SEO_DEFAULTS.SITE_NAME,
          telephone: SEO_DEFAULTS.CONTACT_PHONE,
          url: origin,
        },
      },
      ...(tour.reviewCount > 0 && tour.rating > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: tour.rating.toFixed(1),
              reviewCount: tour.reviewCount,
              bestRating: '5',
              worstRating: '1',
            },
          }
        : {}),
    },
    provider: {
      '@type': 'TravelAgency',
      name: SEO_DEFAULTS.SITE_NAME,
      telephone: SEO_DEFAULTS.CONTACT_PHONE,
      url: origin,
    },
    itinerary: {
      '@type': 'ItemList',
      numberOfItems: tour.itinerary?.length || 0,
      itemListElement: (tour.itinerary || []).map((step, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: `${step.time} – ${step.title}`,
        description: step.description || step.title,
      })),
    },
    amenityFeature: (tour.included || []).map((inc) => ({
      '@type': 'LocationFeatureSpecification',
      name: inc,
      value: 'true',
    })),
  };
}

/**
 * Generates Schema.org BreadcrumbList structured data for any route
 */
export function generateBreadcrumbsJsonLd(
  breadcrumbs: { name: string; path: string }[],
  origin = getAppOrigin()
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: crumb.name,
      item: `${origin}${crumb.path.startsWith('/') ? crumb.path : `/${crumb.path}`}`,
    })),
  };
}

/**
 * Generates Schema.org TouristDestination structured data
 */
export function generateDestinationJsonLd(
  destination: Destination,
  tours: Tour[] = [],
  origin = getAppOrigin()
): Record<string, unknown> {
  const destUrl = `${origin}/excursions?dest=${encodeURIComponent(destination.name)}`;
  const destTours = tours.filter(
    (t) => t.destination.toLowerCase() === destination.name.toLowerCase()
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: destination.name,
    description: destination.description,
    url: destUrl,
    image: destination.image,
    touristType: ['Holiday travelers', 'Snorkelers', 'Divers', 'Couples'],
    includesAttraction: (destination.highlights || []).map((h) => ({
      '@type': 'TouristAttraction',
      name: h,
    })),
    hasPart: destTours.map((t) => ({
      '@type': 'TouristTrip',
      name: t.title,
      url: `${origin}/excursions/${t.slug}`,
      price: `€${t.priceEur}`,
    })),
  };
}

/**
 * Static metadata configurations for all primary application routes
 */
export const STATIC_ROUTE_SEO: Record<string, (origin: string) => SeoMetadata> = {
  '/': (origin) => ({
    title: 'Awesome Adventure Tours | Excursions, Boat Trips & Safaris',
    description:
      'Explore Red Sea boat trips to Orange Bay, Giftun Island, Ras Mohammed, and desert safaris. Compare tour details, pickup arrangements, inclusions, and cancellation terms.',
    keywords: SEO_DEFAULTS.KEYWORDS,
    canonicalUrl: `${origin}/`,
    ogType: 'website',
    ogImage: SEO_DEFAULTS.DEFAULT_OG_IMAGE,
    ogImageAlt: 'Red Sea yacht sailing towards turquoise island reefs',
    twitterCard: 'summary_large_image',
    schemaJsonLd: generateHomeJsonLd(origin),
  }),

  '/excursions': (origin) => ({
    title: 'All Excursions & Boat Trips | Awesome Adventure Tours',
    description:
      'Explore our full catalog of daily boat trips, coral snorkeling safaris, private yacht charters, and desert adventures across the Egyptian Red Sea.',
    keywords: [
      'Red Sea excursions catalog',
      'boat trips Hurghada',
      'El Gouna water sports',
      'Sharm El-Sheikh diving',
      'Giftun Island day trip',
    ],
    canonicalUrl: `${origin}/excursions`,
    ogType: 'website',
    ogImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    ogImageAlt: 'White sandbar beach in the Red Sea',
    twitterCard: 'summary_large_image',
    schemaJsonLd: generateBreadcrumbsJsonLd(
      [
        { name: 'Home', path: '/' },
        { name: 'All Excursions', path: '/excursions' },
      ],
      origin
    ),
  }),

  '/my-booking': (origin) => ({
    title: 'Manage Your Booking & Download Voucher | Awesome Adventure Tours',
    description:
      'Lookup your excursion reservation, download PDF vouchers, verify hotel pickup timings, or request free cancellation online.',
    canonicalUrl: `${origin}/my-booking`,
    ogType: 'website',
    ogImage: SEO_DEFAULTS.DEFAULT_OG_IMAGE,
    twitterCard: 'summary_large_image',
  }),

  '/login': (origin) => ({
    title: 'Sign In | Awesome Adventure Tours Guest Portal',
    description:
      'Sign in to access your upcoming excursion reservations, saved wishlists, and exclusive member discounts.',
    canonicalUrl: `${origin}/login`,
    ogType: 'website',
    ogImage: SEO_DEFAULTS.DEFAULT_OG_IMAGE,
    twitterCard: 'summary_large_image',
  }),

  '/register': (origin) => ({
    title: 'Create an Account | Awesome Adventure Tours',
    description:
      'Create your free traveler profile to manage bookings, track pickup status, and unlock special Red Sea excursion discounts.',
    canonicalUrl: `${origin}/register`,
    ogType: 'website',
    ogImage: SEO_DEFAULTS.DEFAULT_OG_IMAGE,
    twitterCard: 'summary_large_image',
  }),
};

/**
 * Centralized resolver to compute optimized SEO metadata for any page
 */
export function getPageSeo(
  path: string,
  context?: {
    tour?: Tour | null;
    tours?: Tour[];
    destination?: Destination | null;
  }
): SeoMetadata {
  const origin = getAppOrigin();

  // 1. Tour Detail Pages: /excursions/:slug
  if (context?.tour) {
    const tour = context.tour;
    const tourUrl = `${origin}/excursions/${tour.slug}`;
    const formattedPrice = `€${tour.priceEur}`;

    return {
      title: `${tour.title} (${tour.destination}) | Direct Booking & Pickup`,
      description: `Book ${tour.title} in ${tour.destination}. ${tour.durationLabel}. Review pickup details, inclusions, and cancellation terms before booking. From ${formattedPrice}/person.`,
      keywords: [
        tour.title,
        tour.destination,
        tour.category,
        'Red Sea excursion',
        'free cancellation',
        ...(tour.categories || []),
      ],
      canonicalUrl: tourUrl,
      ogType: 'product',
      ogImage: tour.primaryImage || SEO_DEFAULTS.DEFAULT_OG_IMAGE,
      ogImageAlt: tour.title,
      twitterCard: 'summary_large_image',
      schemaJsonLd: generateTourJsonLd(tour, origin),
    };
  }

  // 2. Static defined routes
  const cleanPath = path.split('?')[0].replace(/\/$/, '') || '/';
  if (STATIC_ROUTE_SEO[cleanPath]) {
    return STATIC_ROUTE_SEO[cleanPath](origin);
  }

  // 3. Fallback default
  return {
    title: SEO_DEFAULTS.DEFAULT_TITLE,
    description: SEO_DEFAULTS.DEFAULT_DESCRIPTION,
    keywords: SEO_DEFAULTS.KEYWORDS,
    canonicalUrl: `${origin}${path}`,
    ogType: 'website',
    ogImage: SEO_DEFAULTS.DEFAULT_OG_IMAGE,
    twitterCard: 'summary_large_image',
    schemaJsonLd: generateHomeJsonLd(origin),
  };
}
