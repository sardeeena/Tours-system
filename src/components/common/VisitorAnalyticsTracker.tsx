import React, { useEffect, useRef, useState } from 'react';
import { isInternalAnalyticsPath, readVisitorConsent, recordVisitorConsent, recordVisitorEvent, sanitizeVisitorAnalyticsPath } from '../../services/visitorAnalyticsService';

interface Props {
  path: string;
}

/** Consent-gated SPA page tracking. No optional identifiers are created before opt-in. */
export const VisitorAnalyticsTracker: React.FC<Props> = ({ path }) => {
  const [enabled, setEnabled] = useState(false);
  const previous = useRef<{ path: string; startedAt: number } | null>(null);

  useEffect(() => {
    const initialConsent = readVisitorConsent();
    if (initialConsent) {
      void recordVisitorConsent(initialConsent, 'session_restore');
    }
    const refresh = () => {
      const consent = readVisitorConsent();
      setEnabled(Boolean(consent?.analytics));
    };
    window.addEventListener('awesome:visitor-consent-saved', refresh);
    return () => {
      window.removeEventListener('awesome:visitor-consent-saved', refresh);
    };
  }, []);

  useEffect(() => {
    const safePath = sanitizeVisitorAnalyticsPath(path);
    if (isInternalAnalyticsPath(safePath)) {
      previous.current = null;
      return;
    }
    // This route signal also lets consented marketing tags initialize when
    // analytics consent is denied; it never grants analytics consent.
    window.dispatchEvent(new Event('awesome:public-analytics-route'));
    if (!enabled) {
      previous.current = null;
      return;
    }
    const now = Date.now();
    if (previous.current && previous.current.path !== safePath) {
      void recordVisitorEvent({ event_name: 'navigation', page_path: safePath, event_data: { interaction: 'internal_navigation' } });
    }

    // Send one page_view for the initial route and each SPA route change.
    // GA4 is configured with send_page_view:false, so this is the sole page-view source.
    window.gtag?.('event', 'page_view', {
      page_path: safePath,
      page_title: document.title,
      page_location: window.location.origin + safePath,
    });
    previous.current = { path: safePath, startedAt: now };
    void recordVisitorEvent({
      event_name: 'page_view',
      page_path: safePath,
      page_title: document.title,
      event_data: { interaction: 'page_view' },
    });
    return () => {
      const current = previous.current;
      if (current?.path === safePath) {
        void recordVisitorEvent({
          event_name: 'page_exit',
          page_path: current.path,
          duration_ms: Math.max(0, Date.now() - current.startedAt),
        });
      }
    };
  }, [enabled, path]);

  return null;
};
