import {
  supabase,
  isSupabaseConfigured,
  formatSupabaseError,
  isSchemaMissing,
  isSchemaMissingError,
  setSchemaMissing,
} from './supabaseClient';
export { formatSupabaseError };
import { Tour, ItineraryItem, Review, Destination, Category } from '../types';
import {
  DbTour,
  TourWithRelations,
  DbTourImage,
  DbTourVideo,
  DbTourItinerary,
  DbTourInclusion,
  DbTourExclusion,
  DbTourHighlight,
  DbTourFaq,
  DbDestination,
  DbCategory,
  DbPickupLocation,
  DbTourExtra,
  DbTourAvailability,
  DbSeoMetadata,
} from '../types/database';
import { PickupLocation, BookingExtra } from '../types/booking';
import { ALL_TOURS } from '../data/toursData';

/**
 * Transforms database tour record with related collections into the frontend Tour structure
 */
export function mapDbTourToFrontendTour(
  dbTour: DbTour,
  relations: {
    destinationName?: string;
    categories?: string[];
    images?: DbTourImage[];
    videos?: DbTourVideo[];
    itinerary?: DbTourItinerary[];
    inclusions?: DbTourInclusion[];
    exclusions?: DbTourExclusion[];
    highlights?: DbTourHighlight[];
    faqs?: DbTourFaq[];
    reviews?: Review[];
    extras?: DbTourExtra[];
  }
): Tour {
  const images = [...(relations.images || [])].sort((a, b) => a.sort_order - b.sort_order);
  const primaryImgObj = images.find((img) => img.is_primary) || images[0];
  const primaryImageUrl = primaryImgObj?.image_url || '';
  const galleryImageUrls = images.length > 0 ? images.map((i) => i.image_url) : (primaryImageUrl ? [primaryImageUrl] : []);

  const sortedItinerary: ItineraryItem[] = (relations.itinerary || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      time: item.time,
      title: item.title,
      description: item.description || '',
    }));

  const sortedHighlights = (relations.highlights || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((h) => h.item);

  const sortedInclusions = (relations.inclusions || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => i.item);

  const sortedExclusions = (relations.exclusions || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) => e.item);

  const sortedFaqs = [...(relations.faqs || [])].sort((a, b) => a.sort_order - b.sort_order);
  const whatToBring = sortedFaqs
    .filter((faq) => faq.section === 'what_to_bring')
    .map((faq) => faq.answer);
  const importantInformation = sortedFaqs
    .filter((faq) => faq.section === 'important_information')
    .map((faq) => faq.answer);

  const cats = relations.categories && relations.categories.length > 0 ? relations.categories : [];
  const configuredNoticeHours = Number(dbTour.minimum_booking_notice_hours);
  const minimumBookingNoticeHours = Number.isFinite(configuredNoticeHours)
    ? Math.max(0, configuredNoticeHours)
    : 12;

  return {
    id: dbTour.id,
    slug: dbTour.slug,
    title: dbTour.title,
    destination: relations.destinationName || '',
    category: cats[0] || 'Excursion',
    categories: cats,
    tourType: dbTour.tour_type,
    durationCategory: dbTour.duration_type || 'Unspecified',
    durationHours: Number(dbTour.duration_hours) || 0,
    durationLabel: dbTour.duration || (dbTour.duration_hours ? `${dbTour.duration_hours} Hours` : ''),
    priceEur: Number(dbTour.price) || 0,
    childPriceEur: dbTour.child_price !== null && dbTour.child_price !== undefined ? Number(dbTour.child_price) : undefined,
    privatePriceEur: dbTour.private_price !== null && dbTour.private_price !== undefined && Number(dbTour.private_price) > 0 ? Number(dbTour.private_price) : undefined,
    minimumBookingNoticeHours,
    rating: Number(dbTour.rating) || 0,
    reviewCount: Number(dbTour.review_count) || 0,
    badge: dbTour.badge || (dbTour.featured ? 'Popular' : undefined),
    primaryImage: primaryImageUrl,
    galleryImages: galleryImageUrls,
    shortDescription: dbTour.short_description || '',
    fullDescription: dbTour.description || '',
    highlights: sortedHighlights,
    itinerary: sortedItinerary,
    faqs: sortedFaqs.filter((faq) => faq.section === 'faq').map((faq) => ({ question: faq.question, answer: faq.answer })),
    included: sortedInclusions,
    excluded: sortedExclusions,
    whatToBring,
    importantInformation,
    languages: dbTour.languages || [],
    maxGuests: dbTour.max_guests || 0,
    pickupInfo: dbTour.pickup_info || '',
    pickupAvailable: !!dbTour.pickup_available,
    cancellationPolicy: dbTour.cancellation_policy || '',
    availableDays: dbTour.available_days || [],
    departureTime: dbTour.departure_time || '',
    difficulty: dbTour.difficulty || undefined,
    ageRestrictions: dbTour.age_restrictions || '',
    reviews: relations.reviews,
    optionalExtras: relations.extras && relations.extras.length > 0 
      ? relations.extras.map((e) => {
          const customPrices = getTourCustomExtraPrices(dbTour.id);
          const customSlugPrices = getTourCustomExtraPrices(dbTour.slug);
          const customPrice = customPrices[e.id] ?? customSlugPrices[e.id];
          return {
            id: e.id,
            name: e.name,
            priceEur: customPrice !== undefined && !isNaN(customPrice) ? Number(customPrice) : Number(e.price_eur) || 0,
            description: e.description || undefined,
          };
        })
      : undefined,
  };
}

/**
 * Local store for in-browser changes when running without live Supabase credentials
 */
let localTours: Tour[] = [...ALL_TOURS];

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let cachedPublishedTours: CacheEntry<Tour[]> | null = null;
let cachedDestinations: CacheEntry<Destination[]> | null = null;
let cachedCategories: CacheEntry<Category[]> | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000;

export function invalidateCatalogueCache() {
  cachedPublishedTours = null;
  cachedDestinations = null;
  cachedCategories = null;
}

export interface TourFilterOptions {
  destination?: string;
  category?: string;
  featuredOnly?: boolean;
  includeDrafts?: boolean;
  searchQuery?: string;
}

/**
 * Fetches all published tours for the public website with in-memory caching
 */
