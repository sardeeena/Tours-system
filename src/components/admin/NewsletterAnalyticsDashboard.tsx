import React, { useMemo, useState } from 'react';
import { TrendingUp, Users, UserCheck, UserMinus, Mail, Info } from 'lucide-react';
import { NewsletterSubscriber } from '../../services/newsletterService';

interface NewsletterAnalyticsDashboardProps {
  subscribers: NewsletterSubscriber[];
}

export const NewsletterAnalyticsDashboard: React.FC<NewsletterAnalyticsDashboardProps> = ({ subscribers }) => {
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '180d' | 'all'>('90d');
  const active = subscribers.filter((subscriber) => subscriber.status === 'subscribed').length;
  const unsubscribed = subscribers.length - active;

  const growth = useMemo(() => {
    const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : timeRange === '180d' ? 180 : null;
    const cutoff = days === null ? 0 : Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = subscribers.filter((subscriber) => {
      const timestamp = Date.parse(subscriber.createdAt);
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
    const byDate = new Map<string, number>();
    rows.forEach((subscriber) => {
      const date = new Date(subscriber.createdAt).toISOString().slice(0, 10);
      byDate.set(date, (byDate.get(date) || 0) + 1);
    });
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [subscribers, timeRange]);

  const recentCount = growth.reduce((sum, [, count]) => sum + count, 0);
  const maxDaily = Math.max(1, ...growth.map(([, count]) => count));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-950 p-4 rounded-xl border border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#2dd4bf]" />
            <h3 className="text-base font-bold text-white">Newsletter audience overview</h3>
          </div>
          <p className="text-xs text-stone-400 mt-1">Track subscriber growth and signup activity.</p>
        </div>
        <div className="flex bg-stone-900 p-1 rounded-lg border border-stone-800 text-xs">
          {(['30d', '90d', '180d', 'all'] as const).map((range) => (
            <button key={range} type="button" onClick={() => setTimeRange(range)} className={`px-3 py-1 rounded font-medium uppercase ${timeRange === range ? 'bg-stone-700 text-[#2dd4bf]' : 'text-stone-400 hover:text-white'}`}>
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-stone-400 text-xs"><Users className="w-4 h-4" /> Total stored subscribers</div>
          <p className="text-2xl font-bold text-white mt-2">{subscribers.length.toLocaleString()}</p>
        </div>
        <div className="bg-stone-950 border border-emerald-900/40 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-emerald-400 text-xs"><UserCheck className="w-4 h-4" /> Active subscribers</div>
          <p className="text-2xl font-bold text-emerald-300 mt-2">{active.toLocaleString()}</p>
        </div>
        <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-stone-400 text-xs"><UserMinus className="w-4 h-4" /> Unsubscribed</div>
          <p className="text-2xl font-bold text-stone-300 mt-2">{unsubscribed.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-white">New subscriptions</h4>
            <p className="text-xs text-stone-400 mt-1">{recentCount.toLocaleString()} signup(s) in the selected period</p>
          </div>
          <Mail className="w-5 h-5 text-teal-400" />
        </div>
        {growth.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-700 p-8 text-center">
            <Users className="w-7 h-7 mx-auto text-stone-500 mb-2" />
            <p className="text-sm text-stone-300">No newsletter signups recorded for this period.</p>
            <p className="text-xs text-stone-500 mt-1">The chart will populate automatically when real subscriptions are saved.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {growth.slice(-14).map(([date, count]) => (
              <div key={date} className="grid grid-cols-[92px_1fr_36px] items-center gap-3 text-xs">
                <span className="text-stone-400">{new Date(`${date}T00:00:00`).toLocaleDateString()}</span>
                <div className="h-2 rounded-full bg-stone-800 overflow-hidden">
                  <div className="h-full rounded-full bg-teal-500" style={{ width: `${(count / maxDaily) * 100}%` }} />
                </div>
                <span className="text-right font-semibold text-stone-200">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 flex gap-3">
        <Info className="w-5 h-5 text-amber-300 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-amber-100">Campaign engagement is not yet connected</p>
          <p className="text-xs text-amber-200/80 mt-1">Open rates, clicks, campaign-attributed bookings and revenue are intentionally not estimated. They will appear here only after real campaign records and verified email-provider events are stored.</p>
        </div>
      </div>
    </div>
  );
};
