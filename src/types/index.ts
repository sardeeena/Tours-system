export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'EGP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name?: string;
  rateToEur: number;
}

export interface ItineraryItem {
  time: string;
  title: string;
  description?: string;
}

export interface OptionalExtra {
  id: string;
  name: string;
  priceEur: number;
  description?: string;
}

export type TourDifficulty = 'Easy' | 'Moderate' | 'Adventurous';
export type TourDurationCategory = 'Half Day' | 'Full Day' | 'Multi Day';
export type TourType = 'Shared' | 'Private';

export interface Tour {
  id: string;
  slug: string;
  title: string;
  destination: string; // e.g. "Hurghada", "El Gouna", "Marsa Alam", "Safaga"
  category: string; // Primary category display
  categories: string[]; // e.g. ["Boat Trip", "Snorkeling", "Island"]
  tourType: TourType;
  durationCategory: TourDurationCategory;
  durationHours: number;
  durationLabel: string; // e.g. "7 Hours (Full Day)"
  shortDescription: string;
  fullDescription: string;
  highlights: string[];
  itinerary: ItineraryItem[];
  included: string[];
  excluded: string[];
  whatToBring: string[];
  importantInformation: string[];
  optionalExtras?: OptionalExtra[];
  priceEur: number;
  childPriceEur?: number;
  privatePriceEur?: number;
  rating: number;
  reviewCount: number;
  ratingBreakdown?: { 5: number; 4: number; 3: number; 2: number; 1: number };
  reviews?: Review[];
  primaryImage: string;
  galleryImages: string[];
  badge?: string;
  languages: string[];
  maxGuests: number;
  pickupInfo: string;
  pickupAvailable: boolean;
  cancellationPolicy: string;
  availableDays: string[];
  departureTime: string;
  difficulty?: TourDifficulty;
  ageRestrictions?: string;
}

export interface Destination {
  id: string;
  name: string;
  slug: string;
  image: string;
  tagline: string;
  tourCount: number;
  description: string;
  highlights: string[];
  distanceFromAirport: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  image: string;
  tourCount: number;
  description: string;
}

export interface Review {
  id: string;
  authorName: string;
  country: string;
  countryCode: string; // e.g. "DE", "GB", "NL", "IT", "FR"
  rating: number;
  date: string;
  tourTitle: string;
  tourSlug: string;
  comment: string;
  travelerType: 'Couple' | 'Family' | 'Solo' | 'Friends';
  verifiedBooking: boolean;
}

export interface SearchState {
  destination: string;
  category: string;
  date: string;
  adults: number;
  children: number;
}

export type SearchFilters = SearchState;

// Re-export specialized types
export * from './routes';
export * from './security';
export * from './filters';
export * from './api';
