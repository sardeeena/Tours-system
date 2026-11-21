import type { SupabaseClient } from '@supabase/supabase-js';
import { startWorkerLease } from './workerLease';

const SCAN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Periodically materializes staff alerts from authoritative database tables.
 * The database RPC is idempotent through unique dedup_key values.
 */
export function startStaffNotificationWorker(client: SupabaseClient): () => void {
  if (process.env.STAFF_NOTIFICATION_WORKER_ENABLED?.trim().toLowerCase() === 'false') {
    console.info('[Staff Notification Worker] Disabled by configuration.');
    return () => undefined;
  }

  let running = false;
  const scan = async () => {
    if (running) return;
    running = true;
    try {
      const { data, error } = await client.rpc('scan_staff_notifications');
      if (error) throw error;
      const inserted = Number((data as any)?.inserted || 0);
      if (inserted > 0) console.info('[Staff Notification Worker] Persisted new alerts:', inserted);
    } catch (error) {
      console.error('[Staff Notification Worker] Scan failed:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      running = false;
    }
  };

  const lease = startWorkerLease(client, 'staff_notification', (leader) => {
    if (leader) void scan();
  });
  const timer = setInterval(() => {
    if (lease.isLeader()) void scan();
  }, SCAN_INTERVAL_MS);
  timer.unref();

  console.info('[Staff Notification Worker] Started; waiting for the distributed worker lease.');
  return () => {
    clearInterval(timer);
    lease.stop();
  };
}
