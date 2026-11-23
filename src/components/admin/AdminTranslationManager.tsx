import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileText, Globe, Loader2, Save, Send } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { EUROPEAN_LOCALE_ROLLOUT } from '../../types/i18n';
import { useToast } from '../../contexts/ToastContext';

type LocaleSummary = { draft: number; review: number; published: number; outdated: number; total: number };

const ROLLOUT_LOCALES = EUROPEAN_LOCALE_ROLLOUT.filter((item) => item.code !== 'en');

type TranslationRow = {
  id: string; entity_type: string; entity_key: string; locale: string;
  translated_slug: string | null; title: string | null; summary: string | null;
  content: Record<string, unknown>; seo_title: string | null; seo_description: string | null;
  source_checksum: string | null; translation_state: 'draft' | 'review' | 'published' | 'outdated';
};

const ENTITY_TYPES = ['tour', 'tour_itinerary', 'tour_highlight', 'tour_inclusion', 'tour_exclusion', 'tour_faq', 'destination', 'blog_post', 'static_page', 'communication_template', 'ui_catalog'];

export const AdminTranslationManager: React.FC = () => {
  const { showToast } = useToast();
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [entityType, setEntityType] = useState('tour');
  const [entityKey, setEntityKey] = useState('');
  const [locale, setLocale] = useState('');
  const [localeSummary, setLocaleSummary] = useState<Record<string, LocaleSummary>>({});
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [sourceChecksum, setSourceChecksum] = useState('');
  const [contentJson, setContentJson] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [confirmGenerateAll, setConfirmGenerateAll] = useState(false);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Your secure admin session has expired. Sign in again.');
    const response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(init?.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) throw new Error(payload.error || 'Translation service request failed.');
    return payload;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const summaryResult = await request('/api/admin/translations?summary=true');
      setLocaleSummary(summaryResult.locale_summary || {});
      if (!locale) {
        setRows([]);
        setSelectedId('');
        return;
      }
      const result = await request('/api/admin/translations?locale=' + encodeURIComponent(locale));
      setRows(result.translations || []);
    } catch (error: any) {
      showToast(error.message || 'Could not load translations.', 'error');
    } finally { setLoading(false); }
  }, [locale, request, showToast]);

  useEffect(() => { void load(); }, [load]);

  const selectRow = (row: TranslationRow) => {
    setSelectedId(row.id);
    setEntityType(row.entity_type); setEntityKey(row.entity_key); setLocale(row.locale);
    setTitle(row.title || ''); setSlug(row.translated_slug || ''); setSummary(row.summary || '');
    setSeoTitle(row.seo_title || ''); setSeoDescription(row.seo_description || '');
    setSourceChecksum(row.source_checksum || '');
    setContentJson(JSON.stringify(row.content || {}, null, 2));
  };

  const loadSource = async () => {
    if (!entityKey.trim()) {
      showToast('Enter the source record key first.', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await request('/api/admin/translations/source?entity_type=' + encodeURIComponent(entityType) + '&entity_key=' + encodeURIComponent(entityKey.trim()));
      setSourceChecksum(result.source_checksum || '');
      if (result.source?.title && !title) setTitle(result.source.title);
      if (result.source?.summary && !summary) setSummary(result.source.summary);
      setContentJson(JSON.stringify(result.source?.content || {}, null, 2));
      showToast('Current source loaded and its SHA-256 checksum verified.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Could not load source record.', 'error');
    } finally { setLoading(false); }
  };

  const generateSelectedLocale = async () => {
    setGenerating(true);
    setGenerationProgress('Preparing translation batches…');
    const targetLocale = locale;
    let generatedCount = 0;
    let skippedCount = 0;
    try {
      let offset = 0;
      let done = false;
      while (!done) {
        const result = await request('/api/admin/translations/generate-batch', {
          method: 'POST',
          body: JSON.stringify({ locale: targetLocale, offset, limit: 10 }),
        });
        offset = result.next_offset;
        done = Boolean(result.done);
        generatedCount += Number(result.processed || 0);
        skippedCount += Number(result.skipped || 0);
        setGenerationProgress(targetLocale.toUpperCase() + ': ' + offset + '/' + result.total + ' source records · ' + generatedCount + ' drafts saved · ' + skippedCount + ' skipped · selected locale');
        if (!done) {
          await new Promise(resolve => window.setTimeout(resolve, 6500));
        }
      }
      const result = await request('/api/admin/translations?locale=' + encodeURIComponent(targetLocale));
      setRows(result.translations || []);
      if (skippedCount > 0) {
        showToast('Draft generation finished with ' + skippedCount + ' skipped records. Retry to fill any missing items; nothing was published.', 'info');
        setGenerationProgress('Finished: ' + generatedCount + ' ' + targetLocale.toUpperCase() + ' drafts saved, ' + skippedCount + ' skipped. Retry if any records are missing; review all drafts before publication.');
      } else {
        showToast(targetLocale.toUpperCase() + ' translation draft generation completed. All generated records remain drafts pending human review.', 'success');
        setGenerationProgress('Completed ' + targetLocale.toUpperCase() + ': ' + generatedCount + ' drafts saved. Review before publication.');
      }
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Bulk translation generation stopped. You can safely retry.';
      showToast(message, 'error');
      setGenerationProgress('Stopped safely: ' + message + ' Existing reviewed/published records are preserved. Retry after the issue is resolved.');
    } finally {
      setGenerating(false);
    }
  };

  const save = async (state: 'draft' | 'review' | 'published') => {
    if (!locale || !entityKey.trim() || !sourceChecksum.trim()) {
      showToast('A source record key and source checksum are required before saving.', 'error'); return;
    }
    let parsedContent: Record<string, unknown>;
    try {
      const parsed = JSON.parse(contentJson);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
      parsedContent = parsed;
    } catch {
      showToast('Content must be valid JSON object data.', 'error'); return;
    }
    if (state === 'published' && !window.confirm('Publish this human-reviewed translation? Content routes and UI catalogs are exposed only after source-checksum and completeness verification.')) return;
    setSaving(true);
    try {
      const result = await request('/api/admin/translations', {
        method: 'POST',
        body: JSON.stringify({
          entity_type: entityType, entity_key: entityKey, locale, title, translated_slug: slug,
          summary, seo_title: seoTitle, seo_description: seoDescription,
          source_checksum: sourceChecksum, content: parsedContent, translation_state: state,
          confirm_publish: state === 'published',
        }),
      });
      showToast(state === 'published' ? 'Translation marked published.' : state === 'review' ? 'Translation submitted for review.' : 'Draft saved.', 'success');
      await load();
      if (result.translation) selectRow(result.translation);
    } catch (error: any) {
      showToast(error.message || 'Could not save translation.', 'error');
    } finally { setSaving(false); }
  };


  // Run the existing protected, resumable draft endpoint for every agreed locale.
  // Each locale remains draft-only; the public publication gate is unchanged.
  const generateAllLocales = async () => {
    setGenerating(true);
    let totalGenerated = 0;
    let totalSkipped = 0;
    try {
      for (const target of ROLLOUT_LOCALES) {
        let offset = 0;
        let done = false;
        let localeGenerated = 0;
        let localeSkipped = 0;
        setGenerationProgress('Starting ' + target.code.toUpperCase() + ' of ' + ROLLOUT_LOCALES.length + ' languages…');
        while (!done) {
          const result = await request('/api/admin/translations/generate-batch', {
            method: 'POST',
            body: JSON.stringify({ locale: target.code, offset, limit: 10 }),
          });
          offset = Number(result.next_offset || 0);
          done = Boolean(result.done);
          localeGenerated += Number(result.processed || 0);
          localeSkipped += Number(result.skipped || 0);
          totalGenerated += Number(result.processed || 0);
          totalSkipped += Number(result.skipped || 0);
          setGenerationProgress(
            target.code.toUpperCase() + ' (' + (ROLLOUT_LOCALES.findIndex(x => x.code === target.code) + 1) +
            '/' + ROLLOUT_LOCALES.length + '): ' + offset + '/' + result.total +
            ' source records · ' + localeGenerated + ' drafts saved · ' + localeSkipped +
            ' skipped. Overall: ' + totalGenerated + ' drafts saved.'
          );
          // Stay below the server's per-user generation rate limit, including
          // the boundary between locales. The operation is safe to retry.
          await new Promise(resolve => window.setTimeout(resolve, 6500));
        }
        const localeResult = await request('/api/admin/translations?locale=' + encodeURIComponent(target.code));
        if (locale === target.code) setRows(localeResult.translations || []);
      }
      const summaryResult = await request('/api/admin/translations?summary=true');
      setLocaleSummary(summaryResult.locale_summary || {});
      showToast('All ten language draft-generation runs completed. Nothing was published; human review is still required.', 'success');
      setGenerationProgress('Completed all ten languages: ' + totalGenerated + ' drafts saved, ' + totalSkipped + ' existing or ineligible records skipped. Review every language before publication.');
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Bulk translation generation stopped.';
      showToast(message, 'error');
      setGenerationProgress('Stopped safely after ' + totalGenerated + ' drafts and ' + totalSkipped + ' skipped records: ' + message + ' Retry safely from the beginning; reviewed and published records are preserved.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 text-stone-100">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Globe className="h-6 w-6 text-teal-400" /> Translation workspace</h1>
          <p className="mt-1 text-sm text-stone-400">Super Admin + verified MFA required. Drafts never appear on public pages.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfirmGenerateAll(true)} disabled={generating || loading || saving} className="rounded bg-indigo-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{generating && !confirmGenerate ? 'Generating all languages…' : 'Generate all 10 languages'}</button>
          <button type="button" onClick={() => setConfirmGenerate(true)} disabled={generating || loading || saving || !locale} className="rounded bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{generating ? 'Generating ' + locale.toUpperCase() + ' drafts…' : 'Generate ' + locale.toUpperCase() + ' drafts'}</button>
          <button onClick={() => void load()} disabled={loading || generating} className="rounded border border-stone-700 px-3 py-2 text-sm disabled:opacity-50">{loading ? 'Loading…' : 'Refresh records'}</button>
        </div>
      </header>
      {confirmGenerateAll && !generating && <div role="dialog" aria-modal="true" aria-labelledby="translation-generate-all-title" className="rounded-xl border border-indigo-700 bg-indigo-950/40 p-4 space-y-3">
        <h2 id="translation-generate-all-title" className="font-semibold text-white">Generate drafts in all ten languages?</h2>
        <p className="text-sm text-stone-300">This runs the protected Gemini draft workflow sequentially for German, Italian, Romanian, Russian, French, Dutch, Polish, Czech, Swedish and Spanish. It may take several minutes. Existing reviewed and published records are preserved. Every generated record remains a draft; no customer-facing language is activated automatically. A human reviewer must approve translations and any external WhatsApp/Meta templates separately.</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setConfirmGenerateAll(false)} className="rounded border border-stone-600 px-3 py-2 text-sm">Cancel</button><button type="button" onClick={() => { setConfirmGenerateAll(false); void generateAllLocales(); }} className="rounded bg-indigo-700 px-3 py-2 text-sm font-semibold text-white">Generate all ten languages</button></div>
      </div>}
      {confirmGenerate && !generating && <div role="dialog" aria-modal="true" aria-labelledby="translation-generate-title" className="rounded-xl border border-teal-700 bg-teal-950/40 p-4 space-y-3">
        <h2 id="translation-generate-title" className="font-semibold text-white">Generate translation drafts?</h2>
        <p className="text-sm text-stone-300">This translates published tours, destinations, blog posts, public pages, communication templates and the interface catalog into the selected language. It uses Gemini. All ten agreed non-English languages are available here. All results remain drafts; nothing is published automatically.</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setConfirmGenerate(false)} className="rounded border border-stone-600 px-3 py-2 text-sm">Cancel</button><button type="button" onClick={() => { setConfirmGenerate(false); void generateSelectedLocale(); }} className="rounded bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Start generating drafts</button></div>
      </div>}
      <section aria-labelledby="translation-locale-overview" className="space-y-3">
        <div><h2 id="translation-locale-overview" className="font-semibold text-white">Supported translation languages</h2><p className="text-xs text-stone-400">The ten agreed non-English languages are available for draft generation. Counts come from saved database records; prepared files are not counted until safely imported.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ROLLOUT_LOCALES.map((item) => {
            const stats = localeSummary[item.code] || { draft: 0, review: 0, published: 0, outdated: 0, total: 0 };
            return <button key={item.code} type="button" onClick={() => setLocale(item.code)} aria-pressed={locale === item.code} className={'rounded-xl border p-4 text-left transition-colors ' + (locale === item.code ? 'border-teal-500 bg-teal-950/30' : 'border-stone-800 bg-stone-900/60 hover:bg-stone-800')}>
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-white">{item.nativeName}</span><span className="text-xs uppercase text-stone-400">{item.code}</span></div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">{stats.total}</p><p className="text-xs text-stone-400">saved records</p>
              <p className="mt-3 text-xs text-stone-400">{stats.draft} drafts · {stats.review} in review · {stats.published} published · {stats.outdated} outdated</p>
            </button>;
          })}
        </div>
      </section>
      {generationProgress && <p role="status" aria-live="polite" className="rounded-lg border border-stone-800 bg-stone-900/50 px-4 py-3 text-sm text-stone-300">{generationProgress}</p>}
      <div className="grid gap-5 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,2fr)]">
        <aside className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Existing translations</h2><span className="text-xs text-stone-500">{rows.length}</span></div>
          <div className="max-h-[65vh] space-y-2 overflow-auto">
            {rows.map((row) => <button key={row.id} onClick={() => selectRow(row)} className={'w-full rounded-lg border p-3 text-left ' + (selectedId === row.id ? 'border-teal-500 bg-teal-950/30' : 'border-stone-800 hover:bg-stone-800')}>
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{row.title || row.entity_key}</span><span className="text-[10px] uppercase text-stone-400">{row.translation_state}</span></div>
              <p className="mt-1 text-xs text-stone-500">{row.locale} · {row.entity_type} · {row.entity_key}</p>
            </button>)}
            {!rows.length && <p className="py-8 text-center text-sm text-stone-500">{locale ? 'No translation records for this language yet. Generate drafts or import a validated review bundle.' : 'Choose one of the supported languages above to view its saved translations.'}</p>}
          </div>
        </aside>
        <section className="rounded-xl border border-stone-800 bg-stone-900/60 p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-teal-400" /><h2 className="font-semibold">Translation record</h2></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-stone-400">Content type<select value={entityType} onChange={e=>{const next=e.target.value;setEntityType(next);setSourceChecksum('');setSelectedId('');if(next==='ui_catalog'){setEntityKey('site-ui');setTitle('Interface messages');setSlug('');setSummary('');setSeoTitle('');setSeoDescription('');}else if(entityKey==='site-ui'){setEntityKey('');setTitle('');setSlug('');setSummary('');setSeoTitle('');setSeoDescription('');}}} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white">{ENTITY_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="text-xs text-stone-400">Locale<select value={locale} onChange={e=>setLocale(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white"><option value="">Choose a language</option>{ROLLOUT_LOCALES.map(x=><option key={x.code} value={x.code}>{x.nativeName} ({x.code})</option>)}</select></label>
            <label className="text-xs text-stone-400 sm:col-span-2">Source record key<input value={entityKey} onChange={e=>{setEntityKey(e.target.value);setSourceChecksum('');setSelectedId('');}} placeholder={entityType==='ui_catalog'?'site-ui':'Source record UUID or stable content key'} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label>
            <div className="sm:col-span-2 flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-xs text-stone-400">Source checksum<input value={sourceChecksum} readOnly placeholder="Load the authoritative checksum from the server" className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label><button type="button" disabled={loading || !entityKey.trim()} onClick={()=>void loadSource()} className="rounded border border-teal-700 px-3 py-2 text-xs font-semibold text-teal-200 disabled:opacity-50">Load source + checksum</button></div>
            {entityType!=='ui_catalog' && <><label className="text-xs text-stone-400">Translated title<input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label>
            <label className="text-xs text-stone-400">Translated slug<input value={slug} onChange={e=>setSlug(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label>
            <label className="text-xs text-stone-400 sm:col-span-2">Summary<textarea value={summary} onChange={e=>setSummary(e.target.value)} rows={2} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label>
            <label className="text-xs text-stone-400">SEO title<input value={seoTitle} onChange={e=>setSeoTitle(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label>
            <label className="text-xs text-stone-400">SEO description<input value={seoDescription} onChange={e=>setSeoDescription(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label></>}
            <label className="text-xs text-stone-400 sm:col-span-2">Translated structured content (JSON)<textarea value={contentJson} onChange={e=>setContentJson(e.target.value)} rows={10} spellCheck={false} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-3 font-mono text-xs text-white" /></label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button disabled={saving || !entityKey.trim() || !sourceChecksum.trim()} onClick={()=>void save('draft')} className="inline-flex items-center gap-2 rounded bg-stone-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"><Save className="h-4 w-4"/>Save draft</button>
            <button disabled={saving || !entityKey.trim() || !sourceChecksum.trim()} onClick={()=>void save('review')} className="inline-flex items-center gap-2 rounded bg-amber-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"><Send className="h-4 w-4"/>Submit for review</button>
            <button disabled={saving || !entityKey.trim() || !sourceChecksum.trim()} onClick={()=>void save('published')} className="inline-flex items-center gap-2 rounded bg-teal-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"><CheckCircle2 className="h-4 w-4"/>Approve & publish</button>
            {saving && <span className="inline-flex items-center gap-2 text-xs text-stone-400"><Loader2 className="h-4 w-4 animate-spin"/>Saving…</span>}
          </div>
          {(!entityKey.trim() || !sourceChecksum.trim()) && <p className="mt-3 text-xs text-amber-300">To save, select an existing translation or enter its source record key and click <strong>Load source + checksum</strong>. Save actions stay disabled until the server verifies the source.</p>}
          <p className="mt-4 text-xs leading-relaxed text-amber-300/80">Publishing records approval and makes the row eligible for a future public resolver. UI catalogs are publishable only when every source message has a non-empty translation. Public UI delivery uses the verified catalog; booking/account routes are not offered in planned locales until a complete catalog exists.</p>
        </section>
      </div>
    </div>
  );
};
