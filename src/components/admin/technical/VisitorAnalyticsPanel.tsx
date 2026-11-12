import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Search, ShieldCheck, Users, Eye, MousePointerClick, Cookie, Clock3 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../../services/supabaseClient';

type Overview = {
  periodDays: number; sessions: number; uniqueVisitors: number; returningVisitors: number; events: number; guestSessions: number;
  signedInSessions: number; consentRecords: number; analyticsOptIns: number; marketingOptIns: number;
};
type Session = {
  id: string; visitor_id: string; user_id: string | null; started_at: string; last_seen_at: string; ended_at: string | null;
  landing_path: string; referrer_host: string | null; utm_source: string | null; utm_medium: string | null;
  utm_campaign: string | null; device_type: string | null; browser_family: string | null; os_family: string | null;
  screen_bucket: string | null; language: string | null; timezone: string | null;
  analytics_consent: boolean; marketing_consent: boolean;
};
type VisitorEvent = {
  id: string; occurred_at: string; session_id: string; user_id: string | null; event_name: string;
  page_path: string | null; page_title: string | null; duration_ms: number | null;
  event_data: Record<string, string | number | boolean>;
};
type ConsentRecord = {
  id: string; visitor_session_id: string | null; visitor_id: string | null; user_id: string | null;
  necessary: boolean; analytics: boolean; marketing: boolean; consent_version: string;
  consent_source: string; recorded_at: string;
};
type Retention = { event_retention_days: number; session_retention_days: number; consent_retention_days: number };
type AuditRecord = { id: string; created_at: string; action: string; entity_type: string; entity_id: string | null; user_id: string | null };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isSupabaseConfigured()) throw new Error('Secure administrator sign-in is unavailable.');
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Your secure administrator session has expired. Sign in again.');
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Visitor analytics could not be loaded.');
  return payload as T;
}

