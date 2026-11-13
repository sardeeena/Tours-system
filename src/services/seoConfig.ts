import { Tour, Destination } from '../types';
import { SeoMetadata } from './seoService';
import { APP_CONFIG } from '../config/appConfig';

/**
 * Global Site-Wide SEO Constants & Branding Identifiers
 */
export const SEO_DEFAULTS = {
  SITE_NAME: 'Awesome Adventure Tours',
  DEFAULT_TITLE: 'Awesome Adventure Tours | Boat Trips, Island Tours & Safaris',
  DEFAULT_DESCRIPTION:
    'Discover boat trips, island experiences, snorkeling, diving and desert safaris across Egypt. Compare details and book with confidence.\'s details before booking.',
  DEFAULT_OG_IMAGE: 'https://awesomeadventure.tours/logo.webp',
  DEFAULT_LOCALE: 'en_US',
  KEYWORDS: [
    'Egypt boat trips',
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
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === 'awesomeadventure.tours' || hostname === 'www.awesomeadventure.tours') {
      return 'https://awesomeadventure.tours';
    }
    return window.location.origin;
  }
  return 'https://awesomeadventure.tours';
}

/**
 * Generates comprehensive Schema.org JSON-LD structured data for the Homepage
 * Combines TravelAgency Organization, WebSite with SearchAction, and FAQPage schemas
 */
export function generateHomeJsonLd(origin = getAppOrigin()): Record<string, unknown> {
  const organization = {
    '@type': 'TravelAgency',
    '@id': `${origin}/#organization`,
    name: SEO_DEFAULTS.SITE_NAME,
    url: origin,
    logo: {
      '@type': 'ImageObject',
      url: `${origin}/logo.webp`,
    },
    image: SEO_DEFAULTS.DEFAULT_OG_IMAGE,
    description: SEO_DEFAULTS.DEFAULT_DESCRIPTION,
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    url: origin,
    name: SEO_DEFAULTS.SITE_NAME,
    description: SEO_DEFAULTS.DEFAULT_DESCRIPTION,
    publisher: { '@id': `${origin}/#organization` },
    inLanguage: 'en',
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [organization, website],
  };
}

/**
 * Generates rich Schema.org structured data for an individual excursion detail page
 * Combines TouristTrip, Product, Offer, AggregateRating, and Itinerary ItemList
 */
export function generateTourJsonLd(tour: Tour, origin = getAppOrigin()): Record<string, unknown> {
  const tourUrl = `${origin}/excursions/${encodeURIComponent(tour.slug)}`;
  const images = [tour.primaryImage, ...(tour.galleryImages || [])].filter(Boolean);
  const verifiedReviews = (tour.reviews || []).filter(
    (review) => review.verifiedBooking && Number.isFinite(review.rating) && review.rating >= 1 && review.rating <= 5
  );
  const verifiedAverage = verifiedReviews.length
    ? verifiedReviews.reduce((total, review) => total + review.rating, 0) / verifiedReviews.length
    : null;

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
      sku: `AAT-${tour.id}`,
      offers: {
        '@type': 'Offer',
        url: tourUrl,
        price: tour.priceEur,
        priceCurrency: 'EUR',
        seller: {
          '@type': 'TravelAgency',
          name: SEO_DEFAULTS.SITE_NAME,
          url: origin,
        },
      },
      ...(verifiedReviews.length > 0 && verifiedAverage !== null
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: verifiedAverage.toFixed(1),
              reviewCount: verifiedReviews.length,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    },
    provider: {
      '@type': 'TravelAgency',
      name: SEO_DEFAULTS.SITE_NAME,
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
  tours: Tour[],
  origin = getAppOrigin()
): Record<string, unknown> {
  const destUrl = `${origin}/destinations/${encodeURIComponent(destination.slug)}`;
  const destTours = tours.filter(
    (tour) => tour.destination.toLowerCase() === destination.name.toLowerCase()
  );

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TouristDestination',
        '@id': `${destUrl}#destination`,
        name: destination.name,
        description: destination.description,
        url: destUrl,
        image: destination.image,
        touristType: ['Holiday travelers', 'Snorkelers', 'Divers', 'Couples'],
        hasPart: destTours.map((tour) => ({
          '@type': 'TouristTrip',
          name: tour.title,
          url: `${origin}/excursions/${encodeURIComponent(tour.slug)}`,
          subjectOf: {
            '@type': 'Product',
            name: tour.title,
            offers: {
              '@type': 'Offer',
              price: tour.priceEur,
              priceCurrency: 'EUR',
              url: `${origin}/excursions/${encodeURIComponent(tour.slug)}`,
            },
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: origin },
          { '@type': 'ListItem', position: 2, name: 'Destinations', item: `${origin}/excursions` },
          { '@type': 'ListItem', position: 3, name: destination.name, item: destUrl },
        ],
      },
    ],
  };
}

/**
 * Static metadata configurations for all primary application routes
 */