export async function getPublishedTours(options?: TourFilterOptions): Promise<Tour[]> {
  const filterTours = (sourceList: Tour[]): Tour[] => {
    let tours = [...sourceList];
    if (options?.destination && options.destination !== 'All' && options.destination !== 'All Destinations') {
      const destQuery = options.destination.toLowerCase().replace(/[-_ ]/g, '').replace('shiekh', 'sheikh');
      tours = tours.filter((t) => {
        const destName = t.destination.toLowerCase().replace(/[-_ ]/g, '').replace('shiekh', 'sheikh');
        return destName === destQuery || destName.includes(destQuery) || destQuery.includes(destName);
      });
    }

    if (options?.category && options.category !== 'All' && options.category !== 'All Activities') {
      tours = tours.filter((t) => t.categories.some((c) => c.toLowerCase() === options.category?.toLowerCase()));
    }

    if (options?.featuredOnly) {
      tours = tours.filter((t) => t.badge || t.rating >= 4.8);
    }

    if (options?.searchQuery) {
      const q = options.searchQuery.toLowerCase();
      tours = tours.filter((t) => t.title.toLowerCase().includes(q) || t.shortDescription?.toLowerCase().includes(q));
    }
    return tours;
  };

  // Serve from fast memory cache if valid and not demanding drafts
  if (!options?.includeDrafts && cachedPublishedTours && (Date.now() - cachedPublishedTours.timestamp < CACHE_TTL_MS)) {
    return filterTours(cachedPublishedTours.data);
  }

  if (!isSupabaseConfigured() || isSchemaMissing()) {
    if (import.meta.env.PROD) {
      throw new Error(!isSupabaseConfigured()
        ? 'The public excursion catalogue is unavailable because Supabase is not configured.'
        : 'The public excursion catalogue is unavailable because its database schema could not be verified.');
    }
    return filterTours(localTours);
  }

  try {
    // Public catalogue payload: only fields consumed by cards and the quick-view modal.
    // Full itinerary, FAQs, videos and other deep content are fetched on the tour-detail route.
    let query = supabase
      .from('tours')
      .select(`
        id,
        title,
        slug,
        short_description,
        description,
        destination_id,
        duration,
        duration_type,
        duration_hours,
        tour_type,
        status,
        featured,
        price,
        child_price,
        private_price,
        rating,
        review_count,
        badge,
        languages,
        max_guests,
        pickup_available,
        pickup_info,
        cancellation_policy,
        available_days,
        departure_time,
        difficulty,
        age_restrictions,
        sort_order,
        destinations (id, name, slug),
        tour_categories (sort_order, categories (id, name, slug)),
        tour_images (image_url, is_primary, sort_order),
        tour_highlights (item, sort_order),
        tour_inclusions (item, sort_order),
        tour_exclusions (item, sort_order)
      `)
      .order('sort_order', { ascending: true });

    if (!options?.includeDrafts) {
      query = query.eq('status', 'published');
    }

    if (options?.featuredOnly) {
      query = query.eq('featured', true);
    }

    const { data, error } = await query;

    if (error) {
      if (isSchemaMissingError(error)) {
        setSchemaMissing(true);
      }
      const message = formatSupabaseError(error);
      console.error('Failed to query published tours:', message);
      throw new Error(`Unable to load published excursions: ${message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    const baseTours = data.map((row: any) => {
      const destName = row.destinations?.name;
      const catNames = [...(row.tour_categories || [])]
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((tc: any) => tc.categories?.name)
        .filter(Boolean);

      return mapDbTourToFrontendTour(row, {
        destinationName: destName,
        categories: catNames,
        images: row.tour_images || [],
        itinerary: row.tour_itinerary || [],
        highlights: row.tour_highlights || [],
        inclusions: row.tour_inclusions || [],
        exclusions: row.tour_exclusions || [],
        faqs: row.tour_faqs || [],
      });
    });

    if (!options?.includeDrafts && !options?.featuredOnly) {
      cachedPublishedTours = {
        data: baseTours,
        timestamp: Date.now(),
      };
    }

    return filterTours(baseTours);
  } catch (err) {
    if (isSchemaMissingError(err)) {
      setSchemaMissing(true);
    }
    console.warn('Supabase getPublishedTours failed:', err);
    throw new Error(err instanceof Error ? err.message : 'Unable to load published excursions.');
  }
}

/**
 * Fetches a single tour by slug with complete relations (for Tour Details and SEO)
 */
export async function getTourBySlug(slug: string, allowDraft: boolean = false): Promise<Tour | null> {
  if (!isSupabaseConfigured() || isSchemaMissing()) {
    if (import.meta.env.PROD) return null;
    const local = localTours.find((t) => t.slug === slug || t.id === slug);
    return local || null;
  }

  try {
    let query = supabase
      .from('tours')
      .select(`
        *,
        destinations (id, name, slug),
        tour_categories (categories (id, name, slug)),
        tour_images (*),
        tour_videos (*),
        tour_itinerary (*),
        tour_highlights (*),
        tour_inclusions (*),
        tour_exclusions (*),
        tour_faqs (*),
        reviews (*)
      `)
      .eq('slug', slug);

    if (!allowDraft) {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      if (isSchemaMissingError(error)) {
        setSchemaMissing(true);
      }
      console.error(`Failed to fetch tour by slug "${slug}":`, formatSupabaseError(error));
      return null;
    }

    if (!data) {
      return null;
    }

    const destName = data.destinations?.name;
    const catNames = data.tour_categories?.map((tc: any) => tc.categories?.name).filter(Boolean) || [];

    const reviews: Review[] = (data.reviews || []).map((r: any) => ({
      id: r.id,
      authorName: r.author_name,
      country: r.country || 'International',
      countryCode: r.country_code || 'DE',
      rating: r.rating,
      date: r.date,
      tourTitle: data.title,
      tourSlug: data.slug,
      comment: r.comment,
      travelerType: r.traveler_type || 'Couple',
      verifiedBooking: r.verified_booking,
    }));

    return mapDbTourToFrontendTour(data, {
      destinationName: destName,
      categories: catNames,
      images: data.tour_images || [],
      videos: data.tour_videos || [],
      itinerary: data.tour_itinerary || [],
      highlights: data.tour_highlights || [],
      inclusions: data.tour_inclusions || [],
      exclusions: data.tour_exclusions || [],
      faqs: data.tour_faqs || [],
      reviews: reviews,
    });
  } catch (err) {
    console.warn('Error fetching tour by slug:', err);
    return null;
  }
}

/**
 * Fetches SEO metadata for a tour or entity
 */
export async function getSeoMetadata(entityType: 'tour' | 'destination' | 'category' | 'page', entityId?: string, slug?: string): Promise<DbSeoMetadata | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    let query = supabase.from('seo_metadata').select('*').eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);
    if (slug) query = query.eq('page_slug', slug);

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return data as DbSeoMetadata;
  } catch {
    return null;
  }
}

// ==============================================================================
// ADMIN CMS CRUD OPERATIONS
// ==============================================================================

export interface AdminTourPayload {
  tour: Partial<DbTour>;
  categoryIds?: string[];
  images?: Array<Partial<DbTourImage>>;
  videos?: Array<Partial<DbTourVideo>>;
  itinerary?: Array<Partial<DbTourItinerary>>;
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
  faqs?: Array<{ question: string; answer: string }>;
  whatToBring?: string[];
  importantInformation?: string[];
  pickupLocationIds?: string[];
  extraIds?: string[];
  extraPrices?: Record<string, number>;
  seo?: Partial<DbSeoMetadata>;
}

/**
 * Lists all tours for the Admin CMS (draft, published, archived) with counts & filters
 */
export async function adminListTours(filters?: {
  status?: string;
  search?: string;
  destinationId?: string;
}): Promise<DbTour[]> {
  const getLocalList = (): DbTour[] => {
    let list: DbTour[] = localTours.map((t, index) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      short_description: t.shortDescription,
      description: t.fullDescription,
      destination_id: 'a1000000-0000-0000-0000-000000000001',
      duration: t.durationLabel,
      duration_type: t.durationCategory,
      duration_hours: t.durationHours,
      tour_type: t.tourType,
      status: (t as any).status || 'published',
      featured: !!t.badge,
      price: t.priceEur,
      child_price: t.childPriceEur || 0,
      infant_price: 0,
      private_price: t.privatePriceEur || 0,
      currency: 'EUR',
      max_guests: t.maxGuests,
      minimum_booking_notice_hours: 12,
      pickup_available: t.pickupAvailable,
      pickup_info: t.pickupInfo,
      cancellation_policy: t.cancellationPolicy,
      departure_time: t.departureTime,
      available_days: t.availableDays,
      languages: t.languages,
      difficulty: t.difficulty || null,
      age_restrictions: t.ageRestrictions || null,
      badge: t.badge || null,
      rating: t.rating,
      review_count: t.reviewCount,
      sort_order: index + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    if (filters?.status && filters.status !== 'all') {
      list = list.filter((t) => t.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
    }
    return list;
  };

  if (!isSupabaseConfigured() || isSchemaMissing()) {
    if (import.meta.env.PROD) {
      throw new Error(!isSupabaseConfigured()
        ? 'Tour management is unavailable because Supabase is not configured.'
        : 'Tour management is unavailable because the database schema could not be verified.');
    }
    return getLocalList();
  }

  try {
    let query = supabase.from('tours').select('*').order('sort_order', { ascending: true });

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters?.destinationId) {
      query = query.eq('destination_id', filters.destinationId);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,slug.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) {
      if (isSchemaMissingError(error)) {
        setSchemaMissing(true);
        if (import.meta.env.PROD) throw new Error('Tour management is unavailable because the database schema could not be verified.');
        return getLocalList();
      }
      console.error('Supabase adminListTours query error:', error.message);
      throw new Error(formatSupabaseError(error));
    }
    return (data || []) as DbTour[];
  } catch (err) {
    if (isSchemaMissingError(err)) {
      setSchemaMissing(true);
      if (import.meta.env.PROD) throw new Error('Tour management is unavailable because the database schema could not be verified.');
      return getLocalList();
    }
    console.error('Failed to list admin tours:', err);
    throw new Error(formatSupabaseError(err));
  }
}

/**
 * Fetches a complete Tour with all child relations for the Admin CMS form
 */
export async function adminGetTourById(id: string): Promise<TourWithRelations | null> {
  const getLocalTour = (tourId: string): TourWithRelations | null => {
    const found = localTours.find((t) => t.id === tourId || t.slug === tourId);
    if (!found) return null;

    return {
      id: found.id,
      title: found.title,
      slug: found.slug,
      short_description: found.shortDescription,
      description: found.fullDescription,
      destination_id: 'a1000000-0000-0000-0000-000000000001',
      duration: found.durationLabel,
      duration_type: found.durationCategory,
      duration_hours: found.durationHours,
      tour_type: found.tourType,
      status: (found as any).status || 'published',
      featured: !!found.badge,
      price: found.priceEur,
      child_price: found.childPriceEur || 0,
      infant_price: 0,
      private_price: found.privatePriceEur || 0,
      currency: 'EUR',
      max_guests: found.maxGuests,
      minimum_booking_notice_hours: 12,
      pickup_available: found.pickupAvailable,
      pickup_info: found.pickupInfo,
      cancellation_policy: found.cancellationPolicy,
      departure_time: found.departureTime,
      available_days: found.availableDays,
      languages: found.languages,
      difficulty: found.difficulty || 'Easy',
      age_restrictions: found.ageRestrictions || null,
      badge: found.badge || null,
      rating: found.rating,
      review_count: found.reviewCount,
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      images: found.galleryImages.map((url, i) => ({
        id: `img-${i}`,
        tour_id: found.id,
        image_url: url,
        storage_path: null,
        alt_text: found.title,
        caption: null,
        is_primary: i === 0,
        sort_order: i + 1,
        created_at: new Date().toISOString(),
      })),
      videos: [],
      itinerary: found.itinerary.map((it, i) => ({
        id: `itin-${i}`,
        tour_id: found.id,
        time: it.time,
        title: it.title,
        description: it.description || null,
        sort_order: i + 1,
        created_at: new Date().toISOString(),
      })),
      highlights: found.highlights.map((h, i) => ({
        id: `high-${i}`,
        tour_id: found.id,
        item: h,
        sort_order: i + 1,
        created_at: new Date().toISOString(),
      })),
      inclusions: found.included.map((inc, i) => ({
        id: `inc-${i}`,
        tour_id: found.id,
        item: inc,
        sort_order: i + 1,
        created_at: new Date().toISOString(),
      })),
      exclusions: found.excluded.map((exc, i) => ({
        id: `exc-${i}`,
        tour_id: found.id,
        item: exc,
        sort_order: i + 1,
        created_at: new Date().toISOString(),
      })),
      faqs: [],
      seo: null,
    };
  };

  if (!isSupabaseConfigured() || isSchemaMissing()) {
    if (import.meta.env.PROD) throw new Error('Tour editor is unavailable because the live tour database could not be verified.');
    return getLocalTour(id);
  }

  try {
    const { data, error } = await supabase
      .from('tours')
      .select(`
        *,
        destinations (*),
        tour_categories (categories (*)),
        tour_images (*),
        tour_videos (*),
        tour_itinerary (*),
        tour_highlights (*),
        tour_inclusions (*),
        tour_exclusions (*),
        tour_faqs (*),
        tour_pickup_locations (pickup_locations (*)),
        tour_assigned_extras (tour_extras (*))
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (isSchemaMissingError(error)) {
        setSchemaMissing(true);
        if (!import.meta.env.PROD) return getLocalTour(id);
      }
      throw new Error(formatSupabaseError(error));
    }
    if (!data) return null;

    // Fetch SEO metadata
    const { data: seoData, error: seoError } = await supabase
      .from('seo_metadata')
      .select('*')
      .eq('entity_type', 'tour')
      .eq('entity_id', id)
      .maybeSingle();
    if (seoError) throw new Error(formatSupabaseError(seoError));

    return {
      ...data,
      destination: data.destinations,
      categories: data.tour_categories?.map((tc: any) => tc.categories).filter(Boolean) || [],
      images: (data.tour_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      videos: (data.tour_videos || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      itinerary: (data.tour_itinerary || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      highlights: (data.tour_highlights || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      inclusions: (data.tour_inclusions || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      exclusions: (data.tour_exclusions || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      faqs: (data.tour_faqs || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      pickup_locations: data.tour_pickup_locations?.map((tp: any) => tp.pickup_locations).filter(Boolean) || [],
      extras: data.tour_assigned_extras?.map((te: any) => te.tour_extras).filter(Boolean) || [],
      seo: seoData || null,
    };
  } catch (err) {
    if (isSchemaMissingError(err)) {
      setSchemaMissing(true);
      if (!import.meta.env.PROD) return getLocalTour(id);
    }
    console.error('Error fetching admin tour by id:', err);
    throw new Error(formatSupabaseError(err));
  }
}

/**
 * Creates a brand new Tour with related tables in a transactional sequence
 */
export async function adminCreateTour(payload: AdminTourPayload): Promise<{ id: string; slug: string }> {
  const tourData = payload.tour;
  const tourTitle = tourData.title;
  const tourSlug = tourData.slug;

  if (!tourTitle || !tourSlug) {
    throw new Error('Tour title and unique URL slug are required.');
  }

  const createLocalTour = (): { id: string; slug: string } => {
    const newId = `tour-custom-${Date.now()}`;
    const frontendTour = mapDbTourToFrontendTour(
      {
        id: newId,
        title: tourTitle,
        slug: tourSlug,
        short_description: tourData.short_description || '',
        description: tourData.description || '',
        destination_id: tourData.destination_id || null,
        duration: tourData.duration || '',
        duration_type: tourData.duration_type || 'Unspecified',
        duration_hours: Number(tourData.duration_hours ?? 0),
        tour_type: tourData.tour_type || 'Shared',
        status: tourData.status || 'draft',
        featured: !!tourData.featured,
        price: Number(tourData.price) || 0,
        child_price: Number(tourData.child_price) || 0,
        infant_price: Number(tourData.infant_price) || 0,
        private_price: Number(tourData.private_price) || 0,
        currency: tourData.currency || 'EUR',
        max_guests: tourData.max_guests ?? 0,
        minimum_booking_notice_hours: tourData.minimum_booking_notice_hours ?? 0,
        pickup_available: tourData.pickup_available ?? false,
        pickup_info: tourData.pickup_info || null,
        cancellation_policy: tourData.cancellation_policy || null,
        departure_time: tourData.departure_time || '',
        available_days: tourData.available_days || [],
        languages: tourData.languages || [],
        difficulty: tourData.difficulty || null,
        age_restrictions: tourData.age_restrictions || null,
        badge: tourData.badge || null,
        rating: 0,
        review_count: 0,
        sort_order: localTours.length + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        destinationName: '',
        categories: [],
        images: (payload.images as DbTourImage[]) || [],
        itinerary: (payload.itinerary as DbTourItinerary[]) || [],
        highlights: (payload.highlights || []).map((h, i) => ({ id: `${i}`, tour_id: newId, item: h, sort_order: i + 1, created_at: '' })),
        inclusions: (payload.inclusions || []).map((inc, i) => ({ id: `${i}`, tour_id: newId, item: inc, sort_order: i + 1, created_at: '' })),
        exclusions: (payload.exclusions || []).map((exc, i) => ({ id: `${i}`, tour_id: newId, item: exc, sort_order: i + 1, created_at: '' })),
      }
    );

    (frontendTour as any).status = tourData.status || 'draft';
    localTours.unshift(frontendTour);
    return { id: newId, slug: tourSlug };
  };

  if (!isSupabaseConfigured() || isSchemaMissing()) {
    if (import.meta.env.PROD) throw new Error('Tour creation is unavailable because the live tour database could not be verified.');
    return createLocalTour();
  }

  try {
    // 1. Insert main tour record
    const { data: tourRecord, error: tourError } = await supabase
      .from('tours')
      .insert({
        title: tourData.title,
        slug: tourData.slug,
        short_description: tourData.short_description || null,
        description: tourData.description || null,
        destination_id: tourData.destination_id || null,
        duration: tourData.duration || '',
        duration_type: tourData.duration_type || 'Unspecified',
        duration_hours: Number(tourData.duration_hours ?? 0),
        tour_type: tourData.tour_type || 'Shared',
        status: tourData.status || 'draft',
        featured: !!tourData.featured,
        price: Number(tourData.price) || 0,
        child_price: Number(tourData.child_price) || 0,
        infant_price: Number(tourData.infant_price) || 0,
        private_price: Number(tourData.private_price) || 0,
        currency: tourData.currency || 'EUR',
        max_guests: tourData.max_guests ?? 0,
        minimum_booking_notice_hours: tourData.minimum_booking_notice_hours ?? 0,
        pickup_available: tourData.pickup_available ?? false,
        pickup_info: tourData.pickup_info || null,
        cancellation_policy: tourData.cancellation_policy || null,
        departure_time: tourData.departure_time || '',
        available_days: tourData.available_days || [],
        languages: tourData.languages || [],
        difficulty: tourData.difficulty || null,
        age_restrictions: tourData.age_restrictions || null,
        badge: tourData.badge || null,
      })
      .select('id, slug')
      .single();

    if (tourError || !tourRecord) {
      throw tourError;
    }

    const tourId = tourRecord.id;

    // 2. Child tables insertion. If any relation fails, remove the new parent
    // record so a partially-created tour is not reported as successful.
    try {
      await syncTourRelations(tourId, payload);
    } catch (relationError) {
      const { error: rollbackError } = await supabase.from('tours').delete().eq('id', tourId);
      if (rollbackError) {
        throw new Error(`Tour relations failed: ${formatSupabaseError(relationError)}. The parent tour rollback also failed: ${formatSupabaseError(rollbackError)}`);
      }
      throw new Error(`Tour creation was rolled back because related content could not be saved: ${formatSupabaseError(relationError)}`);
    }

    return { id: tourId, slug: tourRecord.slug };
  } catch (err) {
    if (isSchemaMissingError(err)) {
      setSchemaMissing(true);
      if (import.meta.env.PROD) throw new Error('Tour creation failed because the live tour database schema could not be verified.');
      return createLocalTour();
    }
    console.error('Failed to create tour in Supabase:', err);
    throw new Error(formatSupabaseError(err));
  }
}

/**
 * Updates an existing Tour and syncs its relational tables
 */
export async function adminUpdateTour(id: string, payload: AdminTourPayload): Promise<{ id: string; slug: string }> {
  const tourData = payload.tour;

  const updateLocalTour = () => {
    const index = localTours.findIndex((t) => t.id === id);
    if (index !== -1) {
      const existing = localTours[index];
      const updatedTour = {
        ...existing,
        title: tourData.title || existing.title,
        slug: tourData.slug || existing.slug,
        shortDescription: tourData.short_description ?? existing.shortDescription,
        fullDescription: tourData.description ?? existing.fullDescription,
        priceEur: Number(tourData.price) ?? existing.priceEur,
        childPriceEur: Number(tourData.child_price) ?? existing.childPriceEur,
        privatePriceEur: Number(tourData.private_price) ?? existing.privatePriceEur,
        durationLabel: tourData.duration || existing.durationLabel,
        durationHours: Number(tourData.duration_hours) || existing.durationHours,
        tourType: tourData.tour_type || existing.tourType,
        maxGuests: tourData.max_guests || existing.maxGuests,
        highlights: payload.highlights || existing.highlights,
        included: payload.inclusions || existing.included,
        excluded: payload.exclusions || existing.excluded,
        itinerary: (payload.itinerary as any) || existing.itinerary,
        galleryImages: payload.images?.map((i) => i.image_url!).filter(Boolean) || existing.galleryImages,
        primaryImage: payload.images?.find((i) => i.is_primary)?.image_url || payload.images?.[0]?.image_url || existing.primaryImage,
      };
      (updatedTour as any).status = tourData.status || (existing as any).status || 'published';
      localTours[index] = updatedTour;
      return { id: updatedTour.id, slug: updatedTour.slug };
    }
    return { id, slug: tourData.slug || id };
  };

  if (!isSupabaseConfigured() || isSchemaMissing()) {
    if (import.meta.env.PROD) throw new Error('Tour updates are unavailable because the live tour database could not be verified.');
    return updateLocalTour();
  }

  try {
    // 1. Update main record
    const { data: updatedRecord, error: updateError } = await supabase
      .from('tours')
      .update({
        title: tourData.title,
        slug: tourData.slug,
        short_description: tourData.short_description,
        description: tourData.description,
        destination_id: tourData.destination_id,
        duration: tourData.duration,
        duration_type: tourData.duration_type,
        duration_hours: tourData.duration_hours,
        tour_type: tourData.tour_type,
        status: tourData.status,
        featured: tourData.featured,
        price: tourData.price,
        child_price: tourData.child_price,
        infant_price: tourData.infant_price,
        private_price: tourData.private_price,
        currency: tourData.currency,
        max_guests: tourData.max_guests,
        minimum_booking_notice_hours: tourData.minimum_booking_notice_hours,
        pickup_available: tourData.pickup_available,
        pickup_info: tourData.pickup_info,
        cancellation_policy: tourData.cancellation_policy,
        departure_time: tourData.departure_time,
        available_days: tourData.available_days,
        languages: tourData.languages,
        difficulty: tourData.difficulty,
        age_restrictions: tourData.age_restrictions,
        badge: tourData.badge,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, slug')
      .single();

    if (updateError || !updatedRecord) {
      throw updateError;
    }

    // 2. Synchronize child relational entities
    await syncTourRelations(id, payload);

    return { id: updatedRecord.id, slug: updatedRecord.slug };
  } catch (err) {
    if (isSchemaMissingError(err)) {
      setSchemaMissing(true);
      if (import.meta.env.PROD) throw new Error('Tour update failed because the live tour database schema could not be verified.');
      return updateLocalTour();
    }
    console.error('Failed to update tour in Supabase:', err);
    throw new Error(formatSupabaseError(err));
  }
}

/**
 * Synchronizes relational tables (itinerary, highlights, inclusions, exclusions, faqs, images, SEO)
 */
async function ensureTourWrite(
  operation: PromiseLike<{ error: any }>,
  description: string
): Promise<void> {
  const { error } = await operation;
  if (error) throw new Error(`${description}: ${formatSupabaseError(error)}`);
}

async function syncTourRelations(tourId: string, payload: AdminTourPayload): Promise<void> {
  // Itinerary
  if (payload.itinerary !== undefined) {
    await ensureTourWrite(supabase.from('tour_itinerary').delete().eq('tour_id', tourId), 'Failed to clear tour itinerary');
    if (payload.itinerary.length > 0) {
      const items = payload.itinerary.map((it, idx) => ({
        tour_id: tourId,
        time: it.time || '00:00',
        title: it.title || 'Stop',
        description: it.description || null,
        sort_order: idx + 1,
      }));
      await ensureTourWrite(supabase.from('tour_itinerary').insert(items), 'Failed to save tour itinerary');
    }
  }

  // Highlights
  if (payload.highlights !== undefined) {
    await ensureTourWrite(supabase.from('tour_highlights').delete().eq('tour_id', tourId), 'Failed to clear tour highlights');
    if (payload.highlights.length > 0) {
      const items = payload.highlights.map((h, idx) => ({
        tour_id: tourId,
        item: h,
        sort_order: idx + 1,
      }));
      await ensureTourWrite(supabase.from('tour_highlights').insert(items), 'Failed to save tour highlights');
    }
  }

  // Inclusions
  if (payload.inclusions !== undefined) {
    await ensureTourWrite(supabase.from('tour_inclusions').delete().eq('tour_id', tourId), 'Failed to clear tour inclusions');
    if (payload.inclusions.length > 0) {
      const items = payload.inclusions.map((inc, idx) => ({
        tour_id: tourId,
        item: inc,
        sort_order: idx + 1,
      }));
      await ensureTourWrite(supabase.from('tour_inclusions').insert(items), 'Failed to save tour inclusions');
    }
  }

  // Exclusions
  if (payload.exclusions !== undefined) {
    await ensureTourWrite(supabase.from('tour_exclusions').delete().eq('tour_id', tourId), 'Failed to clear tour exclusions');
    if (payload.exclusions.length > 0) {
      const items = payload.exclusions.map((exc, idx) => ({
        tour_id: tourId,
        item: exc,
        sort_order: idx + 1,
      }));
      await ensureTourWrite(supabase.from('tour_exclusions').insert(items), 'Failed to save tour exclusions');
    }
  }

  // FAQs (preserve preparation sections when normal FAQs are edited)
  if (payload.faqs !== undefined) {
    await ensureTourWrite(supabase.from('tour_faqs').delete().eq('tour_id', tourId).eq('section', 'faq'), 'Failed to clear tour FAQs');
    if (payload.faqs.length > 0) {
      const items = payload.faqs.map((f, idx) => ({
        tour_id: tourId,
        question: f.question,
        answer: f.answer,
        section: 'faq',
        sort_order: idx + 1,
      }));
      await ensureTourWrite(supabase.from('tour_faqs').insert(items), 'Failed to save tour FAQs');
    }
  }

  if (payload.whatToBring !== undefined) {
    await ensureTourWrite(supabase.from('tour_faqs').delete().eq('tour_id', tourId).eq('section', 'what_to_bring'), 'Failed to clear tour preparation items');
    if (payload.whatToBring.length > 0) {
      const items = payload.whatToBring.map((item, idx) => ({
        tour_id: tourId,
        question: 'What to bring',
        answer: item,
        section: 'what_to_bring',
        sort_order: idx + 1,
      }));
      await ensureTourWrite(supabase.from('tour_faqs').insert(items), 'Failed to save tour FAQs');
    }
  }

  if (payload.importantInformation !== undefined) {
    await ensureTourWrite(supabase.from('tour_faqs').delete().eq('tour_id', tourId).eq('section', 'important_information'), 'Failed to clear important tour information');
    if (payload.importantInformation.length > 0) {
      const items = payload.importantInformation.map((item, idx) => ({
        tour_id: tourId,
        question: 'Important information',
        answer: item,
        section: 'important_information',
        sort_order: idx + 1,
      }));
      await ensureTourWrite(supabase.from('tour_faqs').insert(items), 'Failed to save tour FAQs');
    }
  }

  // Images
  if (payload.images !== undefined) {
    await ensureTourWrite(supabase.from('tour_images').delete().eq('tour_id', tourId), 'Failed to clear tour images');
    if (payload.images.length > 0) {
      const items = payload.images.map((img, idx) => ({
        tour_id: tourId,
        image_url: img.image_url || '',
        storage_path: img.storage_path || null,
        alt_text: img.alt_text || null,
        caption: img.caption || null,
        is_primary: idx === 0 || !!img.is_primary,
        sort_order: idx + 1,
      }));
      await ensureTourWrite(supabase.from('tour_images').insert(items), 'Failed to save tour images');
    }
  }

  // Videos
  if (payload.videos !== undefined) {
    await ensureTourWrite(supabase.from('tour_videos').delete().eq('tour_id', tourId), 'Failed to clear tour videos');
    if (payload.videos.length > 0) {
      const items = payload.videos.map((vid, idx) => ({
        tour_id: tourId,
        video_url: vid.video_url || '',
        title: vid.title || null,
        description: vid.description || null,
        provider: vid.provider || 'youtube',
        is_primary: idx === 0,
        sort_order: idx + 1,
      }));
      await ensureTourWrite(supabase.from('tour_videos').insert(items), 'Failed to save tour videos');
    }
  }

  // Categories
  if (payload.categoryIds !== undefined) {
    await ensureTourWrite(supabase.from('tour_categories').delete().eq('tour_id', tourId), 'Failed to clear tour categories');
    if (payload.categoryIds.length > 0) {
      const links = payload.categoryIds.map((catId, idx) => ({
        tour_id: tourId,
        category_id: catId,
        sort_order: idx + 1,
      }));
      await ensureTourWrite(supabase.from('tour_categories').insert(links), 'Failed to save tour categories');
    }
  }

  // Pickup Locations
  if (payload.pickupLocationIds !== undefined) {
    await ensureTourWrite(supabase.from('tour_pickup_locations').delete().eq('tour_id', tourId), 'Failed to clear tour pickup locations');
    if (payload.pickupLocationIds.length > 0) {
      const links = payload.pickupLocationIds.map((locId) => ({
        tour_id: tourId,
        pickup_location_id: locId,
      }));
      await ensureTourWrite(supabase.from('tour_pickup_locations').insert(links), 'Failed to save tour pickup locations');
    }
  }

  // Tour Assigned Extras & Custom Prices (Atomic Transactional Replacement)
  if (payload.extraIds !== undefined) {
    const assignments = payload.extraIds.map((extId, index) => ({
      extra_id: extId,
      custom_price_eur: payload.extraPrices && payload.extraPrices[extId] !== undefined ? payload.extraPrices[extId] : null,
      is_active: true,
      sort_order: index + 1,
    }));

    if (isSupabaseConfigured() && !isSchemaMissing()) {
      const { error: assignErr } = await supabase.rpc('replace_tour_extra_assignments_atomic', {
        p_tour_id: tourId,
        p_assignments: assignments,
      });

      if (assignErr) {
        console.error('Failed to update tour extra assignments atomically via RPC:', assignErr);
        throw new Error(`Failed to update tour add-on assignments atomically: ${assignErr.message || 'Database error'}. Existing assignments were preserved.`);
      }
    }
  }

  // SEO Metadata
  if (payload.seo !== undefined) {
    await ensureTourWrite(supabase.from('seo_metadata').upsert({
      entity_type: 'tour',
      entity_id: tourId,
      seo_title: payload.seo.seo_title || null,
      meta_description: payload.seo.meta_description || null,
      seo_keywords: payload.seo.seo_keywords || [],
      canonical_url: payload.seo.canonical_url || null,
      og_title: payload.seo.og_title || null,
      og_description: payload.seo.og_description || null,
      og_image: payload.seo.og_image || null,
      social_image: payload.seo.social_image || null,
      robots_index: payload.seo.robots_index ?? true,
      robots_follow: payload.seo.robots_follow ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'entity_type,entity_id' }), 'Failed to save tour SEO metadata');
  }

  notifyCatalogueDataChanged('tours');
}

/**
 * Changes status of tour (published, draft, archived)
 */
export async function adminSetTourStatus(id: string, status: 'draft' | 'published' | 'archived'): Promise<void> {
  if (!isSupabaseConfigured() || isSchemaMissing()) {
    if (import.meta.env.PROD) throw new Error('Tour status cannot be changed because the live tour database could not be verified.');
    const tour = localTours.find((item) => item.id === id);
    if (tour) (tour as any).status = status;
    notifyCatalogueDataChanged('tours');
    return;
  }

  const { data, error } = await supabase
    .from('tours')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    if (isSchemaMissingError(error)) setSchemaMissing(true);
    throw new Error(formatSupabaseError(error));
  }
  if (!data) throw new Error('Tour status was not changed because the tour no longer exists or is not accessible.');
  notifyCatalogueDataChanged('tours');
}

/**
 * Checks if a tour can be safely deleted or if it has existing bookings.
 * Rule: For tours with existing bookings, DO NOT allow unsafe deletion; recommend Archive instead.
 */
export async function adminCheckTourBookingsCount(id: string): Promise<number> {
  if (!isSupabaseConfigured() || isSchemaMissing()) {
    if (import.meta.env.PROD) throw new Error('Cannot verify booking history; tour deletion is blocked until the live database is available.');
    return id.includes('orange-bay') || id.includes('tour-1') ? 1 : 0;
  }

  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('tour_id', id);

  if (error) {
    if (isSchemaMissingError(error)) setSchemaMissing(true);
    throw new Error(`Could not verify existing bookings for this tour: ${formatSupabaseError(error)}`);
  }
  if (count === null || count === undefined) {
    throw new Error('Could not verify existing bookings for this tour. Deletion is blocked for safety.');
  }
  return count;
}

/**
 * Safely deletes a tour (throws if bookings exist)
 */
export async function adminDeleteTour(id: string): Promise<void> {
  const bookingsCount = await adminCheckTourBookingsCount(id);
  if (bookingsCount > 0) {
    throw new Error(
      `Cannot permanently delete this tour because it has ${bookingsCount} associated booking record(s). Please unpublish or archive the tour instead to protect historical guest records.`
    );
  }

  if (!isSupabaseConfigured() || isSchemaMissing()) {
    if (import.meta.env.PROD) throw new Error('Tour deletion is unavailable because the live tour database could not be verified.');
    localTours = localTours.filter((t) => t.id !== id);
    return;
  }

  try {
    const { data, error } = await supabase.from('tours').delete().eq('id', id).select('id').maybeSingle();
    if (error) {
      if (isSchemaMissingError(error)) {
        setSchemaMissing(true);
        if (import.meta.env.PROD) throw new Error('Tour deletion failed because the live tour database schema could not be verified.');
        localTours = localTours.filter((t) => t.id !== id);
        notifyCatalogueDataChanged('tours');
        return;
      }
      throw new Error(formatSupabaseError(error));
    }
    if (!data) throw new Error('Tour was not deleted because it no longer exists or is not accessible.');
    notifyCatalogueDataChanged('tours');
  } catch (err) {
    if (isSchemaMissingError(err)) {
      setSchemaMissing(true);
      if (import.meta.env.PROD) throw new Error('Tour deletion failed because the live tour database schema could not be verified.');
      localTours = localTours.filter((t) => t.id !== id);
      notifyCatalogueDataChanged('tours');
      return;
    }
    throw err;
  }
}

// ==============================================================================
// DESTINATIONS & CATEGORIES SERVICES (GENUINE DATABASE-DRIVEN)
// ==============================================================================

export const NEUTRAL_DESTINATION_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='100%25' height='100%25' fill='%23132235'/%3E%3Ccircle cx='400' cy='240' r='50' fill='%231e334d'/%3E%3Cpath d='M200 480l120-130 90 90 140-150 110 190H200z' fill='%231e334d'/%3E%3C/svg%3E";

export const NEUTRAL_CATEGORY_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='100%25' height='100%25' fill='%230f172a'/%3E%3Ccircle cx='400' cy='260' r='48' fill='%231e293b'/%3E%3Cpath d='M300 440c0-60 45-100 100-100s100 40 100 100' fill='%231e293b'/%3E%3C/svg%3E";

/**
 * Notifies the frontend when catalogue records (tours, destinations, categories) are mutated in Admin
 */
export function notifyCatalogueDataChanged(
  entity?: 'tours' | 'destinations' | 'categories' | 'reviews' | 'locations' | 'extras'
) {
  invalidateCatalogueCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rse_data_updated', { detail: { entity } }));
  }
}

/**
 * Fetches all published destinations for the public website with real dynamic tour counts
 */
export async function getPublishedDestinations(): Promise<Destination[]> {
  if (cachedDestinations && (Date.now() - cachedDestinations.timestamp < CACHE_TTL_MS)) {
    return cachedDestinations.data;
  }

  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Published destinations cannot be loaded.');
  }

  // 1. Fetch published destinations ordered by sort_order
  const { data: dests, error: destError } = await supabase
    .from('destinations')
    .select('id, name, slug, main_image, tagline, description, seo_keywords, distance_from_airport, seo_title, seo_description, sort_order')
    .eq('status', 'published')
    .order('sort_order', { ascending: true });

  if (destError) {
    console.error('Failed to query published destinations:', formatSupabaseError(destError));
    throw new Error(formatSupabaseError(destError));
  }

  if (!dests || dests.length === 0) {
    return [];
  }

  // 2. Fetch published tours to accurately calculate tour counts
  const { data: toursData, error: toursError } = await supabase
    .from('tours')
    .select('id, destination_id')
    .eq('status', 'published');

  if (toursError) {
    console.error('Failed to calculate published destination counts:', formatSupabaseError(toursError));
    throw new Error(`Unable to calculate published excursion counts: ${formatSupabaseError(toursError)}`);
  }

  const countMap: Record<string, number> = {};
  if (toursData) {
    for (const t of toursData) {
      if (t.destination_id) {
        countMap[t.destination_id] = (countMap[t.destination_id] || 0) + 1;
      }
    }
  }

  const mapped = dests.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    image: d.main_image || NEUTRAL_DESTINATION_PLACEHOLDER,
    tagline: d.tagline || '',
    tourCount: countMap[d.id] || 0,
    description: d.description || '',
    highlights: Array.isArray(d.seo_keywords) ? d.seo_keywords : [],
    distanceFromAirport: d.distance_from_airport || '',
    seoTitle: d.seo_title || undefined,
    seoDescription: d.seo_description || undefined,
  }));

  cachedDestinations = {
    data: mapped,
    timestamp: Date.now(),
  };

  return mapped;
}

/**
 * Fetches all published categories for the public website with real dynamic tour counts
 */
export async function getPublishedCategories(): Promise<Category[]> {
  if (cachedCategories && (Date.now() - cachedCategories.timestamp < CACHE_TTL_MS)) {
    return cachedCategories.data;
  }

  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Published categories cannot be loaded.');
  }

  // 1. Fetch published categories ordered by sort_order
  const { data: cats, error: catError } = await supabase
    .from('categories')
    .select('id, name, slug, icon_name, image, description, sort_order')
    .eq('status', 'published')
    .order('sort_order', { ascending: true });

  if (catError) {
    console.error('Failed to query published categories:', formatSupabaseError(catError));
    throw new Error(formatSupabaseError(catError));
  }

  if (!cats || cats.length === 0) {
    return [];
  }

  // 2. Fetch published tour category relations to calculate real tour counts
  const countMap: Record<string, number> = {};

  try {
    const { data: tcData, error: tcError } = await supabase
      .from('tour_categories')
      .select('category_id, tours!inner(status)')
      .eq('tours.status', 'published');

    if (!tcError && tcData) {
      for (const item of tcData as any[]) {
        if (item.category_id) {
          countMap[item.category_id] = (countMap[item.category_id] || 0) + 1;
        }
      }
    } else {
      const { data: toursWithTc, error: fallbackError } = await supabase
        .from('tours')
        .select('id, tour_categories(category_id)')
        .eq('status', 'published');

      if (fallbackError) {
        throw new Error(`Unable to calculate published experience counts: ${formatSupabaseError(fallbackError)}`);
      }

      if (toursWithTc) {
        for (const t of toursWithTc as any[]) {
          if (Array.isArray(t.tour_categories)) {
            for (const tc of t.tour_categories) {
              if (tc.category_id) {
                countMap[tc.category_id] = (countMap[tc.category_id] || 0) + 1;
              }
            }
          }
        }
      }
    }
  } catch (countErr) {
    console.error('Could not calculate category tour counts:', countErr);
    throw new Error(countErr instanceof Error ? countErr.message : 'Unable to calculate published experience counts.');
  }

  const mapped = cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    iconName: c.icon_name || 'Compass',
    image: c.image || NEUTRAL_CATEGORY_PLACEHOLDER,
    tourCount: countMap[c.id] || 0,
    description: c.description || '',
  }));

  cachedCategories = {
    data: mapped,
    timestamp: Date.now(),
  };

  return mapped;
}

