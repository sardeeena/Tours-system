export const EXPECTED_KEMET_SUPABASE_PROJECT_REF = 'mktrtoctcjyokclpdeui';

/**
 * Production Awesome Adventure Tours clients must connect only to the configured AwesomeAdventureTours
 * Spirit Supabase project. Development may use a separate hosted Supabase
 * project or a local Supabase stack for isolated testing.
 */
export function isExpectedKemetSupabaseUrl(
  url: string | null | undefined,
  allowNonProductionProject = false
): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);

    if (allowNonProductionProject) {
      if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co')) {
        return true;
      }
      return parsed.protocol === 'http:' &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    }

    return parsed.protocol === 'https:' &&
      parsed.hostname === `${EXPECTED_KEMET_SUPABASE_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}
