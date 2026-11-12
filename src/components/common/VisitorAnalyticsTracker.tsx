import React, { useEffect, useRef, useState } from 'react';
import { readVisitorConsent, recordVisitorConsent, recordVisitorEvent } from '../../services/visitorAnalyticsService';

interface Props {
  path: string;
  userId?: string | null;
}

/** Consent-gated SPA page tracking. No optional identifiers are created before opt-in. */
export const VisitorAnalyticsTracker: React.FC<Props> = ({ path, userId }) => {
  const [enabled, setEnabled] = useState(() => Boolean(readVisitorConsent()?.analytics));
  const previous = useRef<{ path: string; startedAt: number } | null>(null);

  useEffect(() => {
    const refresh = () => {
      const consent = readVisitorConsent();
      setEnabled(Boolean(consent?.analytics));
      if (consent) void recordVisitorConsent(consent, 'privacy_settings');
    };
    window.addEventListener('awesome:consent-updated', refresh);
    window.addEventListener('awesome:visitor-consent-saved', refresh);
    return () => {
      window.removeEventListener('awesome:consent-updated', refresh);
      window.removeEventListener('awesome:visitor-consent-saved', refresh);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      previous.current = null;
      return;
    }
    const now = Date.now();
    if (previous.current) {
      void recordVisitorEvent({
        event_name: 'page_exit',
        page_path: previous.current.path,
        duration_ms: Math.max(0, now - previous.current.startedAt),
      });
    }
    const safePath = path.split(/[?#]/, 1)[0] || '/';
    previous.current = { path: safePath, startedAt: now };
    void recordVisitorEvent({
      event_name: 'page_view',
      page_path: safePath,
      page_title: document.title,
      event_data: userId ? { interaction: 'signed_in' } : { interaction: 'guest' },
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
  }, [enabled, path, userId]);

  return null;
};
