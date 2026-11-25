import React, { useEffect, useMemo, useState } from 'react';
import { StaticContentPage } from './StaticContentPage';
import type { StaticPageContent } from '../services/siteSettingsService';
import { ArrowLeft, ArrowRight, Globe, Loader2 } from 'lucide-react';

type TranslationPayload = {
  id: string;
  entity_type: string;
  entity_key: string;
  locale: string;
  translated_slug: string;
  title: string;
  summary: string | null;
  content: Record<string, unknown>;
  seo_title: string | null;
  seo_description: string | null;
};
type ResolveResult = { success: true; translation: TranslationPayload; source: Record<string, any> };

const clean = (value: unknown): string => typeof value === 'string' ? value : '';
const asStrings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const LocalizedContentPage: React.FC<{
  locale: string;
  pathname: string;
  onNavigate: (path: string) => void;
  fallbackPage?: StaticPageContent | null;
}> = ({ locale, pathname, onNavigate, fallbackPage }) => {
  const route = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return { entityType: 'static_page', slug: 'home' };
    if (parts.length === 2 && parts[0] === 'excursions') return { entityType: 'tour', slug: parts[1] };
    if (parts.length === 2 && parts[0] === 'destinations') return { entityType: 'destination', slug: parts[1] };
    if (parts.length === 2 && parts[0] === 'blog') return { entityType: 'blog_post', slug: parts[1] };
    if (parts.length === 1) return { entityType: 'static_page', slug: parts[0] };
    return null;
  }, [pathname]);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setResult(null); setUnavailable(false);
    if (!route) { setUnavailable(true); setLoading(false); return; }
    const params = new URLSearchParams({ locale, entity_type: route.entityType, slug: route.slug });
    fetch('/api/content-translations/resolve?' + params.toString(), { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Translation not available');
        if (active) setResult(payload as ResolveResult);
      })
      .catch(() => { if (active) setUnavailable(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale, route]);

  useEffect(() => {
    if (!result) return;
    const translation = result.translation;
    document.title = translation.seo_title || translation.title;
    const description = translation.seo_description || translation.summary || '';
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
    meta.content = description;
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = window.location.origin + window.location.pathname;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale, result]);

  useEffect(() => {
    const legalFallback = unavailable && fallbackPage
      && ['terms', 'privacy', 'cancellation-policy', 'cookie-policy'].includes(fallbackPage.slug);
    if (!legalFallback) return;

    document.title = fallbackPage.seoTitle || `${fallbackPage.title} | Awesome Adventure Tours`;
    document.documentElement.lang = 'en';
    const description = fallbackPage.seoDescription || fallbackPage.heroSubtitle || '';
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
    meta.content = description;
    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots); }
    robots.content = 'noindex, follow';
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = window.location.origin + `/${fallbackPage.slug}`;
  }, [fallbackPage, unavailable]);

  const translation = result?.translation;
  const content = translation?.content || {};
  const paragraphs = asStrings(content.paragraphs);
  const sections = Array.isArray(content.sections) ? content.sections as Array<{ title?: string; content?: string }> : [];
  const highlights = asStrings(content.highlights);
  const itinerary = Array.isArray(content.itinerary) ? content.itinerary as Array<{ title?: string; description?: string }> : [];
  const included = asStrings(content.included);
  const excluded = asStrings(content.excluded);
  const faqs = Array.isArray(content.faqs) ? content.faqs as Array<{ question?: string; answer?: string }> : [];
  const pickupInfo = clean(content.pickupInfo || content.pickup_info);
  const cancellationPolicy = clean(content.cancellationPolicy || content.cancellation_policy);
  const ageRestrictions = clean(content.ageRestrictions || content.age_restrictions);
  const durationLabel = clean(content.durationLabel || content.duration_label);
  const articleBody = clean(content.content || content.description || content.fullDescription || content.body || content.heroSubtitle);
  const labels = content.labels && typeof content.labels === 'object' ? content.labels as Record<string, string> : {};
  const heroHeadline = clean(content.heroHeadline);
  const sourceSlug = clean(result?.source?.slug || result?.source?.id);

  if (loading) return <main className="min-h-[60vh] grid place-items-center px-5"><Loader2 className="h-8 w-8 animate-spin text-teal-700" aria-label="Loading translation" /></main>;
  if (unavailable || !translation) {
    const isLegalFallback = route?.entityType === 'static_page'
      && ['terms', 'privacy', 'cancellation-policy', 'cookie-policy'].includes(route.slug)
      && fallbackPage
      && ['terms', 'privacy', 'cancellation-policy', 'cookie-policy'].includes(fallbackPage.slug);

    if (isLegalFallback) {
      return (
        <div>
          <aside role="status" className="mx-auto max-w-4xl px-4 pt-6">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              The {locale.toUpperCase()} translation of this legal page has not yet been reviewed and published. The official English version is shown below so you can read the current terms before making a reservation.
              {' '}<a href={`/${fallbackPage.slug}`} className="font-semibold underline">Open the English legal page</a>.
            </p>
          </aside>
          <StaticContentPage page={fallbackPage} />
        </div>
      );
    }

    return (
      <main className="mx-auto max-w-2xl px-5 py-24 text-center"><Globe className="mx-auto mb-5 h-10 w-10 text-stone-400" /><h1 className="font-display text-3xl font-bold text-stone-900 dark:text-white">404</h1></main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF8F5] px-5 py-12 text-[#17212B] dark:bg-[#0A1118] dark:text-slate-100" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <article className="mx-auto max-w-4xl">
        <p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-teal-700 dark:text-teal-300">{locale.toUpperCase()} · Awesome Adventure Tours</p>
        <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">{heroHeadline || translation.title}</h1>
        {translation.summary && <p className="mt-6 text-xl leading-relaxed text-stone-600 dark:text-slate-300">{translation.summary}</p>}
        {durationLabel && <p className="mt-4 text-sm font-semibold text-teal-700 dark:text-teal-300">{durationLabel}</p>}
        {articleBody && <div className="mt-8 whitespace-pre-line text-lg leading-8">{articleBody}</div>}
        {paragraphs.map((paragraph, index) => <p key={index} className="mt-5 text-lg leading-8">{paragraph}</p>)}
        {sections.map((section, index) => <section key={index} className="mt-10"><h2 className="font-display text-2xl font-bold">{section.title}</h2><p className="mt-3 whitespace-pre-line leading-8">{section.content}</p></section>)}
        {highlights.length > 0 && <section className="mt-10">{labels.highlights && <h2 className="font-display text-2xl font-bold">{labels.highlights}</h2>}<ul className="mt-4 list-disc space-y-2 ps-6">{highlights.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
        {itinerary.length > 0 && <section className="mt-10">{labels.itinerary && <h2 className="font-display text-2xl font-bold">{labels.itinerary}</h2>}<ol className="mt-4 list-decimal space-y-3 ps-6">{itinerary.map((item,index)=><li key={index}><strong>{item.title}</strong>{item.description && <p className="mt-1">{item.description}</p>}</li>)}</ol></section>}
        {included.length > 0 && <section className="mt-10">{labels.included && <h2 className="font-display text-2xl font-bold">{labels.included}</h2>}<ul className="mt-3 list-disc space-y-2 ps-6">{included.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
        {excluded.length > 0 && <section className="mt-8">{labels.excluded && <h2 className="font-display text-2xl font-bold">{labels.excluded}</h2>}<ul className="mt-3 list-disc space-y-2 ps-6">{excluded.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
        {(pickupInfo || cancellationPolicy || ageRestrictions) && <section className="mt-10 space-y-4">{pickupInfo && <p>{labels.pickupInfo ? <strong>{labels.pickupInfo}: </strong> : null}{pickupInfo}</p>}{cancellationPolicy && <p>{labels.cancellationPolicy ? <strong>{labels.cancellationPolicy}: </strong> : null}{cancellationPolicy}</p>}{ageRestrictions && <p>{labels.ageRestrictions ? <strong>{labels.ageRestrictions}: </strong> : null}{ageRestrictions}</p>}</section>}
        {faqs.length > 0 && <section className="mt-10">{labels.faqs && <h2 className="font-display text-2xl font-bold">{labels.faqs}</h2>}{faqs.map((faq,index)=><details key={index} className="border-b border-stone-200 py-4 dark:border-slate-700"><summary className="cursor-pointer font-semibold">{faq.question}</summary><p className="mt-3 leading-7">{faq.answer}</p></details>)}</section>}
        <div className="mt-14 flex flex-wrap gap-3 border-t border-stone-200 pt-8 dark:border-slate-700">
          {translation.entity_type === 'tour' && labels.bookNow && <button type="button" onClick={() => onNavigate('/booking?tour=' + encodeURIComponent(sourceSlug) + '&customer_locale=' + encodeURIComponent(locale))} className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-6 py-3 font-semibold text-white">{labels.bookNow}<ArrowRight size={16}/></button>}
          {labels.browseMore && <button type="button" onClick={() => onNavigate(translation.entity_type === 'blog_post' ? '/blog' : '/excursions')} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-5 py-3 font-semibold dark:border-slate-600"><ArrowLeft size={16}/>{labels.browseMore}</button>}
        </div>
      </article>
    </main>
  );
};
