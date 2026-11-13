import React, { useEffect, useState } from 'react';
import { recordVisitorConsent } from '../../services/visitorAnalyticsService';

type ConsentChoices = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

const CONSENT_KEY = 'aat_cookie_consent_v1';
const GTM_ID = 'GTM-MZVP38WC';

function applyConsent(choices: ConsentChoices): void {
  const browserWindow = window as typeof window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  browserWindow.dataLayer = browserWindow.dataLayer || [];
  browserWindow.gtag?.('consent', 'update', {
    analytics_storage: choices.analytics ? 'granted' : 'denied',
    ad_storage: choices.marketing ? 'granted' : 'denied',
    ad_user_data: choices.marketing ? 'granted' : 'denied',
    ad_personalization: choices.marketing ? 'granted' : 'denied',
    personalization_storage: choices.marketing ? 'granted' : 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
  });

  // Do not contact Google Tag Manager until the visitor has opted into at
  // least one optional category. Individual GTM tags must still enforce
  // their matching analytics or advertising consent requirement.
  if ((choices.analytics || choices.marketing) && !document.getElementById('aat-gtm-script')) {
    browserWindow.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const script = document.createElement('script');
    script.id = 'aat-gtm-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.appendChild(script);
  }
}

function readSavedConsent(): ConsentChoices | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ConsentChoices>;
    if (value.necessary !== true || typeof value.analytics !== 'boolean' || typeof value.marketing !== 'boolean') {
      return null;
    }
    return {
      necessary: true,
      analytics: value.analytics,
      marketing: value.marketing,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    };
  } catch {
    return null;
  }
}

export const CookieConsent: React.FC = () => {
  const [choices, setChoices] = useState<ConsentChoices>({
    necessary: true,
    analytics: false,
    marketing: false,
    updatedAt: '',
  });
  const [visible, setVisible] = useState(false);
  const [customising, setCustomising] = useState(false);

  useEffect(() => {
    const saved = readSavedConsent();
    if (saved) {
      setChoices(saved);
      applyConsent(saved);
    } else {
      setVisible(true);
    }

    const openSettings = () => {
      const current = readSavedConsent();
      if (current) setChoices(current);
      setCustomising(true);
      setVisible(true);
    };
    window.addEventListener('awesome:open-cookie-settings', openSettings);
    return () => window.removeEventListener('awesome:open-cookie-settings', openSettings);
  }, []);

  const save = (analytics: boolean, marketing: boolean) => {
    const next: ConsentChoices = {
      necessary: true,
      analytics,
      marketing,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
    } catch {
      // If storage is blocked, this choice applies for the current page view.
    }
    setChoices(next);
    applyConsent(next);
    void recordVisitorConsent(next, customising ? 'privacy_settings' : 'cookie_banner');
    setVisible(false);
    setCustomising(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-4 text-stone-800 shadow-2xl dark:border-slate-700 dark:bg-[#101D2B] dark:text-slate-100 sm:inset-x-6 sm:bottom-6 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0A6C74] dark:text-[#60C3CC]">Your privacy choices</p>
          <h2 id="cookie-consent-title" className="mt-1 text-lg font-bold">Cookies & website storage</h2>
          <p className="mt-2 text-xs leading-6 text-stone-600 dark:text-slate-300">
            We use essential storage to make the website and booking features work. With your permission, we also use analytics and marketing technologies. If you enable Analytics, we may estimate your country, region and city from your connection IP; the IP itself is not stored in our analytics database. You can accept all, reject optional technologies or customise your choices. Read our <a className="font-semibold text-[#0A6C74] underline dark:text-[#60C3CC]" href="/cookie-policy">Cookie Policy</a> and <a className="font-semibold text-[#0A6C74] underline dark:text-[#60C3CC]" href="/privacy">Privacy Policy</a>.
          </p>
        </div>

        {customising && (
          <div className="space-y-3 rounded-xl border border-stone-200 p-3 dark:border-slate-700">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Strictly necessary</p>
                <p className="text-xs leading-5 text-stone-500 dark:text-slate-400">Always active for security, consent storage and core site functions.</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Always on</span>
            </div>
            <label className="flex cursor-pointer items-start justify-between gap-4 border-t border-stone-100 pt-3 dark:border-slate-800">
              <span>
                <span className="block text-sm font-semibold">Analytics</span>
                <span className="block text-xs leading-5 text-stone-500 dark:text-slate-400">Allow measurement that helps us understand website use, including approximate country/region/city inferred from your connection IP. The IP is used for the lookup but is not saved in our analytics records.</span>
              </span>
              <input type="checkbox" checked={choices.analytics} onChange={(event) => setChoices((current) => ({ ...current, analytics: event.target.checked }))} className="mt-1 h-4 w-4 accent-[#0A6C74]" />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-4 border-t border-stone-100 pt-3 dark:border-slate-800">
              <span>
                <span className="block text-sm font-semibold">Marketing</span>
                <span className="block text-xs leading-5 text-stone-500 dark:text-slate-400">Allow advertising-related measurement and personalisation tags, if configured.</span>
              </span>
              <input type="checkbox" checked={choices.marketing} onChange={(event) => setChoices((current) => ({ ...current, marketing: event.target.checked }))} className="mt-1 h-4 w-4 accent-[#0A6C74]" />
            </label>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {customising ? (
            <>
              <button type="button" onClick={() => save(false, false)} className="rounded-full border border-stone-300 px-4 py-2.5 text-xs font-semibold hover:bg-stone-50 dark:border-slate-600 dark:hover:bg-slate-800">Reject optional</button>
              <button type="button" onClick={() => save(choices.analytics, choices.marketing)} className="rounded-full bg-[#0A6C74] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#08565C]">Save my choices</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => save(false, false)} className="rounded-full border border-stone-300 px-4 py-2.5 text-xs font-semibold hover:bg-stone-50 dark:border-slate-600 dark:hover:bg-slate-800">Reject optional</button>
              <button type="button" onClick={() => setCustomising(true)} className="rounded-full border border-stone-300 px-4 py-2.5 text-xs font-semibold hover:bg-stone-50 dark:border-slate-600 dark:hover:bg-slate-800">Customise</button>
              <button type="button" onClick={() => save(true, true)} className="rounded-full bg-[#0A6C74] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#08565C]">Accept all</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