const date = (value: string) => new Date(value).toLocaleString();
const Card = ({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <div className="flex items-center justify-between gap-2 text-xs text-slate-500"><span>{label}</span><Icon className="h-4 w-4 text-[#b58b3a]" /></div>
    <p className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
  </div>
);

export const VisitorAnalyticsPanel: React.FC = () => {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<VisitorEvent[]>([]);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [retention, setRetention] = useState<Retention>({ event_retention_days: 90, session_retention_days: 180, consent_retention_days: 730 });
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      const [summary, sessionRows, eventRows, consentRows, settings, auditRows] = await Promise.all([
        api<Overview>('/api/admin/technical/visitors/overview'),
        api<{ sessions: Session[] }>(`/api/admin/technical/visitors/sessions?limit=500${deviceType ? `&device_type=${encodeURIComponent(deviceType)}` : ''}${fromDate ? `&from=${encodeURIComponent(new Date(`${fromDate}T00:00:00`).toISOString())}` : ''}${toDate ? `&to=${encodeURIComponent(new Date(`${toDate}T23:59:59`).toISOString())}` : ''}`),
        api<{ events: VisitorEvent[] }>(`/api/admin/technical/visitors/events?limit=500${eventType ? `&event_name=${encodeURIComponent(eventType)}` : ''}${fromDate ? `&from=${encodeURIComponent(new Date(`${fromDate}T00:00:00`).toISOString())}` : ''}${toDate ? `&to=${encodeURIComponent(new Date(`${toDate}T23:59:59`).toISOString())}` : ''}`),
        api<{ records: ConsentRecord[] }>('/api/admin/technical/visitors/consent?limit=150'),
        api<{ settings: Retention }>('/api/admin/technical/visitors/settings'),
        api<{ records: AuditRecord[] }>(`/api/admin/technical/audit-logs?limit=500${fromDate ? `&from=${encodeURIComponent(new Date(`${fromDate}T00:00:00`).toISOString())}` : ''}${toDate ? `&to=${encodeURIComponent(new Date(`${toDate}T23:59:59`).toISOString())}` : ''}`),
      ]);
      setOverview(summary); setSessions(sessionRows.sessions || []); setEvents(eventRows.events || []);
      setConsents(consentRows.records || []); setAuditRecords(auditRows.records || []); if (settings.settings) setRetention(settings.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Visitor analytics could not be loaded.');
    } finally { setLoading(false); }
  }, [deviceType, eventType, fromDate, toDate]);

  useEffect(() => { void load(); }, [load]);

  const visibleSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter((item) => !term || [
      item.id, item.user_id, item.landing_path, item.referrer_host, item.utm_source,
      item.utm_campaign, item.browser_family, item.os_family, item.device_type,
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [sessions, search]);

  const visibleEvents = useMemo(() => {
    const rows = selectedSession ? events.filter((item) => item.session_id === selectedSession) : events;
    const term = search.trim().toLowerCase();
    return rows.filter((item) => !term || [
      item.session_id, item.user_id, item.event_name, item.page_path, item.page_title,
      JSON.stringify(item.event_data || {}),
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [events, selectedSession, search]);

  const exportCsv = () => {
    const columns = ['Occurred at','Event','Session ID','User ID','Page','Duration ms','Event data'];
    const rows = visibleEvents.map((item) => [item.occurred_at, item.event_name, item.session_id, item.user_id || '', item.page_path || '', item.duration_ms ?? '', JSON.stringify(item.event_data || {})]);
    const csv = [columns, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `awesome-adventure-visitor-events-${new Date().toISOString().slice(0,10)}.csv`;
    anchor.click(); URL.revokeObjectURL(url);
  };

  const saveRetention = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await api<{ settings: Retention }>('/api/admin/technical/visitors/settings', {
        method: 'POST', body: JSON.stringify(retention),
      });
      setRetention(result.settings); setNotice('Retention settings saved. Cleanup runs automatically once a day.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Retention settings could not be saved.'); }
    finally { setSaving(false); }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#b58b3a]" /><h2 className="text-lg font-bold">Visitor analytics & privacy records</h2></div>
          <p className="mt-1 text-xs text-slate-500">Consent-based visitor activity for the last 30 days, with searchable recent sessions and events.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-600 dark:bg-slate-900"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          <button type="button" onClick={exportCsv} disabled={!visibleEvents.length} className="inline-flex items-center gap-2 rounded-lg bg-[#d6ad5b] px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"><Download className="h-4 w-4" /> Export</button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}

      {overview && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card label="Consented sessions · 30d" value={overview.sessions} icon={Users} />
        <Card label="Unique visitors" value={overview.uniqueVisitors} icon={Eye} />
        <Card label="Returning visitors" value={overview.returningVisitors} icon={Users} />
        <Card label="Guest sessions" value={overview.guestSessions} icon={Eye} />
        <Card label="Signed-in sessions" value={overview.signedInSessions} icon={ShieldCheck} />
        <Card label="Tracked events" value={overview.events} icon={MousePointerClick} />
        <Card label="Consent records" value={overview.consentRecords} icon={Cookie} />
        <Card label="Analytics opt-ins" value={overview.analyticsOptIns} icon={Eye} />
        <Card label="Marketing opt-ins" value={overview.marketingOptIns} icon={Cookie} />
      </div>}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="font-semibold">Visitor sessions</h3>
          <p className="mt-1 text-xs text-slate-500">Select a session to inspect its event timeline.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select value={deviceType} onChange={(e) => setDeviceType(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-600 dark:bg-slate-800"><option value="">All devices</option><option value="desktop">Desktop</option><option value="mobile">Mobile</option><option value="tablet">Tablet</option><option value="other">Other</option></select>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-600 dark:bg-slate-800"><option value="">All event types</option>{['page_view','navigation','tour_view','tour_search','tour_filter_applied','booking_started','booking_step_completed','booking_submitted','booking_confirmed','booking_lookup','booking_cancellation_requested','auth_sign_in','auth_sign_in_failed','auth_sign_up','auth_sign_out','profile_updated','newsletter_subscribed','inquiry_submitted','support_ticket_created','support_reply_sent','support_ticket_updated','chatbot_interaction','wishlist_updated','comparison_updated'].map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select>
            <label className="text-[11px] text-slate-500">From<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-600 dark:bg-slate-800" /></label>
            <label className="text-[11px] text-slate-500">To<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-600 dark:bg-slate-800" /></label>
          </div>
          <div className="mt-3 flex items-center gap-2"><Search className="h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search visitor, device, page or campaign" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" /></div>
          <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
            {visibleSessions.map((item) => <button type="button" key={item.id} onClick={() => setSelectedSession((current) => current === item.id ? '' : item.id)} className={`w-full rounded-lg border p-3 text-left text-xs transition ${selectedSession === item.id ? 'border-[#b58b3a] bg-amber-50 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
              <div className="flex items-start justify-between gap-2"><span className="font-mono font-semibold">{item.id.slice(0, 8)}…</span><span className="text-slate-500">{item.user_id ? 'Signed in' : 'Guest'}</span></div>
              <p className="mt-1 truncate font-medium">{item.landing_path}</p>
              <p className="mt-1 text-slate-500">{[item.device_type, item.browser_family, item.os_family].filter(Boolean).join(' · ') || 'Device details unavailable'}</p>
              <p className="mt-1 text-slate-500">Last activity: {date(item.last_seen_at)}</p>
              <p className="mt-1 text-slate-500">Referrer: {item.referrer_host || 'Direct'}{item.utm_campaign ? ` · ${item.utm_campaign}` : ''}</p>
              <p className="mt-1 text-slate-500">{[item.language, item.timezone, item.country_code, item.region_code].filter(Boolean).join(' · ')}</p>
            </button>)}
            {!visibleSessions.length && <p className="py-6 text-center text-xs text-slate-500">No matching sessions in the latest records.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Visitor activity timeline</h3><p className="mt-1 text-xs text-slate-500">{selectedSession ? `Session ${selectedSession.slice(0, 8)}…` : 'Recent events across all consented sessions'}</p></div>{selectedSession && <button type="button" onClick={() => setSelectedSession('')} className="text-xs font-semibold text-[#9a702b] underline">Clear session</button>}</div>
          <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto">
            {visibleEvents.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{item.event_name.replace(/_/g, ' ')}</span><span className="text-slate-500">{date(item.occurred_at)}</span></div>
              <p className="mt-1 break-all text-slate-600 dark:text-slate-300">{item.page_path || 'No page recorded'}</p>
              <p className="mt-1 text-slate-500">Session {item.session_id.slice(0, 8)}…{item.duration_ms !== null ? ` · ${Math.round(item.duration_ms / 1000)}s` : ''}</p>
              {Object.keys(item.event_data || {}).length > 0 && <p className="mt-1 break-words text-slate-500">{Object.entries(item.event_data).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>}
            </div>)}
            {!visibleEvents.length && <p className="py-6 text-center text-xs text-slate-500">No activity matches this filter.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Website and administration audit trail</h3><p className="mt-1 text-xs text-slate-500">Recorded business and administrator actions, separate from optional visitor analytics.</p></div><span className="text-xs text-slate-500">{auditRecords.length.toLocaleString()} recent records</span></div>
        <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto">
          {auditRecords.filter((item) => !search.trim() || [item.action,item.entity_type,item.entity_id,item.user_id].some((value) => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700"><div className="min-w-0"><p className="font-semibold">{item.action.replace(/_/g, ' ')}</p><p className="mt-1 text-slate-500">{item.entity_type}{item.entity_id ? ` · ${item.entity_id}` : ''}{item.user_id ? ` · User ${item.user_id.slice(0,8)}…` : ' · System action'}</p></div><time className="shrink-0 text-slate-500">{date(item.created_at)}</time></div>)}
          {!auditRecords.length && <p className="py-5 text-center text-xs text-slate-500">No audit records were returned for this period.</p>}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Detailed before-and-after records remain protected in the audit store; this view lists action metadata only.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2"><Cookie className="h-4 w-4 text-[#b58b3a]" /><h3 className="font-semibold">Consent history</h3></div>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-2">Recorded</th><th className="pb-2">Visitor / User</th><th className="pb-2">Necessary</th><th className="pb-2">Analytics</th><th className="pb-2">Marketing</th><th className="pb-2">Source</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{consents.map((item) => <tr key={item.id}><td className="py-2 pr-3 whitespace-nowrap">{date(item.recorded_at)}</td><td className="py-2 pr-3 font-mono">{(item.visitor_id || item.visitor_session_id || item.user_id || 'Unknown').slice(0,8)}…</td><td className="py-2 pr-3">{item.necessary ? 'Yes' : 'No'}</td><td className="py-2 pr-3">{item.analytics ? 'Accepted' : 'Declined'}</td><td className="py-2 pr-3">{item.marketing ? 'Accepted' : 'Declined'}</td><td className="py-2 pr-3">{item.consent_source}</td></tr>)}</tbody></table></div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#b58b3a]" /><h3 className="font-semibold">Data retention controls</h3></div>
        <p className="mt-1 text-xs text-slate-500">Old visitor events, sessions and consent receipts are automatically deleted daily according to these limits.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium">Events (7–730 days)<input type="number" min={7} max={730} value={retention.event_retention_days} onChange={(e) => setRetention((v) => ({ ...v, event_retention_days: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
          <label className="text-xs font-medium">Sessions (7–1,095 days)<input type="number" min={7} max={1095} value={retention.session_retention_days} onChange={(e) => setRetention((v) => ({ ...v, session_retention_days: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
          <label className="text-xs font-medium">Consent records (90–3,650 days)<input type="number" min={90} max={3650} value={retention.consent_retention_days} onChange={(e) => setRetention((v) => ({ ...v, consent_retention_days: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
        </div>
        <button type="button" onClick={() => void saveRetention()} disabled={saving} className="mt-3 rounded-lg bg-[#d6ad5b] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? 'Saving…' : 'Save retention settings'}</button>
      </div>

      <p className="text-[11px] leading-5 text-slate-500">Privacy safeguards: optional tracking starts only after analytics consent. Raw IP addresses, complete browser fingerprints, raw cookies, passwords, session tokens, form contents and payment credentials are not collected by this system. Marketing consent remains separate.</p>
    </section>
  );
};
