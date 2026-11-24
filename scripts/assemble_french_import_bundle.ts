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
    const protectedTokens = source.match(/\{\{[^{}]+\}\}|https?:\/\/[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+\d[\d\s()./-]{5,}\d|\d+(?:[.,]\d+)?/g) || [];
    return Boolean(translated.trim()) && protectedTokens.every((token) => translated.includes(token));
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
function describeStructureMismatch(source: any, translated: any, path = 'content'): string | null {
  if (typeof source === 'string') {
    if (typeof translated !== 'string') return path + ': expected text';
    if (source.trim() && !translated.trim()) return path + ': translation is empty';
    const protectedTokens = source.match(/\\{\\{[^{}]+\\}\\}|https?:\\/\\/[^\\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}|\\+\\d[\\d\\s()./-]{5,}\\d/g) || [];
    const missingToken = protectedTokens.find((token) => !translated.includes(token));
    if (missingToken) return path + ': protected token missing (' + missingToken + ')';
    return null;
  }
  if (Array.isArray(source)) {
    if (!Array.isArray(translated)) return path + ': expected array';
    if (source.length !== translated.length) return path + ': expected ' + source.length + ' rows, got ' + translated.length;
    for (let i = 0; i < source.length; i++) {
      const mismatch = describeStructureMismatch(source[i], translated[i], path + '[' + i + ']');
      if (mismatch) return mismatch;
    }
    return null;
  }
  if (isObject(source)) {
    if (!isObject(translated)) return path + ': expected object';
    const sourceKeys = Object.keys(source).sort(), translatedKeys = Object.keys(translated).sort();
    const missing = sourceKeys.filter((key) => !Object.prototype.hasOwnProperty.call(translated, key));
    const extra = translatedKeys.filter((key) => !Object.prototype.hasOwnProperty.call(source, key));
    if (missing.length) return path + ': missing keys ' + missing.join(', ');
    if (extra.length) return path + ': unexpected keys ' + extra.join(', ');
    for (const key of sourceKeys) {
      const mismatch = describeStructureMismatch(source[key], translated[key], path + '.' + key);
      if (mismatch) return mismatch;
    }
    return null;
  }
  return source === translated ? null : path + ': value type or value differs';
}
function uiCatalogStructureMatches(source: any, translated: any): boolean {
  if (typeof source === 'string') return typeof translated === 'string';
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
  const [sourcePath, outputPath = './translations/fr/french-import-bundle.json'] = process.argv.slice(2);
  if (!sourcePath) throw new Error('Usage: npm run translations:assemble-fr -- ./translation-source.json [./output.json]');
  const sourceBundle = JSON.parse(await readFile(sourcePath, 'utf8'));
  const draftBundle = JSON.parse(await readFile('./translations/fr/all-content.review-draft.json', 'utf8'));
  if (sourceBundle?.schema_version !== 1 || !Array.isArray(sourceBundle.records)) throw new Error('Unsupported authoritative source bundle.');
  if (draftBundle?.locale !== 'fr' || !Array.isArray(draftBundle.records)) throw new Error('French review bundle is missing or malformed.');
  const sources = new Map(sourceBundle.records.map((record: AnyRecord) => [record.entity_type + ':' + record.entity_key, record]));
  const output: AnyRecord[] = [];
  const slugs = new Set<string>();
  let skippedUnavailableSources = 0;
  for (const draft of draftBundle.records as AnyRecord[]) {
    const sourceRecord: AnyRecord | undefined = sources.get(draft.entity_type + ':' + draft.entity_key);
    if (!sourceRecord) {
      skippedUnavailableSources++;
      console.warn('Preserved but skipped unpublished or removed source draft: ' + draft.entity_type + ':' + draft.entity_key);
      continue;
    }
    if (!/^[a-f0-9]{64}$/i.test(sourceRecord.source_checksum || '')) {
      throw new Error('Current source record has no valid checksum: ' + draft.entity_type + ':' + draft.entity_key);
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
      throw new Error('Content structure/token mismatch: ' + (describeStructureMismatch(expected.content, payload.content, draft.entity_type + ':' + draft.entity_key + '.content') || 'unknown mismatch'));
    }
    const slug = normalizedSlug(draft.translated_slug, draft.entity_key);
    if (slugs.has(slug)) throw new Error('Duplicate French slug: ' + slug);
    slugs.add(slug);
    output.push({
      entity_type:draft.entity_type, entity_key:draft.entity_key, locale:'fr',
      translated_slug:slug, title:draft.title || null, summary:draft.summary || null,
      seo_title:draft.seo_title || null, seo_description:draft.seo_description || null,
      content:payload.content, source_checksum:sourceRecord.source_checksum,
    });
  }
  const sourceKeys = new Set(sourceBundle.records.map((record: AnyRecord) => record.entity_type + ':' + record.entity_key));
  const draftKeys = new Set(draftBundle.records.map((record: AnyRecord) => record.entity_type + ':' + record.entity_key));
  const missing = [...sourceKeys].filter((key) => !draftKeys.has(key));
  const unexpected = [...draftKeys].filter((key) => !sourceKeys.has(key));
  if (missing.length) throw new Error('Coverage mismatch. Current published source records are missing translations: ' + missing.join(', '));
  if (unexpected.length) console.warn('Drafts for unpublished or removed source records were preserved and excluded from this import: ' + unexpected.join(', '));
  await writeFile(outputPath, JSON.stringify({ schema_version:1, generated_at:new Date().toISOString(), locales:['fr'], records:output }, null, 2) + '\n');
  console.log('Assembled ' + output.length + ' French draft records with current source checksums; skipped ' + skippedUnavailableSources + ' unpublished or removed source drafts. Output: ' + outputPath + '. No database records were changed or published.');
}
await main();