/**
 * Lists destinations for admin management or selective filtering
 */
export async function getDestinations(options?: { publishedOnly?: boolean }): Promise<DbDestination[]> {
  if (!isSupabaseConfigured()) {
    if (import.meta.env.PROD) throw new Error('Supabase is not configured; destination records cannot be loaded in production.');
    return [];
  }

  let query = supabase
    .from('destinations')
    .select('*')
    .order('sort_order', { ascending: true });

  if (options?.publishedOnly) {
    query = query.eq('status', 'published');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to query destinations from Supabase:', formatSupabaseError(error));
    throw new Error(formatSupabaseError(error));
  }
  return (data || []) as DbDestination[];
}

/**
 * Lists categories for admin management or selective filtering
 */
export async function getCategories(options?: { publishedOnly?: boolean }): Promise<DbCategory[]> {
  if (!isSupabaseConfigured()) {
    if (import.meta.env.PROD) throw new Error('Supabase is not configured; category records cannot be loaded in production.');
    return [];
  }

  let query = supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (options?.publishedOnly) {
    query = query.eq('status', 'published');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to query categories from Supabase:', formatSupabaseError(error));
    throw new Error(formatSupabaseError(error));
  }
  return (data || []) as DbCategory[];
}

export async function getPickupLocations(): Promise<DbPickupLocation[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Pickup locations cannot be loaded.');
  }
  if (isSchemaMissing()) {
    throw new Error('The pickup locations schema is unavailable. Apply the required database migrations.');
  }

  const { data, error } = await supabase
    .from('pickup_locations')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    if (isSchemaMissingError(error)) setSchemaMissing(true);
    throw new Error(formatSupabaseError(error));
  }
  return (data || []) as DbPickupLocation[];
}