export const STATIC_ROUTE_SEO: Record<string, (origin: string) => SeoMetadata> = {
  '/': (origin) => ({
    title: 'Awesome Adventure Tours | Boat Trips, Island Tours & Safaris',
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
    title: 'Boat Trips & Island Tours in Egypt | Awesome Adventure Tours',
    description:
      'Browse boat trips, island experiences, snorkeling activities and desert adventures across Egypt. Compare durations, inclusions and prices.',
    keywords: [
      'Egypt boat trips and island tours',
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

  '/experiences': (origin) => ({
    title: 'Boat Trips, Snorkeling & Desert Safaris | Awesome Adventure Tours',
    description:
      'Discover boat trips, island escapes, snorkeling, diving and desert adventures across Egypt’s Red Sea coast.',
    keywords: [
      'Egypt coastal experiences',
      'Hurghada boat trips',
      'Giftun Island excursions',
      'Red Sea snorkeling and diving',
      'Hurghada desert safari',
    ],
    canonicalUrl: `${origin}/experiences`,
    ogType: 'website',
    ogImage: SEO_DEFAULTS.DEFAULT_OG_IMAGE,
    ogImageAlt: 'Red Sea experiences and excursions in Egypt',
    twitterCard: 'summary_large_image',
    schemaJsonLd: generateBreadcrumbsJsonLd(
      [
        { name: 'Home', path: '/' },
        { name: 'Experiences', path: '/experiences' },
      ],
      origin
    ),
  }),

  '/support': (origin) => ({
    title: 'Customer Support & Tickets | Awesome Adventure Tours',
    description:
      'Sign in to create a support request and securely follow your conversations with the Awesome Adventure Tours team.',
    keywords: [
      'Awesome Adventure Tours support',
      'Tour assistance in Egypt',
      'booking support',
      'customer service Hurghada',
    ],
    canonicalUrl: `${origin}/support`,
    ogType: 'website',
    ogImage: SEO_DEFAULTS.DEFAULT_OG_IMAGE,
    ogImageAlt: 'Awesome Adventure Tours customer support',
    twitterCard: 'summary',
    robotsIndex: false,
    robotsFollow: false,
    schemaJsonLd: generateBreadcrumbsJsonLd(
      [
        { name: 'Home', path: '/' },
        { name: 'Customer Support', path: '/support' },
      ],
      origin
    ),
  }),

  '/my-booking': (origin) => ({
    title: 'Manage Your Booking & Download Voucher | Awesome Adventure Tours',
    description:
      'Retrieve your reservation details and voucher using the booking reference provided at confirmation.',
    canonicalUrl: `${origin}/my-booking`,
    ogType: 'website',
    ogImage: SEO_DEFAULTS.DEFAULT_OG_IMAGE,
    twitterCard: 'summary_large_image',
  }),

  '/login': (origin) => ({
    title: 'Sign In | Awesome Adventure Tours Guest Portal',
    description:
      'Sign in to view your excursion reservations and saved wishlist.',
    canonicalUrl: `${origin}/login`,
    ogType: 'website',
    ogImage: SEO_DEFAULTS.DEFAULT_OG_IMAGE,
    twitterCard: 'summary_large_image',
  }),

  '/register': (origin) => ({
    title: 'Create an Account | Awesome Adventure Tours',
    description:
      'Create a traveler account to manage your excursion bookings and saved wishlist.',
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
      description: `Book ${tour.title} in ${tour.destination}. ${tour.durationLabel}. Review pickup details, inclusions, and cancellation terms before booking. From ${formattedPrice}.`,
      keywords: [
        tour.title,
        tour.destination,
        tour.category,
        'Egypt tours and activities',
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

  // 2. Destination landing pages: /destinations/:slug
  if (context?.destination) {
    const destination = context.destination;
    const destinationUrl = `${origin}/destinations/${encodeURIComponent(destination.slug)}`;
    const destinationTours = (context.tours || []).filter(
      (tour) => tour.destination.toLowerCase() === destination.name.toLowerCase()
    );
    return {
      title: destination.seoTitle || `${destination.name} Excursions & Activities | Awesome Adventure Tours`,
      description: destination.seoDescription || destination.description,
      keywords: [destination.name, 'Egypt tours and activities', 'activities', 'boat trips'],
      canonicalUrl: destinationUrl,
      ogType: 'website',
      ogImage: destination.image || SEO_DEFAULTS.DEFAULT_OG_IMAGE,
      ogImageAlt: `${destination.name} on Egypt’s Red Sea coast`,
      twitterCard: 'summary_large_image',
      robotsIndex: destination.tourCount >= 2 || `${destination.description || ''} ${destination.tagline || ''}`.trim().length >= 300,
      robotsFollow: true,
      schemaJsonLd: generateDestinationJsonLd(destination, destinationTours, origin),
    };
  }

  // 3. Static defined routes
  const cleanPath = path.split('?')[0].replace(/\/$/, '') || '/';
  if (STATIC_ROUTE_SEO[cleanPath]) {
    return STATIC_ROUTE_SEO[cleanPath](origin);
  }

  // 4. Fallback default
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
