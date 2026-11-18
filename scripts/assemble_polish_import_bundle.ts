import { readFile, writeFile } from 'node:fs/promises';

type AnyRecord = Record<string, any>;
const isObject = (value: unknown): value is AnyRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
function normalizedSlug(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
  return raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160)
    || fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160)
    || 'page';
}
function translationStructureMatches(source: any, translated: any): boolean {
  if (typeof source === 'string') {
    if (typeof translated !== 'string') return false;
    if (!source.trim()) return !translated.trim();
    const protectedTokens = source.match(/\{\{[^{}]+\}\}|https?:\/\/[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+\d[\d\s()./-]{5,}\d/g) || [];
    if (!Boolean(translated.trim()) || !protectedTokens.every((token) => translated.includes(token))) return false;
    const numericTokens = source.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
    const translatedNumbers = translated.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
    const digitsOnly = (value: string) => value.replace(/\D/g, '');
    return numericTokens.every((token) => translatedNumbers.some((candidate) => digitsOnly(candidate) === digitsOnly(token)));
  }
  if (Array.isArray(source)) return Array.isArray(translated) && source.length === translated.length
    && source.every((value, index) => translationStructureMatches(value, translated[index]));
  if (isObject(source)) {
    if (!isObject(translated)) return false;
    const a = Object.keys(source).sort(), b = Object.keys(translated).sort();
    return a.length === b.length && a.every((key, index) => key === b[index] && translationStructureMatches(source[key], translated[key]));
  }
  return source === translated;
}
function uiCatalogStructureMatches(source: any, translated: any): boolean {
  if (typeof source === 'string') {
    if (typeof translated !== 'string') return false;
    if (!source.trim()) return true;
    if (!translated.trim()) return false;
    const protectedTokens = source.match(/\{\{[^{}]+\}\}|https?:\/\/[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+\d[\d\s()./-]{5,}\d/g) || [];
    const numericTokens = source.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
    const translatedNumbers = translated.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
    const digitsOnly = (value: string) => value.replace(/\D/g, '');
    return protectedTokens.every((token) => translated.includes(token)) &&
      numericTokens.every((token) => translatedNumbers.some((candidate) => digitsOnly(candidate) === digitsOnly(token)));
  }
  if (Array.isArray(source)) return Array.isArray(translated) && source.length === translated.length &&
    source.every((value, index) => uiCatalogStructureMatches(value, translated[index]));
  if (isObject(source)) {
    if (!isObject(translated)) return false;
    const a = Object.keys(source).sort(), b = Object.keys(translated).sort();
    return a.length === b.length && a.every((key, index) => key === b[index] && uiCatalogStructureMatches(source[key], translated[key]));
  }
  return source === translated;
}
function mergeRows(sourceRows: any[], translatedRows: any[], fields: string[], label: string): any[] {
  if (!Array.isArray(sourceRows) || !Array.isArray(translatedRows) || sourceRows.length !== translatedRows.length) {
    throw new Error(label + ' row count does not match the live source (' + (sourceRows?.length ?? 'not-array') + ' vs ' + (translatedRows?.length ?? 'not-array') + ').');
  }
  return sourceRows.map((sourceRow, index) => {
    const translatedRow = translatedRows[index];
    const result = { ...sourceRow };
    if (typeof translatedRow === 'string') {
      const field = Object.prototype.hasOwnProperty.call(sourceRow, 'item') ? 'item' : fields[0];
      result[field] = translatedRow;
      return result;
    }
    if (!isObject(translatedRow)) throw new Error(label + ' row ' + index + ' is not an object or string.');
    for (const field of fields) if (Object.prototype.hasOwnProperty.call(sourceRow, field)) result[field] = translatedRow[field];
    return result;
  });
}
function expectedPayload(type: string, source: AnyRecord): AnyRecord {
  if (type === 'ui_catalog') return { content: source.content || {} };
  if (type === 'tour') return {
    title: source.title, summary: source.short_description || source.description || '',
    content: {
      title:source.title, description:source.description || source.short_description || '', durationLabel:source.duration || '',
      highlights:(source.highlights || []).map((x:any)=>x.item || x), itinerary:source.itinerary || [],
      included:source.included || [], excluded:source.excluded || [], faqs:source.faqs || [],
      pickupInfo:source.pickup_info || '', cancellationPolicy:source.cancellation_policy || '',
      ageRestrictions:source.age_restrictions || '',
      labels:{highlights:'Highlights',itinerary:'Itinerary',included:'Included',excluded:'Not included',faqs:'Frequently asked questions',
        pickupInfo:'Pickup information',cancellationPolicy:'Cancellation policy',ageRestrictions:'Age restrictions',
        bookNow:'Book now',browseMore:'Browse more tours'},
    },
  };
  if (type === 'destination') return {
    title:source.name || source.title, summary:source.tagline || source.description || '',
    content:{title:source.name || source.title,description:source.description || '',tagline:source.tagline || '',
      paragraphs:[],labels:{browseMore:'Explore more destinations'}},
  };
  if (type === 'blog_post') return {
    title:source.title, summary:source.excerpt || source.meta_description || '',
    content:{title:source.title,excerpt:source.excerpt || '',content:source.content || source.body || ''},
  };
  if (type === 'communication_template') return {
    title:source.name, summary:source.subject || '',
    content:{name:source.name,subject:source.subject || '',body_text:source.body_text || '',
      variables:source.variables || {},channel:source.channel,template_key:source.template_key},
  };
  return {
    title:source.title || source.name || 'Explore the Red Sea',
    summary:source.heroSubtitle || source.description || source.excerpt || '',
    content:{heroHeadline:source.heroHeadline || source.title || '',
      heroSubtitle:source.heroSubtitle || source.description || '',sections:source.sections || [],paragraphs:source.paragraphs || [],
      labels:{browseMore:'Explore more',bookNow:'Book now'}},
  };
}
function translatedPayload(type: string, source: AnyRecord, draft: AnyRecord): AnyRecord {
  if (type === 'ui_catalog') return { content:draft.content };
  if (type === 'tour') {
    const content = draft.content || {};
    return {
      title:draft.title, summary:draft.summary,
      content:{
        title:content.title,description:content.description,durationLabel:content.durationLabel,
        highlights:content.highlights,
        itinerary:mergeRows(source.itinerary || [],content.itinerary || [],['time','title','description'],'tour itinerary'),
        included:mergeRows(source.included || [],content.included || [],['item'],'tour inclusions'),
        excluded:mergeRows(source.excluded || [],content.excluded || [],['item'],'tour exclusions'),
        faqs:mergeRows(source.faqs || [],content.faqs || [],['question','answer','section'],'tour FAQs'),
        pickupInfo:content.pickupInfo,cancellationPolicy:content.cancellationPolicy,ageRestrictions:content.ageRestrictions,labels:content.labels,
      },
    };
  }
  if (type === 'destination') return {title:draft.title,summary:draft.summary,content:draft.content};
  if (type === 'blog_post') return {title:draft.title,summary:draft.summary,content:draft.content};
  if (type === 'communication_template') return {
    title:draft.title,summary:draft.summary,
    content:{name:draft.content.name,subject:draft.content.subject,body_text:draft.content.body_text,
      variables:source.variables || {},channel:source.channel,template_key:source.template_key},
  };
  return {title:draft.title,summary:draft.summary,content:draft.content};
}
async function main() {
  const [sourcePath, outputPath = './translations/pl/polish-import-bundle.json'] = process.argv.slice(2);
  if (!sourcePath) throw new Error('Usage: npm run translations:assemble-pl -- ./translation-source.json [./output.json]');
  const sourceBundle = JSON.parse(await readFile(sourcePath, 'utf8'));
  const draftBundle = JSON.parse(await readFile('./translations/pl/all-content.review-draft.json', 'utf8'));
  if (sourceBundle?.schema_version !== 1 || !Array.isArray(sourceBundle.records)) throw new Error('Unsupported authoritative source bundle.');
  if (draftBundle?.locale !== 'pl' || !Array.isArray(draftBundle.records)) throw new Error('Polish review bundle is missing or malformed.');
  const sources = new Map(sourceBundle.records.map((record: AnyRecord) => [record.entity_type + ':' + record.entity_key, record]));
  const output: AnyRecord[] = [];
  const slugs = new Set<string>();
  for (const draft of draftBundle.records as AnyRecord[]) {
    const sourceRecord: AnyRecord | undefined = sources.get(draft.entity_type + ':' + draft.entity_key);
    if (!sourceRecord || !/^[a-f0-9]{64}$/i.test(sourceRecord.source_checksum || '')) {
      throw new Error('Missing current source record or checksum: ' + draft.entity_type + ':' + draft.entity_key);
    }
    const expected = expectedPayload(draft.entity_type, sourceRecord.source);
    const payload = translatedPayload(draft.entity_type, sourceRecord.source, draft);
    if (expected.title !== undefined && !translationStructureMatches(expected.title, payload.title)) {
      throw new Error('Title structure/token mismatch: ' + draft.entity_type + ':' + draft.entity_key);
    }
    if (expected.summary !== undefined && !translationStructureMatches(expected.summary, payload.summary)) {
      throw new Error('Summary structure/token mismatch: ' + draft.entity_type + ':' + draft.entity_key);
    }
    if (!(draft.entity_type === 'ui_catalog' ? uiCatalogStructureMatches(expected.content, payload.content) : translationStructureMatches(expected.content, payload.content))) {
      throw new Error('Content structure/token mismatch: ' + draft.entity_type + ':' + draft.entity_key);
    }
    const slug = normalizedSlug(draft.translated_slug, draft.entity_key);
    if (slugs.has(slug)) throw new Error('Duplicate Polish slug: ' + slug);
    slugs.add(slug);
    output.push({
      entity_type:draft.entity_type, entity_key:draft.entity_key, locale:'pl',
      translated_slug:slug, title:draft.title || null, summary:draft.summary || null,
      seo_title:draft.seo_title || null, seo_description:draft.seo_description || null,
      content:payload.content, source_checksum:sourceRecord.source_checksum,
    });
  }
  const sourceKeys = new Set(sourceBundle.records.map((record: AnyRecord) => record.entity_type + ':' + record.entity_key));
  const draftKeys = new Set(draftBundle.records.map((record: AnyRecord) => record.entity_type + ':' + record.entity_key));
  const missing = [...sourceKeys].filter((key) => !draftKeys.has(key));
  const unexpected = [...draftKeys].filter((key) => !sourceKeys.has(key));
  if (missing.length || unexpected.length) throw new Error('Coverage mismatch. Missing: ' + missing.join(', ') + '; unexpected: ' + unexpected.join(', '));
  await writeFile(outputPath, JSON.stringify({ schema_version:1, generated_at:new Date().toISOString(), locales:['pl'], records:output }, null, 2) + '\n');
  console.log('Assembled ' + output.length + ' Polish draft records with current source checksums. Output: ' + outputPath + '. No database records were changed or published.');
}
await main();