export async function getTourExtras(): Promise<DbTourExtra[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Tour extras cannot be loaded.');
  }
  if (isSchemaMissing()) {
    throw new Error('The tour extras schema is unavailable. Apply the required database migrations.');
  }

  const { data, error } = await supabase
    .from('tour_extras')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    if (isSchemaMissingError(error)) setSchemaMissing(true);
    throw new Error(formatSupabaseError(error));
  }
  return (data || []) as DbTourExtra[];
}

/**
 * Lists ALL tour extras (both active and inactive) for administrative CRUD and sorting.
 */
export async function adminListTourExtras(): Promise<DbTourExtra[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Admin tour extras cannot be loaded.');
  }
  if (isSchemaMissing()) {
    throw new Error('The tour extras schema is unavailable. Apply the required database migrations.');
  }

  const { data, error } = await supabase
    .from('tour_extras')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    if (isSchemaMissingError(error)) setSchemaMissing(true);
    throw new Error(formatSupabaseError(error));
  }
  return (data || []) as DbTourExtra[];
}

/**
 * Fetches only active pickup locations explicitly assigned to a published tour.
 * There is deliberately no destination-based or global fallback.
 */
export async function getPublishedPickupLocations(tourIdOrSlug: string): Promise<PickupLocation[]> {
  if (!tourIdOrSlug?.trim()) {
    throw new Error('A published tour identifier is required to load approved pickup locations.');
  }
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Approved pickup locations cannot be verified.');
  }
  if (isSchemaMissing()) {
    throw new Error('The pickup mapping schema is unavailable. Approved pickup locations cannot be verified.');
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tourIdOrSlug);
  let tourQuery = supabase
    .from('tours')
    .select('id, pickup_available')
    .eq('status', 'published');
  tourQuery = isUuid ? tourQuery.eq('id', tourIdOrSlug) : tourQuery.eq('slug', tourIdOrSlug);

  const { data: tour, error: tourError } = await tourQuery.maybeSingle();
  if (tourError) {
    throw new Error(`Unable to verify tour pickup eligibility: ${formatSupabaseError(tourError)}`);
  }
  if (!tour) {
    throw new Error('The published tour could not be verified. Pickup options are unavailable.');
  }
  if (!tour.pickup_available) {
    return [];
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from('tour_pickup_locations')
    .select('pickup_location_id')
    .eq('tour_id', tour.id);

  if (assignmentError) {
    throw new Error(`Unable to verify approved pickup locations: ${formatSupabaseError(assignmentError)}`);
  }

  const approvedLocationIds = new Set((assignments || []).map((assignment: any) => assignment.pickup_location_id));
  if (approvedLocationIds.size === 0) {
    return [];
  }

  const activeLocations = await getPickupLocations();
  return activeLocations
    .filter((location) => approvedLocationIds.has(location.id))
    .map((location) => ({
      id: location.code || location.id,
      name: location.name,
      area: location.area,
      feeEurPerPerson: Number(location.fee_eur_per_person) || 0,
      feeEurFlat: Number(location.fee_eur_flat) || 0,
      note: location.description || undefined,
      isPopular: location.code === 'hurghada-city' || location.sort_order === 1,
    }));
}

