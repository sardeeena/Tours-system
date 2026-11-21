import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type BackgroundWorkerName = 'booking_notification' | 'staff_notification';

const LEASE_SECONDS = 90;
const LEASE_REFRESH_INTERVAL_MS = 30_000;
const LEASE_CONFIRMATION_MAX_AGE_MS = 45_000;

/**
 * Coordinates one active worker per job across all Node.js processes.
 * The database lease is fail-closed: a worker stops doing work when it cannot
 * confirm ownership. Expired leases allow another healthy process to take over.
 */
export function startWorkerLease(
  client: SupabaseClient,
  workerName: BackgroundWorkerName,
  onLeadershipChange: (isLeader: boolean) => void
): { isLeader: () => boolean; stop: () => void } {
  const ownerId = randomUUID();
  let leader = false;
  let stopped = false;
  let refreshing = false;
  let lastConfirmedAt = 0;
  let lastErrorLoggedAt = 0;

  const refresh = async (): Promise<void> => {
    if (stopped || refreshing) return;
    refreshing = true;

    try {
      const { data, error } = await client.rpc('acquire_background_worker_lease', {
        p_worker_name: workerName,
        p_owner_id: ownerId,
        p_lease_seconds: LEASE_SECONDS,
      });
      if (error) throw error;

      const acquired = data === true;
      lastConfirmedAt = acquired ? Date.now() : 0;
      if (leader !== acquired) {
        leader = acquired;
        onLeadershipChange(acquired);
      }
    } catch (error) {
      lastConfirmedAt = 0;
      if (leader) {
        leader = false;
        onLeadershipChange(false);
      }
      if (Date.now() - lastErrorLoggedAt >= 5 * 60_000) {
        lastErrorLoggedAt = Date.now();
        console.error('[Background Worker Lease] Lease refresh failed; worker paused.', {
          workerName,
          error: error instanceof Error ? error.message : 'Unknown lease error',
        });
      }
    } finally {
      refreshing = false;
    }
  };

  const timer = setInterval(() => void refresh(), LEASE_REFRESH_INTERVAL_MS);
  timer.unref();
  void refresh();

  return {
    isLeader: () => leader && Date.now() - lastConfirmedAt <= LEASE_CONFIRMATION_MAX_AGE_MS,
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      if (leader) {
        leader = false;
        onLeadershipChange(false);
        void client.rpc('release_background_worker_lease', {
          p_worker_name: workerName,
          p_owner_id: ownerId,
        }).then(
          ({ error }) => {
            if (error) {
              console.error('[Background Worker Lease] Lease release failed.', {
                workerName,
                error: error.message,
              });
            }
          },
          (error: unknown) => {
            console.error('[Background Worker Lease] Lease release failed.', {
              workerName,
              error: error instanceof Error ? error.message : 'Unknown lease error',
            });
          }
        );
      }
    },
  };
}
