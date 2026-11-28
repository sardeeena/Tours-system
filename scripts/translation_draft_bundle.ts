import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { EuropeanLocaleCode } from '../src/types/i18n';
import { INITIAL_STATIC_PAGES } from '../src/data/staticPages';
import { TRANSLATIONS } from '../src/i18n/translations';
import { collectPrivateUiMessages } from './generate_private_ui_catalog';

type Locale = Exclude<EuropeanLocaleCode, 'en'>;
type Draft = {
  entity_type: string; entity_key: string; locale: Locale; translated_slug?: string;
  title?: string; summary?: string; seo_title?: string; seo_description?: string;
  content: Record<string, unknown>; source_checksum: string;
};
const LOCALES = new Set<Locale>(['de', 'it', 'ro', 'ru', 'fr', 'nl', 'pl', 'cs', 'sv', 'es']);
const ENTITY_TYPES = new Set(['tour','destination','blog_post','static_page','communication_template','ui_catalog']);
const stable = (value: any): string => {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
};
const checksum = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex');
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error('Set SUPABASE_URL and the server-only SUPABASE_SECRET_KEY (or legacy service-role key).');
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
if (projectRef !== 'uvtbtpxtrrmaublrztgv') throw new Error('Refusing to access any Supabase project other than AwesomeAdventure (uvtbtpxtrrmaublrztgv).');
const legacyPayload = supabaseKey.split('.')[1];
let legacyRole = '';
if (legacyPayload) {
  try { legacyRole = JSON.parse(Buffer.from(legacyPayload.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')).role || ''; } catch { legacyRole = ''; }
}
if (!supabaseKey.startsWith('sb_secret_') && legacyRole !== 'service_role') {
  throw new Error('A server-only Supabase secret key is required; anon/publishable keys are rejected.');
}
// Supabase/CDN gateways can transiently return 502/503/504 during read-only
// source validation. Retry only transient transport/server failures; never retry
// ordinary 4xx validation/authentication errors.
const fetchWithTransientRetry: typeof fetch = async (input, init) => {
  const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Bound each remote read so a stalled Supabase request cannot hang CI indefinitely.
      const timeoutSignal = AbortSignal.timeout(15_000);
      const requestSignal = init?.signal
        ? AbortSignal.any([init.signal, timeoutSignal])
        : timeoutSignal;
      const response = await fetch(input, { ...init, signal: requestSignal });
      if (!retryableStatuses.has(response.status) || attempt === maxAttempts) return response;
      await response.body?.cancel();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** (attempt - 1))));
  }
  throw new Error('Supabase request retry loop exhausted unexpectedly.');
};
const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithTransientRetry },
});