// In-memory / localStorage cache for tour-specific extra price overrides
const TOUR_EXTRA_PRICES_KEY = 'rse_tour_custom_extra_prices';

export function getTourCustomExtraPrices(tourId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${TOUR_EXTRA_PRICES_KEY}_${tourId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveTourCustomExtraPrices(tourId: string, prices: Record<string, number>): void {
  try {
    localStorage.setItem(`${TOUR_EXTRA_PRICES_KEY}_${tourId}`, JSON.stringify(prices));
  } catch (err) {
    console.warn('Failed to save tour custom extra prices to localStorage:', err);
  }
}

/**
 * Loads tour-specific extra price overrides directly from Supabase tour_assigned_extras.
 * Guarantees that prices configured in admin are visible across all devices and sessions.
 */
export async function fetchTourCustomExtraPricesFromDb(tourId: string): Promise<Record<string, number>> {
  if (!isSupabaseConfigured() || isSchemaMissing()) {
    if (import.meta.env.PROD) throw new Error('Tour-specific add-on pricing is unavailable because the live database could not be verified.');
    return getTourCustomExtraPrices(tourId);
  }

  const { data, error } = await supabase
    .from('tour_assigned_extras')
    .select('extra_id, custom_price_eur')
    .eq('tour_id', tourId)
    .not('custom_price_eur', 'is', null);

  if (error) {
    if (isSchemaMissingError(error)) setSchemaMissing(true);
    throw new Error(formatSupabaseError(error));
  }

  const dbPrices: Record<string, number> = {};
  (data || []).forEach((row: any) => {
    if (row.custom_price_eur !== null && row.custom_price_eur !== undefined) {
      dbPrices[row.extra_id] = Number(row.custom_price_eur);
    }
  });
  saveTourCustomExtraPrices(tourId, dbPrices);
  return dbPrices;
}

/**
 * Persists a tour-specific custom price override directly into Supabase tour_assigned_extras.
 */
export async function persistTourCustomExtraPriceToDb(
  tourId: string,
  extraId: string,
  priceEur: number | null
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured() || isSchemaMissing()) {
    if (!import.meta.env.DEV) {
      return { success: false, error: 'Supabase is not configured; add-on pricing cannot be saved in production.' };
    }
    const local = getTourCustomExtraPrices(tourId);
    if (priceEur === null) delete local[extraId];
    else local[extraId] = priceEur;
    saveTourCustomExtraPrices(tourId, local);
    notifyCatalogueDataChanged('extras');
    return { success: true };
  }

  try {
    if (priceEur === null) {
      const { error } = await supabase
        .from('tour_assigned_extras')
        .update({ custom_price_eur: null })
        .eq('tour_id', tourId)
        .eq('extra_id', extraId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('tour_assigned_extras')
        .upsert({
          tour_id: tourId,
          extra_id: extraId,
          custom_price_eur: priceEur,
        });
      if (error) throw error;
    }

    const local = getTourCustomExtraPrices(tourId);
    if (priceEur === null) delete local[extraId];
    else local[extraId] = priceEur;
    saveTourCustomExtraPrices(tourId, local);
    notifyCatalogueDataChanged('extras');
    return { success: true };
  } catch (error) {
    if (isSchemaMissingError(error)) setSchemaMissing(true);
    return { success: false, error: formatSupabaseError(error) };
  }
}

/**
 * Fetches active tour extras formatted for client checkout selection.
 * Authoritative: ONLY extras assigned to this specific tour (via tour_assigned_extras) are returned.
 * Inactive extras and extras belonging to unrelated tours are strictly excluded.
 */
export async function getPublishedTourExtras(tourIdOrSlug?: string): Promise<BookingExtra[]> {
  // If no tour is specified, return active catalogue extras
  if (!tourIdOrSlug) {
    const dbExtras = await getTourExtras();
    return dbExtras.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description || '',
      priceEur: Number(e.price_eur) || 0,
      pricingType: (e.pricing_type as any) || 'per_booking',
      imageUrl: (e as any).image_url || undefined,
      minQuantity: (e as any).min_quantity || 1,
      maxQuantity: (e as any).max_quantity || 10,
    }));
  }

  // Authoritative database-driven query for tour-specific assigned extras
  if (isSupabaseConfigured() && !isSchemaMissing()) {
    try {
      let targetTourId = tourIdOrSlug;
      if (!targetTourId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const { data: tourRow } = await supabase.from('tours').select('id, slug').eq('slug', tourIdOrSlug).maybeSingle();
        if (tourRow) {
          targetTourId = tourRow.id;
        }
      }

      if (targetTourId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const { data: assignedData, error: assignedErr } = await supabase
          .from('tour_assigned_extras')
          .select('extra_id, custom_price_eur, is_active, sort_order, tour_extras (*)')
          .eq('tour_id', targetTourId);

        if (assignedErr) {
          console.error('Failed to query tour_assigned_extras from Supabase:', formatSupabaseError(assignedErr));
          return [];
        }

        if (assignedData !== null) {
          // Explicit tour assignments in database: return ONLY active assigned extras.
          // If assignedData.length === 0, this tour has no assigned extras. Return [].
          return [...assignedData]
            .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((item: any) => {
              const extra = item.tour_extras;
              // Must be active in both catalog and tour assignment
              if (!extra || !extra.is_active || item.is_active === false) return null;
              
              // Database custom price takes priority over catalog base price
              const customPrice = item.custom_price_eur !== null && item.custom_price_eur !== undefined
                ? Number(item.custom_price_eur)
                : undefined;
              const finalPrice = customPrice !== undefined && !isNaN(customPrice)
                ? customPrice
                : Number(extra.price_eur) || 0;

              return {
                id: extra.id,
                name: extra.name,
                description: extra.description || '',
                priceEur: finalPrice,
                pricingType: extra.pricing_type || 'per_booking',
                imageUrl: extra.image_url || undefined,
                minQuantity: extra.min_quantity || 1,
                maxQuantity: extra.max_quantity || 10,
              };
            })
            .filter(Boolean) as BookingExtra[];
        }
      }
    } catch (err) {
      console.error('Error fetching tour_assigned_extras from Supabase:', err);
      return [];
    }
  }

  // When Supabase is not configured or offline, return empty list (do NOT substitute fake contextual add-ons)
  return [];
}

