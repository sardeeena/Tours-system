import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck } from 'lucide-react';
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
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true); setError('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Your administrator session has expired. Sign in again.');
      const response = await fetch('/api/admin/users', { headers: { Authorization: 'Bearer ' + session.access_token } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success || !Array.isArray(result.users)) throw new Error(result.error || 'The account directory could not be loaded.');
      setUsers(result.users); setTruncated(Boolean(result.truncated));
    } catch (err: any) {
      setError(err?.message || 'The account directory could not be loaded.');
    } finally { setLoading(false); }
  }, [isSuperAdmin]);

  useEffect(() => { void refresh(); }, [refresh]);
  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter(account => [account.email, account.full_name].join(' ').toLowerCase().includes(query));
  }, [users, search]);

  if (!isSuperAdmin) return null;

  return (
    <section className="admin-section min-w-0 border-t border-slate-200 dark:border-slate-700 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-300 text-xs font-bold uppercase tracking-wider"><ShieldCheck className="w-4 h-4"/> All login accounts</div>
          <h3 className="font-bold text-base mt-1">Account directory <span className="font-normal text-slate-500">({users.length.toLocaleString()})</span></h3>
          <p className="text-xs text-slate-500 mt-1">Read-only overview of account status and recent sign-in activity.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
          <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')}/> Refresh list
        </button>
      </div>
      <div className="relative mt-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find an account by name or email…" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm"/>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 text-xs">{error}</p>}
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/70">
            <tr>
              <th className="px-3 py-3">Account</th>
              <th className="px-3 py-3">Access status</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Last sign-in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {visibleUsers.map(account => (
              <tr key={account.id}>
                <td className="px-3 py-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">{account.full_name || 'Unnamed account'}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <span className={'inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ' + (account.is_suspended ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300')}>{account.is_suspended ? 'Suspended' : 'Active'}</span>
                    <span className={'inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ' + (account.is_confirmed ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300')}>{account.is_confirmed ? 'Email verified' : 'Unverified'}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{account.email || '—'}</td>
                <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{account.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleString() : 'Never signed in'}</td>
              </tr>
            ))}
            {!visibleUsers.length && !loading && !error && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">{search ? 'No accounts match your search.' : 'No accounts were returned.'}</td></tr>}
            {loading && !users.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">Loading account list…</td></tr>}
          </tbody>
        </table>
      </div>
      {truncated && <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2">Showing the first 2,000 accounts. Refine your search or review the account list in sections.</p>}
    </section>
  );
};
export default AdminAuthDirectory;
