import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

type AuthDirectoryUser = {
  id: string; email: string; full_name: string; created_at: string;
  last_sign_in_at: string | null; is_confirmed: boolean; is_suspended: boolean;
};
type Props = { isSuperAdmin: boolean };

export const AdminAuthDirectory: React.FC<Props> = ({ isSuperAdmin }) => {
  const [users, setUsers] = useState<AuthDirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true); setError('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Your Super Admin session has expired. Sign in again.');
      const response = await fetch('/api/admin/users', { headers: { Authorization: 'Bearer ' + session.access_token } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success || !Array.isArray(result.users)) throw new Error(result.error || 'The Auth directory could not be loaded.');
      setUsers(result.users); setTruncated(Boolean(result.truncated));
    } catch (err: any) {
      setError(err?.message || 'The Auth directory could not be loaded.');
    } finally { setLoading(false); }
  }, [isSuperAdmin]);

  useEffect(() => { void refresh(); }, [refresh]);
  if (!isSuperAdmin) return null;

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#0A6C74] text-xs font-bold uppercase tracking-widest"><ShieldCheck className="w-4 h-4"/> Supabase Auth directory</div>
          <h3 className="font-bold text-sm mt-1">Authentication accounts</h3>
          <p className="text-xs text-slate-500 mt-1">Read-only account inventory. Available only to a verified Super Admin with MFA.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">
          <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')}/> Refresh directory
        </button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 text-xs">{error}</p>}
      <div className="mt-3 grid sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
        {users.map(account => (
          <div key={account.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 min-w-0">
            <div className="text-xs font-semibold break-all">{account.email || 'No email address'}</div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">{account.full_name || 'Unnamed account'}</div>
            <div className="flex flex-wrap gap-1 mt-2">
              <span className={'text-[10px] rounded-md px-2 py-1 ' + (account.is_suspended ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300')}>{account.is_suspended ? 'Suspended' : 'Active'}</span>
              <span className="text-[10px] rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1">{account.is_confirmed ? 'Email verified' : 'Unverified'}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">Last sign-in: {account.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleString() : 'Never'}</div>
          </div>
        ))}
        {!users.length && !loading && !error && <p className="text-xs text-slate-500 py-3">No Auth accounts were returned.</p>}
        {loading && !users.length && <p className="text-xs text-slate-500 py-3">Loading secure Auth directory…</p>}
      </div>
      {truncated && <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2">Showing the first 2,000 accounts.</p>}
    </section>
  );
};
export default AdminAuthDirectory;