// ==============================================================================
// DYNAMIC REVIEWS SERVICE (GENUINE DATABASE-DRIVEN)
// ==============================================================================

export interface PublishedReviewsResult {
  reviews: Review[];
  averageRating: number;
  totalCount: number;
  recommendationRate: number;
  breakdown: { 5: number; 4: number; 3: number; 2: number; 1: number };
}

/**
 * Fetches all published customer reviews directly from Supabase public.reviews
 * No static mock testimonials or fabricated metrics are returned.
 */
export async function getPublishedReviews(tourSlug?: string): Promise<PublishedReviewsResult> {
  const emptyResult: PublishedReviewsResult = {
    reviews: [],
    averageRating: 0,
    totalCount: 0,
    recommendationRate: 0,
    breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  };

  if (!isSupabaseConfigured() || isSchemaMissing()) {
    return emptyResult;
  }

  try {
    const query = supabase
      .from('reviews')
      .select(`
        id,
        author_name,
        country,
        country_code,
        rating,
        comment,
        date,
        traveler_type,
        verified_booking,
        is_published,
        tours (id, title, slug)
      `)
      .eq('is_published', true)
      .order('date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      if (isSchemaMissingError(error)) {
        setSchemaMissing(true);
      }
      console.error('Failed to query published reviews:', formatSupabaseError(error));
      return emptyResult;
    }

    if (!data || data.length === 0) {
      return emptyResult;
    }

    let rawList = data;
    if (tourSlug) {
      rawList = rawList.filter((r: any) => r.tours?.slug === tourSlug);
    }

    const reviews: Review[] = rawList.map((r: any) => ({
      id: r.id,
      authorName: r.author_name,
      country: r.country || 'International',
      countryCode: r.country_code || 'DE',
      rating: Number(r.rating) || 5,
      date: r.date,
      tourTitle: r.tours?.title || 'Selected tour',
      tourSlug: r.tours?.slug || '',
      comment: r.comment || '',
      travelerType: r.traveler_type || 'Couple',
      verifiedBooking: !!r.verified_booking,
    }));

    const totalCount = reviews.length;
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sumRating = 0;
    let recommendedCount = 0;

    for (const rev of reviews) {
      const star = Math.min(5, Math.max(1, Math.round(rev.rating))) as 1 | 2 | 3 | 4 | 5;
      breakdown[star] = (breakdown[star] || 0) + 1;
      sumRating += rev.rating;
      if (rev.rating >= 4) {
        recommendedCount++;
      }
    }

    const averageRating = totalCount > 0 ? Number((sumRating / totalCount).toFixed(1)) : 0;
    const recommendationRate = totalCount > 0 ? Math.round((recommendedCount / totalCount) * 100) : 0;

    return {
      reviews,
      averageRating,
      totalCount,
      recommendationRate,
      breakdown,
    };
  } catch (err) {
    console.error('Published reviews exception:', err);
    return emptyResult;
  }
}

