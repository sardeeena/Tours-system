import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Search, ShieldCheck, Users, Eye, MousePointerClick, Cookie, Clock3 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../../services/supabaseClient';

type Overview = {
  periodDays: number; sessions: number; uniqueVisitors: number; returningVisitors: number; events: number; guestSessions: number;
  signedInSessions: number; consentRecords: number; analyticsOptIns: number; marketingOptIns: number;
  bookingFunnel: { started: number; stepsCompleted: number; submitted: number; confirmed: number; cancellationRequests: number };
};
type Session = {
  id: string; visitor_id: string; user_id: string | null; started_at: string; last_seen_at: string; ended_at: string | null;
  landing_path: string; referrer_host: string | null; utm_source: string | null; utm_medium: string | null;
  utm_campaign: string | null; utm_term?: string | null; utm_content?: string | null; device_type: string | null; browser_family: string | null; os_family: string | null;
  screen_bucket: string | null; language: string | null; locale?: string | null; language_preferences?: string[] | null;
  platform_family?: string | null; is_mobile?: boolean | null; viewport_bucket?: string | null;
  timezone: string | null; country_code?: string | null; country_name?: string | null;
  region_code?: string | null; region_name?: string | null; city?: string | null; location_source?: string | null;
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
type Retention = { event_retention_days: number; session_retention_days: number; consent_retention_days: number; technical_event_retention_days: number; audit_log_retention_days: number };
type AuditRecord = { id: string; created_at: string; action: string; entity_type: string; entity_id: string | null; user_id: string | null; old_data: Record<string, string | number | boolean> | null; new_data: Record<string, string | number | boolean> | null };

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

const downloadCsv = (filename: string, columns: string[], rows: Array<Array<string | number | boolean | null>>) => {
  const csv = [columns, ...rows].map((row) => row.map((value) => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
};

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
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'activity' | 'audit' | 'privacy'>('overview');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [retention, setRetention] = useState<Retention>({ event_retention_days: 90, session_retention_days: 180, consent_retention_days: 730, technical_event_retention_days: 90, audit_log_retention_days: 2555 });
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eraseIdentifier, setEraseIdentifier] = useState('');
  const [eraseType, setEraseType] = useState<'visitor_id' | 'user_id'>('visitor_id');
  const [erasing, setErasing] = useState(false);
  const [eraseResult, setEraseResult] = useState('');
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

  const topPages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of events) if (item.event_name === 'page_view' && item.page_path) counts.set(item.page_path, (counts.get(item.page_path) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [events]);

  const deviceBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of sessions) {
      const key = item.device_type || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [sessions]);

  const topCampaigns = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of sessions) if (item.utm_campaign) counts.set(item.utm_campaign, (counts.get(item.utm_campaign) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [sessions]);

  const topLocations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of sessions) {
      if (item.location_source !== 'ip_approximate') continue;
      const label = [item.city, item.region_name, item.country_name || item.country_code].filter(Boolean).join(', ');
      if (label) counts.set(label, (counts.get(label) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [sessions]);

  const topLanguages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of sessions) {
      const preferences = Array.from(new Set(item.language_preferences?.length ? item.language_preferences : [item.locale || item.language || '']));
      for (const language of preferences.filter(Boolean)) counts.set(language, (counts.get(language) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter((item) => !term || [
      item.id, item.visitor_id, item.user_id, item.landing_path, item.referrer_host, item.utm_source,
      item.utm_campaign, item.utm_term, item.utm_content, item.browser_family, item.os_family, item.device_type, item.language, item.locale, ...(item.language_preferences || []), item.timezone, item.country_name, item.region_name, item.city,
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

  const exportCsv = () => downloadCsv('awesome-adventure-visitor-events-' + new Date().toISOString().slice(0,10) + '.csv',
    ['Occurred at','Event','Session ID','User ID','Page','Duration ms','Event data'],
    visibleEvents.map((item) => [item.occurred_at, item.event_name, item.session_id, item.user_id || '', item.page_path || '', item.duration_ms ?? '', JSON.stringify(item.event_data || {})]));

  const exportSessionsCsv = () => downloadCsv('awesome-adventure-sessions-' + new Date().toISOString().slice(0,10) + '.csv',
    ['Session ID','Visitor ID','User ID','Started','Last seen','Landing page','Referrer','UTM source','UTM medium','UTM campaign','UTM term','UTM content','Device','Browser','OS','Platform','Mobile','Viewport','Screen','Language','Locale','Preferred languages','Timezone','City','Region','Country','Location accuracy','Analytics consent','Marketing consent'],
    visibleSessions.map((item) => [item.id,item.visitor_id,item.user_id || '',item.started_at,item.last_seen_at,item.landing_path,item.referrer_host || '',item.utm_source || '',item.utm_medium || '',item.utm_campaign || '',item.utm_term || '',item.utm_content || '',item.device_type || '',item.browser_family || '',item.os_family || '',item.platform_family || '',item.is_mobile ?? '',item.viewport_bucket || '',item.screen_bucket || '',item.language || '',item.locale || '',(item.language_preferences || []).join('; '),item.timezone || '',item.city || '',item.region_name || '',item.country_name || item.country_code || '',item.location_source === 'ip_approximate' ? 'Approximate (IP)' : '',item.analytics_consent,item.marketing_consent]));

  const exportConsentCsv = () => downloadCsv('awesome-adventure-consent-history-' + new Date().toISOString().slice(0,10) + '.csv',
    ['Recorded at','Visitor ID','User ID','Necessary','Analytics','Marketing','Consent version','Source'],
    consents.map((item) => [item.recorded_at,item.visitor_id || '',item.user_id || '',item.necessary,item.analytics,item.marketing,item.consent_version,item.consent_source]));

  const exportAuditCsv = () => downloadCsv('awesome-adventure-audit-history-' + new Date().toISOString().slice(0,10) + '.csv',
    ['Created at','Action','Entity type','Entity ID','Actor user ID','Before','After'],
    auditRecords.map((item) => [item.created_at,item.action,item.entity_type,item.entity_id || '',item.user_id || '',JSON.stringify(item.old_data || {}),JSON.stringify(item.new_data || {})]));

  const eraseVisitor = async () => {
    const identifier = eraseIdentifier.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)) {
      setError('Enter a valid visitor or user ID before erasing analytics.');
      return;
    }
    if (!window.confirm('Erase this visitor’s optional analytics and anonymize their consent links? Booking, payment, support and account records will not be changed.')) return;
    setErasing(true); setError(''); setEraseResult('');
    try {
      const result = await api<{ erasedSessions: number; erasedEvents: number; anonymizedConsents: number }>('/api/admin/technical/visitors/erase', {
        method: 'POST', body: JSON.stringify({ identifier_type: eraseType, identifier }),
      });
      setEraseResult(`Erased ${result.erasedEvents} events and ${result.erasedSessions} sessions; anonymized ${result.anonymizedConsents} consent records.`);
      setEraseIdentifier('');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Visitor analytics could not be erased.'); }
    finally { setErasing(false); }
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
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#b58b3a]" /><h2 className="text-lg font-bold">Visitor analytics & privacy</h2></div>
          <p className="mt-1 text-xs text-slate-500">A single workspace for consented visitor activity, business audit history, and data controls.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-600 dark:bg-slate-900"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          <button type="button" onClick={exportCsv} disabled={!visibleEvents.length} className="rounded-lg bg-[#d6ad5b] px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">Export events</button>
          <button type="button" onClick={exportSessionsCsv} disabled={!visibleSessions.length} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-600 dark:bg-slate-900 disabled:opacity-50">Export sessions</button>
          <button type="button" onClick={exportConsentCsv} disabled={!consents.length} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-600 dark:bg-slate-900 disabled:opacity-50">Export consent</button>
          <button type="button" onClick={exportAuditCsv} disabled={!auditRecords.length} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-600 dark:bg-slate-900 disabled:opacity-50">Export audit</button>
        </div>
      </div>

      <nav aria-label="Visitor analytics sections" className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
        {([
          ['overview','Overview'],
          ['activity','Sessions & activity'],
          ['audit','Audit trail'],
          ['privacy','Privacy & retention'],
        ] as const).map(([key,label]) => (
          <button key={key} type="button" onClick={() => setActiveSection(key)} aria-pressed={activeSection === key}
            className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-colors ${activeSection === key ? 'bg-[#0A6C74] text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {label}
          </button>
        ))}
      </nav>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}
      {loading && !overview && <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">Loading visitor analytics…</p>}

      {activeSection === 'overview' && overview && <>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <Card label="Consented sessions · 30d" value={overview.sessions} icon={Users} />
          <Card label="Unique visitors" value={overview.uniqueVisitors} icon={Eye} />
          <Card label="Returning visitors" value={overview.returningVisitors} icon={Users} />
          <Card label="Guest sessions" value={overview.guestSessions} icon={Eye} />
          <Card label="Signed-in sessions" value={overview.signedInSessions} icon={ShieldCheck} />
          <Card label="Tracked events" value={overview.events} icon={MousePointerClick} />
          <Card label="Consent records" value={overview.consentRecords} icon={Cookie} />
          <Card label="Analytics opt-ins" value={overview.analyticsOptIns} icon={Eye} />
          <Card label="Marketing opt-ins" value={overview.marketingOptIns} icon={Cookie} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="font-semibold">Booking conversion funnel · 30 days</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[['Started', overview.bookingFunnel.started], ['Steps completed', overview.bookingFunnel.stepsCompleted], ['Submitted', overview.bookingFunnel.submitted], ['Confirmed', overview.bookingFunnel.confirmed], ['Cancellation requests', overview.bookingFunnel.cancellationRequests]].map(([label,value]) => <div key={String(label)} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{Number(value).toLocaleString()}</p></div>)}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Only visitors who accepted analytics tracking are included.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ['Top pages', topPages],
            ['Devices', deviceBreakdown],
            ['Campaigns', topCampaigns],
            ['Approximate locations', topLocations],
            ['Preferred languages', topLanguages],
          ].map(([title, rows]) => <div key={String(title)} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-semibold">{title}</h3>
            <div className="mt-3 space-y-2">{(rows as Array<[string,number]>).map(([label,count]) => <div key={label} className="flex justify-between gap-2 text-xs"><span className="min-w-0 truncate text-slate-500">{label}</span><strong>{count}</strong></div>)}
              {!(rows as Array<[string,number]>).length && <p className="text-xs text-slate-500">No records available in this period.</p>}
            </div>
            {title === 'Approximate locations' && <p className="mt-2 text-[10px] text-slate-500">Approximate network-derived estimates, not GPS.</p>}
          </div>)}
        </div>
      </>}

      {activeSection === 'activity' && <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <label className="min-w-[130px] flex-1 text-[11px] text-slate-500">Device type<select value={deviceType} onChange={(e) => setDeviceType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-600 dark:bg-slate-800"><option value="">All devices</option><option value="desktop">Desktop</option><option value="mobile">Mobile</option><option value="tablet">Tablet</option><option value="other">Other</option></select></label>
          <label className="min-w-[160px] flex-1 text-[11px] text-slate-500">Event type<select value={eventType} onChange={(e) => setEventType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-600 dark:bg-slate-800"><option value="">All event types</option>{['page_view','navigation','tour_view','tour_search','tour_filter_applied','booking_started','booking_step_viewed','booking_step_completed','booking_submitted','booking_confirmed','booking_lookup','booking_cancellation_requested','auth_sign_in','auth_sign_in_failed','auth_sign_up','auth_sign_out','profile_updated','password_reset_requested','password_changed','confirmation_email_resent','email_confirmed','mfa_verified','contact_request_submitted','newsletter_subscribed','inquiry_submitted','support_ticket_created','support_reply_sent','support_ticket_updated','chatbot_interaction','wishlist_updated','comparison_updated','review_submitted','tour_shared','language_changed','currency_changed'].map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></label>
          <label className="text-[11px] text-slate-500">From<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-600 dark:bg-slate-800" /></label>
          <label className="text-[11px] text-slate-500">To<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs dark:border-slate-600 dark:bg-slate-800" /></label>
          <label className="min-w-[200px] flex-[2] text-[11px] text-slate-500">Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Visitor, page, browser, campaign…" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-800" /></label>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2"><div><h3 className="font-semibold">Visitor sessions</h3><p className="mt-1 text-xs text-slate-500">{visibleSessions.length} matching sessions · select to filter timeline</p></div>{selectedSession && <button type="button" onClick={() => setSelectedSession('')} className="text-xs font-semibold text-[#9a702b] underline">Clear selection</button>}</div>
            <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">
              {visibleSessions.map((item) => <div key={item.id} className={`rounded-lg border p-3 text-xs ${selectedSession === item.id ? 'border-[#b58b3a] bg-amber-50 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => setSelectedSession((current) => current === item.id ? '' : item.id)} className="font-mono font-semibold underline">{item.id.slice(0,8)}… · {item.user_id ? 'Signed in' : 'Guest'}</button><span className="text-slate-500">{date(item.last_seen_at)}</span></div>
                <p className="mt-2 truncate font-semibold">{item.landing_path}</p>
                <p className="mt-1 text-slate-500">{[item.device_type,item.browser_family,item.os_family].filter(Boolean).join(' · ') || 'Device unavailable'}</p>
                <p className="mt-1 text-slate-500">{[item.city,item.region_name,item.country_name || item.country_code].filter(Boolean).join(', ') || 'Approximate location unavailable'}{item.location_source === 'ip_approximate' ? ' · Approximate' : ''}</p>
                <p className="mt-1 text-slate-500">{[item.language,item.locale,...(item.language_preferences || [])].filter(Boolean).join(' · ')}</p>
                <div className="mt-2 flex flex-wrap gap-3"><button type="button" onClick={() => { setEraseType('visitor_id'); setEraseIdentifier(item.visitor_id); setActiveSection('privacy'); }} className="font-semibold text-[#9a702b] underline">Select visitor for erasure</button>{item.user_id && <button type="button" onClick={() => { setEraseType('user_id'); setEraseIdentifier(item.user_id || ''); setActiveSection('privacy'); }} className="font-semibold text-[#9a702b] underline">Select account</button>}</div>
              </div>)}
              {!visibleSessions.length && <p className="py-6 text-center text-xs text-slate-500">No matching sessions.</p>}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="font-semibold">Activity timeline</h3><p className="mt-1 text-xs text-slate-500">{selectedSession ? 'Filtered to selected session' : 'All recent consented activity'} · {visibleEvents.length} records</p>
            <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">
              {visibleEvents.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.event_name.replace(/_/g, ' ')}</strong><div className="flex items-center gap-3"><time className="text-slate-500">{date(item.occurred_at)}</time><button type="button" onClick={() => setExpandedEventId((current) => current === item.id ? null : item.id)} className="font-semibold text-[#9a702b] underline">{expandedEventId === item.id ? 'Hide' : 'Inspect'}</button></div></div>
                <p className="mt-1 break-all text-slate-600 dark:text-slate-300">{item.page_path || 'No page recorded'}</p><p className="mt-1 text-slate-500">Session {item.session_id.slice(0,8)}…{item.duration_ms !== null ? ' · ' + Math.round(item.duration_ms / 1000) + 's' : ''}</p>
                {expandedEventId === item.id && <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-[10px] dark:bg-slate-950">{JSON.stringify(item, null, 2)}</pre>}
              </article>)}
              {!visibleEvents.length && <p className="py-6 text-center text-xs text-slate-500">No activity matches these filters.</p>}
            </div>
          </section>
        </div>
      </div>}

      {activeSection === 'audit' && <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Website and administration audit trail</h3><p className="mt-1 text-xs text-slate-500">Immutable history of business and administrator actions.</p></div><span className="text-xs text-slate-500">{auditRecords.length.toLocaleString()} recent records</span></div>
        <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">
          {auditRecords.filter((item) => !search.trim() || [item.action,item.entity_type,item.entity_id,item.user_id].some((value) => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))).map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{item.action.replace(/_/g, ' ')}</p><p className="mt-1 text-slate-500">{item.entity_type}{item.entity_id ? ' · ' + item.entity_id : ''}{item.user_id ? ' · User ' + item.user_id.slice(0,8) + '…' : ' · System action'}</p></div><div className="flex items-center gap-3"><time className="text-slate-500">{date(item.created_at)}</time><button type="button" onClick={() => setExpandedAuditId((current) => current === item.id ? null : item.id)} className="font-semibold text-[#9a702b] underline">{expandedAuditId === item.id ? 'Hide' : 'Inspect'}</button></div></div>
            {expandedAuditId === item.id && <div className="mt-3 grid gap-2 sm:grid-cols-2"><div><p className="mb-1 font-semibold text-slate-500">Before</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-[10px] dark:bg-slate-950">{JSON.stringify(item.old_data || {}, null, 2)}</pre></div><div><p className="mb-1 font-semibold text-slate-500">After</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-[10px] dark:bg-slate-950">{JSON.stringify(item.new_data || {}, null, 2)}</pre></div></div>}
          </article>)}
          {!auditRecords.length && <p className="py-6 text-center text-xs text-slate-500">No audit records found.</p>}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Audit entries cannot be edited or manually deleted. Before-and-after snapshots are redacted on the server; retention is controlled separately.</p>
      </section>}

      {activeSection === 'privacy' && <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2"><Cookie className="h-4 w-4 text-[#b58b3a]" /><h3 className="font-semibold">Consent history</h3></div>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-2">Recorded</th><th className="pb-2">Visitor / User</th><th className="pb-2">Necessary</th><th className="pb-2">Analytics</th><th className="pb-2">Marketing</th><th className="pb-2">Source</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{consents.map((item) => <tr key={item.id}><td className="py-2 pr-3 whitespace-nowrap">{date(item.recorded_at)}</td><td className="py-2 pr-3 font-mono">{(item.visitor_id || item.visitor_session_id || item.user_id || 'Unknown').slice(0,8)}…</td><td className="py-2 pr-3">{item.necessary ? 'Yes' : 'No'}</td><td className="py-2 pr-3">{item.analytics ? 'Accepted' : 'Declined'}</td><td className="py-2 pr-3">{item.marketing ? 'Accepted' : 'Declined'}</td><td className="py-2 pr-3">{item.consent_source}</td></tr>)}</tbody></table></div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#b58b3a]" /><h3 className="font-semibold">Data retention controls</h3></div>
          <p className="mt-1 text-xs text-slate-500">Edit how long each category is retained. Scheduled cleanup applies these settings automatically.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-xs font-medium">Events (7–730 days)<input type="number" min={7} max={730} value={retention.event_retention_days} onChange={(e) => setRetention((v) => ({ ...v, event_retention_days: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
            <label className="text-xs font-medium">Sessions (7–1,095 days)<input type="number" min={7} max={1095} value={retention.session_retention_days} onChange={(e) => setRetention((v) => ({ ...v, session_retention_days: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
            <label className="text-xs font-medium">Consent records (90–3,650 days)<input type="number" min={90} max={3650} value={retention.consent_retention_days} onChange={(e) => setRetention((v) => ({ ...v, consent_retention_days: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
            <label className="text-xs font-medium">Technical events (7–730 days)<input type="number" min={7} max={730} value={retention.technical_event_retention_days} onChange={(e) => setRetention((v) => ({ ...v, technical_event_retention_days: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
            <label className="text-xs font-medium">Business audit (1–10 years)<input type="number" min={365} max={3650} value={retention.audit_log_retention_days} onChange={(e) => setRetention((v) => ({ ...v, audit_log_retention_days: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
          </div>
          <button type="button" onClick={() => void saveRetention()} disabled={saving} className="mt-3 rounded-lg bg-[#d6ad5b] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? 'Saving…' : 'Save retention settings'}</button>
        </section>
        <section className="rounded-xl border border-rose-200 bg-white p-4 dark:border-rose-900 dark:bg-slate-900">
          <h3 className="font-semibold text-rose-700 dark:text-rose-300">Visitor analytics erasure</h3>
          <p className="mt-1 text-xs text-slate-500">Delete optional analytics sessions and events for a visitor or signed-in user. Consent receipts are anonymized. Bookings, payments, support tickets and account records are never changed.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select value={eraseType} onChange={(e) => setEraseType(e.target.value as 'visitor_id' | 'user_id')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-800"><option value="visitor_id">Visitor ID</option><option value="user_id">User ID</option></select>
            <input value={eraseIdentifier} onChange={(e) => setEraseIdentifier(e.target.value)} placeholder="Paste visitor or user UUID" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-800" />
            <button type="button" onClick={() => void eraseVisitor()} disabled={erasing || !eraseIdentifier.trim()} className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{erasing ? 'Erasing…' : 'Erase visitor data'}</button>
          </div>
          {eraseResult && <p role="status" className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{eraseResult}</p>}
        </section>
        <p className="text-[11px] leading-5 text-slate-500">Privacy safeguards: analytics starts only after consent. Raw IP addresses, full browser fingerprints, raw cookies, passwords, session tokens, form contents and payment credentials are not collected.</p>
      </div>}
    </section>
  );
};