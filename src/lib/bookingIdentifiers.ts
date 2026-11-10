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