/**
 * Submits a new user review to public.reviews (saved as is_published: false for admin moderation)
 */
export async function submitTourReview(payload: {
  tourId?: string;
  tourSlug?: string;
  authorName: string;
  country?: string;
  countryCode?: string;
  rating: number;
  comment: string;
  travelerType?: 'Couple' | 'Family' | 'Solo' | 'Friends';
}): Promise<void> {
  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) {
    throw new Error('A customer review must include a rating from 1 to 5 stars.');
  }

  if (!isSupabaseConfigured() || isSchemaMissing()) {
    throw new Error('Customer reviews are temporarily unavailable because the live review database is not connected.');
  }

  let resolvedTourId = payload.tourId;
  if (!resolvedTourId && payload.tourSlug) {
    const { data } = await supabase.from('tours').select('id').eq('slug', payload.tourSlug).maybeSingle();
    if (data?.id) {
      resolvedTourId = data.id;
    }
  }

  const { error } = await supabase.from('reviews').insert({
    tour_id: resolvedTourId || null,
    author_name: payload.authorName,
    country: payload.country || 'International',
    country_code: payload.countryCode || 'DE',
    rating: payload.rating,
    comment: payload.comment,
    traveler_type: payload.travelerType || 'Couple',
    verified_booking: false,
    is_published: false,
    date: new Date().toISOString().split('T')[0],
  });

  if (error) {
    throw new Error(formatSupabaseError(error));
  }

  notifyCatalogueDataChanged('reviews');
}
