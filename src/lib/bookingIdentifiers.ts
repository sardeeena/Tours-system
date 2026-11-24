const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The database booking RPC accepts either a database UUID or a tour slug.
 * Static catalogue IDs (for example "tour-1") are not database IDs, so prefer
 * the stable slug whenever the supplied ID is not a UUID.
 */
export function resolveBookingTourIdentifier(
  tourId?: string | null,
  tourSlug?: string | null
): string {
  const id = String(tourId || '').trim();
  const slug = String(tourSlug || '').trim();

  if (id && UUID_PATTERN.test(id)) return id;
  return slug || id;
}

/**
 * Browser-local booking data is a development sandbox only. Production must
 * never fall back to a per-browser cache when Supabase is unconfigured or its
 * schema is unavailable.
 */
export function shouldUseLocalBookingCache(
  isDevelopment: boolean,
  isSupabaseConfigured: boolean,
  schemaMissing: boolean
): boolean {
  return isDevelopment && (!isSupabaseConfigured || schemaMissing);
}


const COMPACT_BOOKING_REFERENCE_PATTERN = /^AA[A-Z0-9]{7}$/;
const LEGACY_BOOKING_REFERENCE_PATTERNS = [
  /^AWE-\\d{8}-\\d{6}$/,
  /^RST-\\d{4}-[A-Z0-9]{4,32}$/,
  /^RSE-\\d{4,8}$/,
];

/** Format a globally unique, nine-character booking reference. */
export function formatBookingReference(bookingDate: string | Date, sequence: number): string {
  const dateText = bookingDate instanceof Date
    ? bookingDate.toISOString().slice(0, 10)
    : String(bookingDate || '').trim().slice(0, 10);
  const parsedDate = new Date(dateText + 'T00:00:00.000Z');
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateText) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateText) {
    throw new Error('A valid booking date is required to format a booking reference.');
  }
  const maxSequence = 36 ** 7 - 1;
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > maxSequence) {
    throw new Error(`Booking reference sequence must be between 1 and ${maxSequence}.`);
  }
  return 'AA' + sequence.toString(36).toUpperCase().padStart(7, '0');
}

/** Accept new references and all previously issued formats for existing bookings. */
export function isValidBookingReference(reference: string | null | undefined): boolean {
  if (typeof reference !== 'string') return false;
  const clean = reference.trim().toUpperCase();
  return COMPACT_BOOKING_REFERENCE_PATTERN.test(clean) ||
    LEGACY_BOOKING_REFERENCE_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Browser-side placeholder used for idempotency and local development only.
 * Production replaces it with the collision-safe database sequence value.
 */
export function generateLocalBookingReference(bookingDate: string | Date = new Date()): string {
  const random = new Uint32Array(1);
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random number generation is unavailable.');
  }
  globalThis.crypto.getRandomValues(random);
  const sequence = (random[0] % (36 ** 7 - 1)) + 1;
  return formatBookingReference(bookingDate, sequence);
}
