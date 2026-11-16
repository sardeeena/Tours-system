import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const server = read('../server.ts');
const app = read('../src/App.tsx');
const locales = read('../src/types/i18n.ts');
const migration = read('../supabase/migrations/20261116150000_european_localization_foundation.sql');

assert.match(server, /currentTour = data && data\.slug === slug \? data : null/, 'SSR refuses a tour record whose slug differs from the requested URL');
assert.match(server, /CDN-Cache-Control', 'no-store'/, 'Tour detail HTML bypasses intermediary CDN caches');
assert.match(server, /Surrogate-Control', 'no-store'/, 'Tour detail HTML bypasses surrogate caches');
assert.match(server, /isTourDetailRoute/, 'Cache bypass is scoped to public tour detail routes');
assert.match(app, /key=\{tourDetailSlug\}/, 'Tour detail component state is reset when the route slug changes');

for (const locale of ['fr', 'es', 'nl', 'pl', 'pt', 'sv', 'da', 'nb', 'fi', 'el', 'bg', 'hr', 'cs', 'sk', 'sl', 'hu', 'et', 'lv', 'lt', 'uk', 'sr', 'sq', 'tr', 'ar']) {
  assert.match(locales, new RegExp(`code: '${locale}'`), `Locale registry includes ${locale}`);
}
assert.match(locales, /rollout: 'planned'/, 'New languages are explicitly planned rather than falsely marked translated');
assert.match(locales, /direction: 'rtl'/, 'RTL direction is represented in locale metadata');
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.content_translations/, 'Translation content schema exists');
assert.match(migration, /ALTER TABLE public\.bookings[\s\S]*customer_locale/, 'Booking customer locale is separate from guide language');
assert.match(migration, /ADD COLUMN IF NOT EXISTS preferred_locale/, 'Customer communication preference is persisted');
assert.match(migration, /ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'/, 'Communication templates are locale-aware');
assert.match(migration, /ENABLE ROW LEVEL SECURITY/, 'Translation content is protected by RLS');
assert.match(migration, /REVOKE ALL ON TABLE public\.content_translations FROM PUBLIC, anon, authenticated/, 'Translation drafts are not exposed to public or authenticated Data API roles');
assert.match(migration, /CREATE TRIGGER trg_capture_business_audit[\s\S]*private\.capture_business_audit\(\)/, 'Translation lifecycle changes use the private business audit trigger');
console.log('Public tour cache isolation and European localization foundation checks passed.');
