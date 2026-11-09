import React from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Globe,
  Building,
  DollarSign,
  Crown,
  Star,
  ExternalLink,
  UserMinus,
  RotateCcw,
  Compass,
  Clock,
  Sparkles,
} from 'lucide-react';
import { CustomerMetrics, DateRangeInterval } from '../../../types/reporting';

interface CustomerDashboardViewProps {
  metrics: CustomerMetrics;
  interval: DateRangeInterval;
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const CustomerDashboardView: React.FC<CustomerDashboardViewProps> = ({
  metrics,
  interval,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Cards: Cohorts, LTV, Retention, Inactive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Customers */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <span className="text-xs text-stone-400 font-medium">Customer Accounts</span>
          <div className="text-2xl lg:text-3xl font-bold text-white mt-1 font-mono">
            {metrics.totalCustomersCount}
          </div>
          <span className="text-[11px] text-teal-400 mt-1 block">Unified guest profiles</span>
        </div>

        {/* New vs Repeat */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <span className="text-xs text-stone-400 font-medium">Customer Retention</span>
          <div className="text-2xl lg:text-3xl font-bold text-sky-400 mt-1 font-mono">
            {metrics.customerRetentionRatePct}%
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            {metrics.repeatCustomersCount} Repeat · {metrics.newCustomersCount} New
          </span>
        </div>

        {/* Customer Lifetime Value */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <span className="text-xs text-stone-400 font-medium">Lifetime Value (LTV)</span>
          <div className="text-2xl lg:text-3xl font-bold text-emerald-400 mt-1 font-mono">
            €{metrics.customerLifetimeValueEur.toFixed(2)}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">Avg spend per guest account</span>
        </div>

        {/* Inactive Customers */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <span className="text-xs text-stone-400 font-medium">Inactive Guests</span>
          <div className="text-2xl lg:text-3xl font-bold text-amber-400 mt-1 font-mono">
            {metrics.inactiveCustomersCount}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">No booking in &gt; 90 days</span>
        </div>

        {/* VIP Tier Cohort */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <span className="text-xs text-stone-400 font-medium">VIP Tier Cohort</span>
          <div className="text-2xl lg:text-3xl font-bold text-purple-400 mt-1 font-mono">
            {metrics.topCustomers.filter((c) => c.status === 'VIP').length}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">&ge; €500 or 3+ bookings</span>
        </div>
      </div>

      {/* Middle Grid: Popular Tour Interests & Inactive Customers Re-engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Tour Interests */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <Compass className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold text-white">Popular Tour Interests &amp; Demand</h3>
            </div>
            <span className="text-[11px] text-stone-400">Demand breakdown</span>
          </div>

          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {metrics.popularTourInterests.length === 0 ? (
              <p className="text-stone-500 text-xs py-8 text-center">No tour interest data found.</p>
            ) : (
              metrics.popularTourInterests.map((interest) => (
                <div key={interest.tourTitle} className="p-3 bg-stone-950/70 border border-stone-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white truncate max-w-[280px]">{interest.tourTitle}</span>
                    <span className="font-mono text-teal-400 font-bold">{interest.totalGuests} guests</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>{interest.bookingsCount} bookings · {interest.inquiriesCount} inquiries</span>
                    <span className="text-stone-500">{interest.sharePct}% share</span>
                  </div>
                  <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, interest.sharePct * 2)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inactive Customers for Re-engagement */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <UserMinus className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Inactive Customers (&gt; 90 Days)</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('crm_followups')}
              className="text-xs text-teal-400 hover:text-teal-300 underline font-medium"
            >
              Follow-up Desk
            </button>
          </div>

          <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
            {metrics.inactiveCustomers.length === 0 ? (
              <p className="text-stone-500 text-xs py-8 text-center">No inactive customers. High guest engagement!</p>
            ) : (
              metrics.inactiveCustomers.map((cust) => (
                <div key={cust.id} className="p-3 bg-stone-950/70 border border-stone-800 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{cust.name}</span>
                    <span className="font-mono text-amber-400">{cust.daysSinceLastBooking} days inactive</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>{cust.email}</span>
                    <span className="font-mono text-stone-300">Lifetime: €{cust.totalSpentEur.toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-stone-500">
                    Last booking: {cust.lastBookingDate}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Geographic Countries & Resort Hotels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Countries Breakdown */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <Globe className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold text-white">Guest Origin &amp; Nationalities</h3>
            </div>
            <span className="text-[11px] text-stone-400">{metrics.countriesDistribution.length} countries</span>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {metrics.countriesDistribution.length === 0 ? (
              <p className="text-stone-500 text-xs py-8 text-center">No nationality data found.</p>
            ) : (
              metrics.countriesDistribution.map((item) => (
                <div key={item.country} className="p-3 bg-stone-950/70 border border-stone-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{item.country}</span>
                    <span className="font-mono text-teal-400 font-bold">€{item.revenueEur.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>{item.count} travelers ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, item.percentage * 2)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Resort Hotels Distribution */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <Building className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white">Resort &amp; Hotel Concentrations</h3>
            </div>
            <span className="text-[11px] text-stone-400">{metrics.hotelsDistribution.length} properties</span>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {metrics.hotelsDistribution.length === 0 ? (
              <p className="text-stone-500 text-xs py-8 text-center">No hotel pickup records found.</p>
            ) : (
              metrics.hotelsDistribution.map((h) => (
                <div key={h.hotel} className="p-3 bg-stone-950/70 border border-stone-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white truncate max-w-[260px]">{h.hotel}</span>
                    <span className="text-sky-400 font-bold">{h.count} guests</span>
                  </div>
                  <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, h.percentage * 3)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Customers Leaderboard */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center space-x-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Top Customers &amp; Highest Lifetime Spenders</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab?.('crm_customers')}
            className="text-xs text-teal-400 hover:text-teal-300 underline font-medium"
          >
            Customer Profiles Manager
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] font-semibold border-b border-stone-800">
              <tr>
                <th className="py-2.5 px-3">Guest Name &amp; Email</th>
                <th className="py-2.5 px-3">Country</th>
                <th className="py-2.5 px-3">Resort Hotel</th>
                <th className="py-2.5 px-3 text-center">Bookings</th>
                <th className="py-2.5 px-3 text-right">Lifetime Spend</th>
                <th className="py-2.5 px-3 text-center">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-medium">
              {metrics.topCustomers.map((c) => (
                <tr key={c.email} className="hover:bg-stone-800/40 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-white">{c.name}</div>
                    <div className="text-[11px] text-stone-500">{c.email}</div>
                  </td>
                  <td className="py-2.5 px-3 text-stone-300">{c.country}</td>
                  <td className="py-2.5 px-3 text-stone-400 truncate max-w-[180px]">{c.hotel || 'Direct Marina'}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-white">{c.totalBookings}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-bold">
                    €{c.totalSpentEur.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        c.status === 'VIP'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : c.status === 'New'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
