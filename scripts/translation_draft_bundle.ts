import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

type Locale = 'fr' | 'es' | 'nl' | 'pl' | 'pt';
type Draft = {
  entity_type: string; entity_key: string; locale: Locale; translated_slug?: string;
  title?: string; summary?: string; seo_title?: string; seo_description?: string;
  content: Record<string, unknown>; source_checksum: string;
};
const LOCALES = new Set<Locale>(['fr','es','nl','pl','pt']);
const stable = (value: any): string => {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
};
const checksum = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex');
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error('Set SUPABASE_URL and the server-only SUPABASE_SECRET_KEY (or legacy service-role key).');
if (supabaseKey.startsWith('sb_publishable_')) throw new Error('A publishable key cannot export or import translation data.');
const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });

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
  const settings = await rows('site_settings', q => q.eq('key','pages_content'));
  const raw = settings[0]?.value;
  const pages = Array.isArray(raw) ? raw : raw && Array.isArray(raw.pages) ? raw.pages : [];
  for (const source of pages.filter((p:any)=>p && p.slug && p.published !== false && !['draft','unpublished'].includes(p.status))) {
    bundle.push({ entity_type:'static_page', entity_key:String(source.id || source.slug), source_checksum:checksum(source), source });
  }
  await writeFile(path, JSON.stringify({ schema_version:1, generated_at:new Date().toISOString(), locales:['fr','es','nl','pl','pt'], records:bundle }, null, 2) + '\n');
  console.log('Exported '+bundle.length+' source records to '+path+' (tours '+tours.length+', blog '+posts.length+', destinations '+destinations.length+', CMS pages '+pages.length+').');
}
function sortRows(a:any,b:any) { return Number(a.sort_order||0)-Number(b.sort_order||0) || String(a.id||'').localeCompare(String(b.id||'')); }
async function currentSource(entityType:string, entityKey:string):Promise<any|null> {
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
    return pages.find((p:any)=>(String(p.id||p.slug)===entityKey||p.slug===entityKey)&&p.published!==false&&p.status!=='draft'&&p.status!=='unpublished')||null;
  }
  return null;
}
async function importDrafts(path: string, apply: boolean) {
  const parsed = JSON.parse(await readFile(path,'utf8'));
  if (parsed?.schema_version !== 1 || !Array.isArray(parsed.records)) throw new Error('Unsupported translation bundle schema.');
  let accepted=0, skipped=0;
  for (const item of parsed.records as Draft[]) {
    if (!LOCALES.has(item.locale) || !item.entity_type || !item.entity_key || !/^[a-f0-9]{64}$/i.test(item.source_checksum||'') || !item.content || typeof item.content !== 'object' || Array.isArray(item.content)) {
      skipped++; console.warn('Skipped invalid record', item?.entity_type, item?.entity_key, item?.locale); continue;
    }
    const source = await currentSource(item.entity_type,item.entity_key);
    if (!source || checksum(source)!==item.source_checksum) {
      skipped++; console.warn('Skipped missing or changed source (re-export and retranslate):',item.entity_type,item.entity_key,item.locale); continue;
    }
    const existing = await db.from('content_translations').select('translation_state,reviewed_at,published_at').eq('entity_type',item.entity_type).eq('entity_key',item.entity_key).eq('locale',item.locale).maybeSingle();
    if (existing.error) throw new Error('Existing translation lookup failed: '+existing.error.message);
    if (existing.data && (existing.data.translation_state==='published' || existing.data.reviewed_at || existing.data.published_at)) {
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
  console.log((apply?'Imported ':'Dry run: would import ')+accepted+' drafts; skipped '+skipped+'. No record was published.');
}
const [mode,path,flag] = process.argv.slice(2);
if (mode==='export' && path) await exportBundle(path);
else if (mode==='import' && path) await importDrafts(path,flag==='--apply');
else {
  console.log('Usage: npm run translations:export -- ./translation-source.json');
  console.log('       npm run translations:import -- ./translation-drafts.json [--apply]');
  console.log('Import defaults to dry-run. --apply writes draft rows only; reviewed/published rows are preserved.');
  process.exitCode=1;
}
