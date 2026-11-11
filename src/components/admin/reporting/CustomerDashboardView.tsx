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
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-[#0A6C74]/50 transition-colors">
          <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Customer Accounts</span>
          <div className="text-2xl lg:text-3xl font-bold text-[#0E1B2A] dark:text-white mt-1 font-mono">
            {metrics.totalCustomersCount}
          </div>
          <span className="text-[11px] text-[#0A6C74] dark:text-[#2DD4BF] mt-1 block font-medium">Unified guest profiles</span>
        </div>

        {/* New vs Repeat */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-sky-500/50 transition-colors">
          <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Customer Retention</span>
          <div className="text-2xl lg:text-3xl font-bold text-sky-600 dark:text-sky-400 mt-1 font-mono">
            {metrics.customerRetentionRatePct}%
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">
            {metrics.repeatCustomersCount} Repeat · {metrics.newCustomersCount} New
          </span>
        </div>

        {/* Customer Lifetime Value */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-emerald-500/50 transition-colors">
          <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Lifetime Value (LTV)</span>
          <div className="text-2xl lg:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            €{metrics.customerLifetimeValueEur.toFixed(2)}
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">Avg spend per guest account</span>
        </div>

        {/* Inactive Customers */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-amber-500/50 transition-colors">
          <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Inactive Guests</span>
          <div className="text-2xl lg:text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
            {metrics.inactiveCustomersCount}
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">No booking in &gt; 90 days</span>
        </div>

        {/* VIP Tier Cohort */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-purple-500/50 transition-colors">
          <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">VIP Tier Cohort</span>
          <div className="text-2xl lg:text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1 font-mono">
            {metrics.topCustomers.filter((c) => c.status === 'VIP').length}
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">&ge; €500 or 3+ bookings</span>
        </div>
      </div>

      {/* Middle Grid: Popular Tour Interests & Inactive Customers Re-engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Tour Interests */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-[#1F3854] pb-3">
            <div className="flex items-center space-x-2">
              <Compass className="w-4 h-4 text-[#0A6C74] dark:text-[#2DD4BF]" />
              <h3 className="text-sm font-bold text-[#0E1B2A] dark:text-white font-display">Popular Tour Interests &amp; Demand</h3>
            </div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">Demand breakdown</span>
          </div>

          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {metrics.popularTourInterests.length === 0 ? (
              <p className="text-stone-400 text-xs py-8 text-center">No tour interest data found.</p>
            ) : (
              metrics.popularTourInterests.map((interest) => (
                <div key={interest.tourTitle} className="p-3.5 bg-[#FAF8F5] dark:bg-[#0E1B2A] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0E1B2A] dark:text-white truncate max-w-[280px]">{interest.tourTitle}</span>
                    <span className="font-mono text-[#0A6C74] dark:text-[#2DD4BF] font-bold">{interest.totalGuests} guests</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                    <span>{interest.bookingsCount} bookings · {interest.inquiriesCount} inquiries</span>
                    <span className="text-stone-500 dark:text-stone-400">{interest.sharePct}% share</span>
                  </div>
                  <div className="w-full bg-[#E8E3DA] dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#0A6C74] h-full rounded-full"
                      style={{ width: `${Math.min(100, interest.sharePct * 2)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inactive Customers for Re-engagement */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-[#1F3854] pb-3">
            <div className="flex items-center space-x-2">
              <UserMinus className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-[#0E1B2A] dark:text-white font-display">Inactive Customers (&gt; 90 Days)</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('crm_followups')}
              className="text-xs text-[#0A6C74] dark:text-[#2DD4BF] hover:underline font-semibold"
            >
              Follow-up Desk
            </button>
          </div>

          <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
            {metrics.inactiveCustomers.length === 0 ? (
              <p className="text-stone-400 text-xs py-8 text-center">No inactive customers. High guest engagement!</p>
            ) : (
              metrics.inactiveCustomers.map((cust) => (
                <div key={cust.id} className="p-3.5 bg-[#FAF8F5] dark:bg-[#0E1B2A] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0E1B2A] dark:text-white">{cust.name}</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">{cust.daysSinceLastBooking} days inactive</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                    <span>{cust.email}</span>
                    <span className="font-mono text-stone-700 dark:text-stone-300">Lifetime: €{cust.totalSpentEur.toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-stone-400">
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
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-[#1F3854] pb-3">
            <div className="flex items-center space-x-2">
              <Globe className="w-4 h-4 text-[#0A6C74] dark:text-[#2DD4BF]" />
              <h3 className="text-sm font-bold text-[#0E1B2A] dark:text-white font-display">Guest Origin &amp; Nationalities</h3>
            </div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">{metrics.countriesDistribution.length} countries</span>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {metrics.countriesDistribution.length === 0 ? (
              <p className="text-stone-400 text-xs py-8 text-center">No nationality data found.</p>
            ) : (
              metrics.countriesDistribution.map((item) => (
                <div key={item.country} className="p-3.5 bg-[#FAF8F5] dark:bg-[#0E1B2A] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0E1B2A] dark:text-white">{item.country}</span>
                    <span className="font-mono text-[#0A6C74] dark:text-[#2DD4BF] font-bold">€{item.revenueEur.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                    <span>{item.count} travelers ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-[#E8E3DA] dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#0A6C74] h-full rounded-full"
                      style={{ width: `${Math.min(100, item.percentage * 2)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Resort Hotels Distribution */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-[#1F3854] pb-3">
            <div className="flex items-center space-x-2">
              <Building className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h3 className="text-sm font-bold text-[#0E1B2A] dark:text-white font-display">Resort &amp; Hotel Concentrations</h3>
            </div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">{metrics.hotelsDistribution.length} properties</span>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {metrics.hotelsDistribution.length === 0 ? (
              <p className="text-stone-400 text-xs py-8 text-center">No hotel pickup records found.</p>
            ) : (
              metrics.hotelsDistribution.map((h) => (
                <div key={h.hotel} className="p-3.5 bg-[#FAF8F5] dark:bg-[#0E1B2A] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0E1B2A] dark:text-white truncate max-w-[260px]">{h.hotel}</span>
                    <span className="text-sky-600 dark:text-sky-400 font-bold">{h.count} guests</span>
                  </div>
                  <div className="w-full bg-[#E8E3DA] dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
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
      <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-[#1F3854] pb-3">
          <div className="flex items-center space-x-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-[#0E1B2A] dark:text-white font-display">Top Customers &amp; Highest Lifetime Spenders</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab?.('crm_customers')}
            className="text-xs text-[#0A6C74] dark:text-[#2DD4BF] hover:underline font-semibold"
          >
            Customer Profiles Manager
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
            <thead className="bg-[#FAF8F5] dark:bg-[#0E1B2A] text-stone-600 dark:text-stone-300 uppercase text-[10px] font-semibold border-b border-[#E8E3DA] dark:border-[#1F3854]">
              <tr>
                <th className="py-3 px-3.5">Guest Name &amp; Email</th>
                <th className="py-3 px-3.5">Country</th>
                <th className="py-3 px-3.5">Resort Hotel</th>
                <th className="py-3 px-3.5 text-center">Bookings</th>
                <th className="py-3 px-3.5 text-right">Lifetime Spend</th>
                <th className="py-3 px-3.5 text-center">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E3DA]/80 dark:divide-[#1F3854]/80 font-medium">
              {metrics.topCustomers.map((c) => (
                <tr key={c.email} className="hover:bg-[#FAF8F5]/80 dark:hover:bg-[#16283D]/60 transition-colors">
                  <td className="py-3 px-3.5">
                    <div className="font-semibold text-[#0E1B2A] dark:text-white">{c.name}</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">{c.email}</div>
                  </td>
                  <td className="py-3 px-3.5 text-stone-700 dark:text-stone-300">{c.country}</td>
                  <td className="py-3 px-3.5 text-stone-500 dark:text-stone-400 truncate max-w-[180px]">{c.hotel || 'Direct Marina'}</td>
                  <td className="py-3 px-3.5 text-center font-bold text-[#0E1B2A] dark:text-white">{c.totalBookings}</td>
                  <td className="py-3 px-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    €{c.totalSpentEur.toLocaleString()}
                  </td>
                  <td className="py-3 px-3.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        c.status === 'VIP'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                          : c.status === 'New'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                          : 'bg-[#FAF8F5] dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-[#E8E3DA] dark:border-stone-700'
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
