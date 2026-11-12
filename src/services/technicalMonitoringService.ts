import { supabase, isSupabaseConfigured } from './supabaseClient';

export type TechnicalSeverity = 'info' | 'warning' | 'error';

export interface TechnicalEvent {
  id: string;
  created_at: string;
  severity: TechnicalSeverity;
  event_type: string;
  source: string;
  message: string;
  request_method: string | null;
  request_path: string | null;
  status_code: number | null;
  duration_ms: number | null;
  actor_user_id: string | null;
  metadata: Record<string, unknown>;
}

export interface TechnicalAuditEvent {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
}

export interface TechnicalOverview {
  generatedAt: string;
  runtime: {
    status: 'ok';
    nodeVersion: string;
    environment: string;
    uptimeSeconds: number;
    appVersion: string;
  };
  services: {
    database: { status: 'ok' | 'error'; latencyMs: number | null };
    storage: { status: 'ok' | 'error'; bucketCount: number | null };
    email: { configured: boolean; webhookConfigured: boolean };
    whatsapp: { configured: boolean };
    bookingWorker: { enabled: boolean };
  };
  metrics: {
    requests24h: number;
    errors24h: number;
    warnings24h: number;
    errorRatePct: number;
    averageLatencyMs: number | null;
    p95LatencyMs: number | null;
    latencySampleSize: number;
  };
  recentEvents: TechnicalEvent[];
  recentAuditEvents: TechnicalAuditEvent[];
}

async function authorizedFetch<T>(path: string): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Technical diagnostics are unavailable.');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Your secure administrator session has expired. Sign in again.');
  }

  const response = await fetch(path, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : `Technical diagnostics request failed (${response.status}).`);
  }
  return payload as T;
}

export async function fetchTechnicalOverview(): Promise<TechnicalOverview> {
  return authorizedFetch<TechnicalOverview>('/api/admin/technical/overview');
}

export async function fetchTechnicalEvents(filters: {
  severity?: TechnicalSeverity | 'all';
  limit?: number;
} = {}): Promise<TechnicalEvent[]> {
  const params = new URLSearchParams();
  if (filters.severity && filters.severity !== 'all') params.set('severity', filters.severity);
  params.set('limit', String(Math.min(200, Math.max(1, filters.limit || 100))));
  const result = await authorizedFetch<{ events: TechnicalEvent[] }>(`/api/admin/technical/events?${params.toString()}`);
  return result.events;
}