async function rows(table: string, configure: (q: any) => any = q => q) {
  const { data, error } = await configure(db.from(table).select('*'));
  if (error) throw new Error(table + ': ' + error.message);
  return data || [];
}
async function exportBundle(path: string) {
  const bundle: any[] = [];
  const tours = await rows('tours', q => q.eq('status','published'));
  for (const tour of tours) {
    const related = await Promise.all([
      rows('tour_itinerary', q => q.eq('tour_id',tour.id)),
      rows('tour_highlights', q => q.eq('tour_id',tour.id)),
      rows('tour_inclusions', q => q.eq('tour_id',tour.id)),
      rows('tour_exclusions', q => q.eq('tour_id',tour.id)),
      rows('tour_faqs', q => q.eq('tour_id',tour.id)),
    ]);
    const source = { ...tour, itinerary: related[0].sort(sortRows), highlights: related[1].sort(sortRows), included: related[2].sort(sortRows), excluded: related[3].sort(sortRows), faqs: related[4].sort(sortRows) };
    bundle.push({ entity_type:'tour', entity_key:String(tour.id), source_checksum:checksum(source), source });
  }
  const destinations = await rows('destinations', q => q.eq('status','published'));
  for (const source of destinations) bundle.push({ entity_type:'destination', entity_key:String(source.id), source_checksum:checksum(source), source });
  const posts = await rows('blog_posts', q => q.in('status',['published','scheduled']).lte('published_at',new Date().toISOString()));
  for (const source of posts) bundle.push({ entity_type:'blog_post', entity_key:String(source.id), source_checksum:checksum(source), source });
  bundle.push({ entity_type:'static_page', entity_key:'home', source_checksum:checksum({ id:'home', slug:'home', title:'Explore Egypt’s Red Sea Coast', heroHeadline:'Explore Egypt’s Red Sea Coast', heroSubtitle:'Boat trips, island visits, snorkeling, diving and desert safaris across Egypt’s Red Sea coast.', sections:[] }), source:{ id:'home', slug:'home', title:'Explore Egypt’s Red Sea Coast', heroHeadline:'Explore Egypt’s Red Sea Coast', heroSubtitle:'Boat trips, island visits, snorkeling, diving and desert safaris across Egypt’s Red Sea coast.', sections:[] } });
  const templates = await rows('communication_templates', q => q.eq('locale','en'));
  for (const source of templates) bundle.push({ entity_type:'communication_template', entity_key:String(source.id), source_checksum:checksum(source), source });
  const uiSource = { id:'site-ui', slug:'site-ui', title:'Interface messages', content:{ ...TRANSLATIONS.en, ...collectPrivateUiMessages() } };
  bundle.push({ entity_type:'ui_catalog', entity_key:'site-ui', source_checksum:checksum(uiSource), source:uiSource });
  const settings = await rows('site_settings', q => q.eq('key','pages_content'));
  const raw = settings[0]?.value;
  const pages = Array.isArray(raw) ? raw : raw && Array.isArray(raw.pages) ? raw.pages : [];
  const publishedPages = pages.filter((p:any)=>p && p.slug && p.published !== false && !['draft','unpublished'].includes(p.status));
  for (const source of publishedPages) bundle.push({ entity_type:'static_page', entity_key:String(source.id || source.slug), source_checksum:checksum(source), source });
  for (const source of INITIAL_STATIC_PAGES) {
    const key = String(source.id || source.slug);
    if (!bundle.some((item) => item.entity_type==='static_page' && item.entity_key===key)) {
      bundle.push({ entity_type:'static_page', entity_key:key, source_checksum:checksum(source), source });
    }
  }
  await writeFile(path, JSON.stringify({ schema_version:1, generated_at:new Date().toISOString(), locales:[...LOCALES], records:bundle }, null, 2) + '\n');
  console.log('Exported '+bundle.length+' source records to '+path+' (tours '+tours.length+', blog '+posts.length+', destinations '+destinations.length+', CMS pages '+pages.length+').');
}
function sortRows(a:any,b:any) { return Number(a.sort_order||0)-Number(b.sort_order||0) || String(a.id||'').localeCompare(String(b.id||'')); }
async function currentSource(entityType:string, entityKey:string):Promise<any|null> {
  if (entityType==='ui_catalog' && entityKey==='site-ui') {
    return { id:'site-ui', slug:'site-ui', title:'Interface messages', content:{ ...TRANSLATIONS.en, ...collectPrivateUiMessages() } };
  }
  if (entityType==='communication_template') {
    const {data,error}=await db.from('communication_templates').select('*').eq('id',entityKey).eq('locale','en').maybeSingle();
    if(error) throw error; return data||null;
  }
  if (entityType==='tour') {
    const {data,error}=await db.from('tours').select('*').eq('id',entityKey).eq('status','published').maybeSingle();
    if(error) throw error; if(!data) return null;
    const related=await Promise.all([
      rows('tour_itinerary',q=>q.eq('tour_id',entityKey)), rows('tour_highlights',q=>q.eq('tour_id',entityKey)),
      rows('tour_inclusions',q=>q.eq('tour_id',entityKey)), rows('tour_exclusions',q=>q.eq('tour_id',entityKey)),
      rows('tour_faqs',q=>q.eq('tour_id',entityKey)),
    ]);
    return {...data,itinerary:related[0].sort(sortRows),highlights:related[1].sort(sortRows),included:related[2].sort(sortRows),excluded:related[3].sort(sortRows),faqs:related[4].sort(sortRows)};
  }
  if(entityType==='destination'||entityType==='blog_post') {
    const table=entityType==='destination'?'destinations':'blog_posts';
    let q=db.from(table).select('*').eq('id',entityKey);
    q=entityType==='destination'?q.eq('status','published'):q.in('status',['published','scheduled']).lte('published_at',new Date().toISOString());
    const {data,error}=await q.maybeSingle(); if(error) throw error; return data||null;
  }
  if(entityType==='static_page' && entityKey==='home') return { id:'home', slug:'home', title:'Explore Egypt’s Red Sea Coast', heroHeadline:'Explore Egypt’s Red Sea Coast', heroSubtitle:'Boat trips, island visits, snorkeling, diving and desert safaris across Egypt’s Red Sea coast.', sections:[] };
  if(entityType==='static_page') {
    const {data,error}=await db.from('site_settings').select('value').eq('key','pages_content').maybeSingle();
    if(error) throw error;
    const raw=data?.value; const pages=Array.isArray(raw)?raw:raw&&Array.isArray(raw.pages)?raw.pages:[];
    const page = pages.find((p:any)=>(String(p.id||p.slug)===entityKey||p.slug===entityKey)&&p.published!==false&&p.status!=='draft'&&p.status!=='unpublished');
    return page || INITIAL_STATIC_PAGES.find((p:any)=>String(p.id||p.slug)===entityKey || p.slug===entityKey) || null;
  }
  return null;
}
async function importDrafts(path: string, apply: boolean, strict: boolean = false) {
  if (strict && apply) throw new Error('--strict is validation-only and cannot be combined with --apply.');
  const parsed = JSON.parse(await readFile(path,'utf8'));
  if (parsed?.schema_version !== 1 || !Array.isArray(parsed.records)) throw new Error('Unsupported translation bundle schema.');
  let accepted=0, skipped=0;
  for (const item of parsed.records as Draft[]) {
    if (!LOCALES.has(item.locale) || !ENTITY_TYPES.has(item.entity_type) || !item.entity_key || !/^[a-f0-9]{64}$/i.test(item.source_checksum||'') || !item.content || typeof item.content !== 'object' || Array.isArray(item.content)) {
      skipped++; console.warn('Skipped invalid record', item?.entity_type, item?.entity_key, item?.locale); continue;
    }
    const source = await currentSource(item.entity_type,item.entity_key);
    if (!source || checksum(source)!==item.source_checksum) {
      skipped++; console.warn('Skipped missing or changed source (re-export and retranslate):',item.entity_type,item.entity_key,item.locale); continue;
    }
    const existing = await db.from('content_translations').select('translation_state,reviewed_at,published_at').eq('entity_type',item.entity_type).eq('entity_key',item.entity_key).eq('locale',item.locale).maybeSingle();
    if (existing.error) throw new Error('Existing translation lookup failed: '+existing.error.message);
    if (existing.data && (existing.data.translation_state!=='draft' || existing.data.reviewed_at || existing.data.published_at)) {
      skipped++; console.warn('Preserved reviewed/published record:',item.entity_type,item.entity_key,item.locale); continue;
    }
    if (apply) {
      const record = { entity_type:item.entity_type, entity_key:item.entity_key, locale:item.locale,
        translated_slug:item.translated_slug || null, title:item.title || null, summary:item.summary || null,
        seo_title:item.seo_title || null, seo_description:item.seo_description || null,
        content:item.content, source_checksum:item.source_checksum, translation_state:'draft',
        reviewed_by:null, reviewed_at:null, published_at:null, updated_at:new Date().toISOString() };
      const { error } = await db.from('content_translations').upsert(record,{onConflict:'entity_type,entity_key,locale'});
      if (error) throw new Error('Draft upsert failed: '+error.message);
    }
    accepted++;
  }
  if (strict && skipped > 0) {
    throw new Error('Strict translation validation failed: ' + skipped + ' record(s) were skipped. Resolve every invalid, stale, missing-source, reviewed or published record before continuing.');
  }
  console.log((apply?'Imported ':'Dry run: would import ')+accepted+' drafts; skipped '+skipped+'. No record was published.');
}
const [mode,path,...flags] = process.argv.slice(2);
const apply = flags.includes('--apply');
const strict = flags.includes('--strict');
if (mode==='export' && path) await exportBundle(path);
else if (mode==='import' && path) await importDrafts(path,apply,strict);
else {
  console.log('Usage: npm run translations:export -- ./translation-source.json');
  console.log('       npm run translations:import -- ./translation-drafts.json [--strict] [--apply]');
  console.log('Import defaults to dry-run. --strict fails if any record would be skipped. --apply writes draft rows only; reviewed/published rows are preserved.');
  process.exitCode=1;
}
