import React, { useEffect, useRef, useState } from 'react';
import { readVisitorConsent, recordVisitorConsent, recordVisitorEvent } from '../../services/visitorAnalyticsService';

interface Props {
  path: string;
  userId?: string | null;
}

/** Consent-gated SPA page tracking. No optional identifiers are created before opt-in. */
export const VisitorAnalyticsTracker: React.FC<Props> = ({ path, userId }) => {
  const [enabled, setEnabled] = useState(false);
  const previous = useRef<{ path: string; startedAt: number } | null>(null);

  useEffect(() => {
    const initialConsent = readVisitorConsent();
    if (initialConsent) {
      setEnabled(initialConsent.analytics);
      void recordVisitorConsent(initialConsent, 'privacy_settings');
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
    if (!enabled) {
      previous.current = null;
      return;
    }
    const now = Date.now();
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
