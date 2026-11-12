import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle2, Clock3, Database,
  Download, HardDrive, RefreshCw, Server, ShieldCheck, XCircle,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  fetchTechnicalEvents, fetchTechnicalOverview,
  type TechnicalEvent, type TechnicalOverview, type TechnicalSeverity,
} from '../../../services/technicalMonitoringService';

const formatDuration = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days ? `${days}d` : '', hours ? `${hours}h` : '', `${minutes}m`].filter(Boolean).join(' ');
};

const dateTime = (value: string) => new Date(value).toLocaleString();

const Status = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>
    {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
    {children}
  </span>
);

const severityClass: Record<TechnicalSeverity, string> = {
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  error: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};

export const TechnicalControlCenter: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user && (user.role === 'super_admin' || user.roles?.includes('super_admin')));
  const [overview, setOverview] = useState<TechnicalOverview | null>(null);
  const [events, setEvents] = useState<TechnicalEvent[]>([]);
  const [severity, setSeverity] = useState<TechnicalSeverity | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setRefreshing(true);
    setError('');
    try {
      const [summary, rows] = await Promise.all([
        fetchTechnicalOverview(),
        fetchTechnicalEvents({ severity, limit: 150 }),
      ]);
      setOverview(summary);
      setEvents(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load technical diagnostics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [severity]);

  useEffect(() => {
    if (isSuperAdmin) void load();
  }, [isSuperAdmin, load]);

  const exportCsv = () => {
    const columns = ['Timestamp','Severity','Type','Source','Message','Method','Route','Status','Duration ms','Actor ID'];
    const rows = events.map((event) => [
      event.created_at, event.severity, event.event_type, event.source, event.message,
      event.request_method || '', event.request_path || '', event.status_code ?? '',
      event.duration_ms ?? '', event.actor_user_id || '',
    ]);
    const csv = [columns, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `awesome-adventure-technical-events-${new Date().toISOString().slice(0,10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const cards = useMemo(() => overview ? [
    { label: 'API requests · 24h', value: overview.metrics.requests24h.toLocaleString(), icon: Activity },
    { label: 'Errors · 24h', value: overview.metrics.errors24h.toLocaleString(), icon: AlertCircle },
    { label: 'Average response', value: overview.metrics.averageLatencyMs === null ? '—' : `${overview.metrics.averageLatencyMs} ms`, icon: Clock3 },
    { label: 'Error rate · 24h', value: `${overview.metrics.errorRatePct.toFixed(2)}%`, icon: AlertTriangle },
  ] : [], [overview]);

  if (!isSuperAdmin) {
    return <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950/20"><ShieldCheck className="mx-auto h-9 w-9 text-rose-600" /><h1 className="mt-3 text-lg font-bold">Superadmin access only</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">This technical control center is restricted to a verified superadmin session.</p></div>;
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="overflow-hidden rounded-2xl border border-[#26364b] bg-[#101b2b] text-white shadow-lg">
        <div className="flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d6ad5b]/30 bg-[#d6ad5b]/10 text-[#e6c77f]"><Server className="h-5 w-5" /></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d6ad5b]">Superadmin · Private</p><h1 className="mt-1 text-xl font-bold sm:text-2xl">Technical Control Center</h1><p className="mt-1 text-xs text-slate-300">Live application telemetry, diagnostics and security activity.</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button>
            <button type="button" onClick={exportCsv} disabled={!events.length} className="inline-flex items-center gap-2 rounded-lg bg-[#d6ad5b] px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-[#e5c77f] disabled:opacity-50"><Download className="h-4 w-4" /> Export logs</button>
          </div>
        </div>
        {overview && <div className="grid grid-cols-2 gap-px bg-white/10 md:grid-cols-4">{cards.map(({label,value,icon:Icon}) => <div key={label} className="bg-[#142238] p-4"><div className="flex items-center justify-between gap-2 text-xs text-slate-300"><span>{label}</span><Icon className="h-4 w-4 text-[#d6ad5b]" /></div><div className="mt-2 text-2xl font-bold tabular-nums">{loading ? '—' : value}</div></div>)}</div>}
      </section>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200">{error}</div>}
      {loading && !overview && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">Loading secure technical diagnostics…</div>}

      {overview && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2 text-sm font-semibold"><Server className="h-4 w-4 text-[#b58b3a]" /> Application runtime</div><div className="mt-3"><Status ok={overview.runtime.status === 'ok'}>Running</Status></div><p className="mt-2 text-xs text-slate-500">Node {overview.runtime.nodeVersion} · {overview.runtime.environment}</p><p className="mt-1 text-xs text-slate-500">Uptime {formatDuration(overview.runtime.uptimeSeconds)} · v{overview.runtime.appVersion}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2 text-sm font-semibold"><Database className="h-4 w-4 text-[#b58b3a]" /> Supabase database</div><div className="mt-3"><Status ok={overview.services.database.status === 'ok'}>{overview.services.database.status === 'ok' ? 'Connected' : 'Unavailable'}</Status></div><p className="mt-2 text-xs text-slate-500">Measured query: {overview.services.database.latencyMs === null ? '—' : `${overview.services.database.latencyMs} ms`}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2 text-sm font-semibold"><HardDrive className="h-4 w-4 text-[#b58b3a]" /> Supabase storage</div><div className="mt-3"><Status ok={overview.services.storage.status === 'ok'}>{overview.services.storage.status === 'ok' ? 'Reachable' : 'Unavailable'}</Status></div><p className="mt-2 text-xs text-slate-500">Buckets: {overview.services.storage.bucketCount ?? '—'}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-[#b58b3a]" /> Integrations</div><div className="mt-3 flex flex-wrap gap-2"><Status ok={overview.services.email.configured}>Email</Status><Status ok={overview.services.email.webhookConfigured}>Webhook</Status><Status ok={overview.services.whatsapp.configured}>WhatsApp</Status><Status ok={overview.services.bookingWorker.enabled}>Worker enabled</Status></div><p className="mt-2 text-xs text-slate-500">Configuration presence only; no secrets are displayed.</p></div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-semibold">API performance · last 24 hours</h2><div className="mt-4 grid grid-cols-2 gap-4"><div><p className="text-xs text-slate-500">P95 response</p><p className="mt-1 text-xl font-bold">{overview.metrics.p95LatencyMs === null ? '—' : `${overview.metrics.p95LatencyMs} ms`}</p></div><div><p className="text-xs text-slate-500">Latency sample</p><p className="mt-1 text-xl font-bold">{overview.metrics.latencySampleSize.toLocaleString()}</p></div></div><p className="mt-3 text-xs text-slate-500">Latency percentiles are calculated from the most recent captured request sample.</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-semibold">Security and administration</h2><p className="mt-3 text-2xl font-bold">{overview.recentAuditEvents.length}</p><p className="text-xs text-slate-500">Recent audit records returned</p><div className="mt-3 max-h-32 space-y-2 overflow-auto">{overview.recentAuditEvents.slice(0,5).map((item) => <div key={item.id} className="flex items-start justify-between gap-2 text-xs"><span className="font-medium">{item.action}</span><span className="shrink-0 text-slate-500">{dateTime(item.created_at)}</span></div>)}</div></div>
        </section>
      </>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Technical event log</h2><p className="mt-1 text-xs text-slate-500">Sanitized API request telemetry. Request bodies, query values, credentials and secrets are never recorded.</p></div><select value={severity} onChange={(event) => setSeverity(event.target.value as TechnicalSeverity | 'all')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"><option value="all">All severities</option><option value="error">Errors</option><option value="warning">Warnings</option><option value="info">Info</option></select></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/70"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Actor</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{events.map((event) => <tr key={event.id} className="align-top"><td className="whitespace-nowrap px-4 py-3 text-slate-500">{dateTime(event.created_at)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 font-semibold uppercase ${severityClass[event.severity]}`}>{event.severity}</span></td><td className="px-4 py-3"><div className="font-semibold">{event.request_method || event.event_type}</div><div className="mt-1 max-w-[360px] break-all text-slate-500">{event.request_path || event.message}</div></td><td className="px-4 py-3 tabular-nums">{event.status_code ?? '—'}</td><td className="px-4 py-3 tabular-nums">{event.duration_ms === null ? '—' : `${event.duration_ms} ms`}</td><td className="px-4 py-3 font-mono text-slate-500">{event.actor_user_id ? `${event.actor_user_id.slice(0,8)}…` : 'Guest / system'}</td></tr>)}</tbody></table></div>
        {!events.length && !loading && <div className="p-8 text-center text-sm text-slate-500">No technical events match this filter yet.</div>}
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">Showing up to 150 recent records · Last refreshed {overview ? dateTime(overview.generatedAt) : '—'}</div>
      </section>
    </div>
  );
};
