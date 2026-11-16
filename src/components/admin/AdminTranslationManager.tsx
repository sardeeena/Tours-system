import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileText, Globe, Loader2, Save, Send } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { EUROPEAN_LOCALE_ROLLOUT } from '../../types/i18n';
import { useToast } from '../../contexts/ToastContext';

type TranslationRow = {
  id: string; entity_type: string; entity_key: string; locale: string;
  translated_slug: string | null; title: string | null; summary: string | null;
  content: Record<string, unknown>; seo_title: string | null; seo_description: string | null;
  source_checksum: string | null; translation_state: 'draft' | 'review' | 'published' | 'outdated';
};

const ENTITY_TYPES = ['tour', 'tour_itinerary', 'tour_highlight', 'tour_inclusion', 'tour_exclusion', 'tour_faq', 'destination', 'blog_post', 'static_page', 'ui_catalog'];

export const AdminTranslationManager: React.FC = () => {
  const { showToast } = useToast();
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [entityType, setEntityType] = useState('tour');
  const [entityKey, setEntityKey] = useState('');
  const [locale, setLocale] = useState('de');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [sourceChecksum, setSourceChecksum] = useState('');
  const [contentJson, setContentJson] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const save = async (state: 'draft' | 'review' | 'published') => {
    if (!entityKey.trim() || !sourceChecksum.trim()) {
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
    if (state === 'published' && !window.confirm('Publish this human-reviewed translation? It will become eligible for public routing only after the publication resolver is deployed.')) return;
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

  return (
    <div className="space-y-6 text-stone-100">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Globe className="h-6 w-6 text-teal-400" /> Translation workspace</h1>
          <p className="mt-1 text-sm text-stone-400">Super Admin + verified MFA required. Drafts never appear on public pages.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="rounded border border-stone-700 px-3 py-2 text-sm disabled:opacity-50">{loading ? 'Loading…' : 'Refresh records'}</button>
      </header>
      <div className="grid gap-5 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,2fr)]">
        <aside className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Existing translations</h2><span className="text-xs text-stone-500">{rows.length}</span></div>
          <div className="max-h-[65vh] space-y-2 overflow-auto">
            {rows.map((row) => <button key={row.id} onClick={() => selectRow(row)} className={'w-full rounded-lg border p-3 text-left ' + (selectedId === row.id ? 'border-teal-500 bg-teal-950/30' : 'border-stone-800 hover:bg-stone-800')}>
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{row.title || row.entity_key}</span><span className="text-[10px] uppercase text-stone-400">{row.translation_state}</span></div>
              <p className="mt-1 text-xs text-stone-500">{row.locale} · {row.entity_type} · {row.entity_key}</p>
            </button>)}
            {!rows.length && <p className="py-8 text-center text-sm text-stone-500">No translation records for this locale yet.</p>}
          </div>
        </aside>
        <section className="rounded-xl border border-stone-800 bg-stone-900/60 p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-teal-400" /><h2 className="font-semibold">Translation record</h2></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-stone-400">Content type<select value={entityType} onChange={e=>{setEntityType(e.target.value);if(e.target.value==='ui_catalog')setEntityKey('site-ui');else if(entityKey==='site-ui')setEntityKey('');}} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white">{ENTITY_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="text-xs text-stone-400">Locale<select value={locale} onChange={e=>setLocale(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white">{EUROPEAN_LOCALE_ROLLOUT.filter(x=>x.code!=='en').map(x=><option key={x.code} value={x.code}>{x.nativeName} ({x.code})</option>)}</select></label>
            <label className="text-xs text-stone-400 sm:col-span-2">Source record key<input value={entityKey} onChange={e=>setEntityKey(e.target.value)} placeholder={entityType==='ui_catalog'?'site-ui':'Source record UUID or stable content key'} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label>
            <div className="sm:col-span-2 flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-xs text-stone-400">Source checksum<input value={sourceChecksum} readOnly placeholder="Load the authoritative checksum from the server" className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label><button type="button" disabled={loading || !entityKey.trim()} onClick={()=>void loadSource()} className="rounded border border-teal-700 px-3 py-2 text-xs font-semibold text-teal-200 disabled:opacity-50">Load source + checksum</button></div>
            {entityType!=='ui_catalog' && <><label className="text-xs text-stone-400">Translated title<input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label>
            <label className="text-xs text-stone-400">Translated slug<input value={slug} onChange={e=>setSlug(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label>
            <label className="text-xs text-stone-400 sm:col-span-2">Summary<textarea value={summary} onChange={e=>setSummary(e.target.value)} rows={2} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label>
            <label className="text-xs text-stone-400">SEO title<input value={seoTitle} onChange={e=>setSeoTitle(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label>
            <label className="text-xs text-stone-400">SEO description<input value={seoDescription} onChange={e=>setSeoDescription(e.target.value)} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-2 text-sm text-white" /></label></>}
            <label className="text-xs text-stone-400 sm:col-span-2">Translated structured content (JSON)<textarea value={contentJson} onChange={e=>setContentJson(e.target.value)} rows={10} spellCheck={false} className="mt-1 w-full rounded border border-stone-700 bg-stone-950 p-3 font-mono text-xs text-white" /></label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button disabled={saving} onClick={()=>void save('draft')} className="inline-flex items-center gap-2 rounded bg-stone-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"><Save className="h-4 w-4"/>Save draft</button>
            <button disabled={saving} onClick={()=>void save('review')} className="inline-flex items-center gap-2 rounded bg-amber-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"><Send className="h-4 w-4"/>Submit for review</button>
            <button disabled={saving} onClick={()=>void save('published')} className="inline-flex items-center gap-2 rounded bg-teal-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"><CheckCircle2 className="h-4 w-4"/>Approve & publish</button>
            {saving && <span className="inline-flex items-center gap-2 text-xs text-stone-400"><Loader2 className="h-4 w-4 animate-spin"/>Saving…</span>}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-amber-300/80">Publishing records approval and makes the row eligible for a future public resolver. UI catalogs are publishable only when every source message has a non-empty translation. Public UI delivery uses the verified catalog; booking/account routes are not offered in planned locales until a complete catalog exists.</p>
        </section>
      </div>
    </div>
  );
};
