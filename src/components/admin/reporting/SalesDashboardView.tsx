import React from 'react';
import {
  TrendingUp,
  Compass,
  MapPin,
  DollarSign,
  Share2,
  CalendarCheck,
  Percent,
  Users,
  Award,
  ArrowUpRight,
  UserCheck,
} from 'lucide-react';
import { SalesMetrics, DateRangeInterval } from '../../../types/reporting';

interface SalesDashboardViewProps {
  metrics: SalesMetrics;
  interval: DateRangeInterval;
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const SalesDashboardView: React.FC<SalesDashboardViewProps> = ({
  metrics,
  interval,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Highlights Grid (Leads, Bookings, Revenue, ABV, Conversion) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Leads */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <span className="text-xs text-stone-400 font-medium">Sales Leads</span>
          <div className="text-2xl lg:text-3xl font-bold text-amber-400 mt-1 font-mono">
            {metrics.leadsCount}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">Inquiries &amp; prospects in period</span>
        </div>

        {/* Confirmed Bookings */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <span className="text-xs text-stone-400 font-medium">Bookings Won</span>
          <div className="text-2xl lg:text-3xl font-bold text-white mt-1 font-mono">
            {metrics.totalBookingsCount}
          </div>
          <span className="text-[11px] text-teal-400 mt-1 block">Confirmed reservations</span>
        </div>

        {/* Revenue */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <span className="text-xs text-stone-400 font-medium">Contracted Sales</span>
          <div className="text-2xl lg:text-3xl font-bold text-white mt-1 font-mono">
            €{metrics.totalRevenueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-emerald-400 mt-1 block">Gross booked revenue</span>
        </div>

        {/* Average Booking Value */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <span className="text-xs text-stone-400 font-medium">Avg Booking Value (ABV)</span>
          <div className="text-2xl lg:text-3xl font-bold text-teal-400 mt-1 font-mono">
            €{metrics.averageBookingValueEur.toFixed(2)}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">Revenue per reservation</span>
        </div>

        {/* Conversion Rate */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <span className="text-xs text-stone-400 font-medium">Lead Conversion</span>
          <div className="text-2xl lg:text-3xl font-bold text-sky-400 mt-1 font-mono">
            {metrics.conversionRate}%
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">Prospect-to-booking efficiency</span>
        </div>
      </div>

      {/* Staff Performance & Lead Sources Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Performance by Staff */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Sales Performance by Staff</h3>
            </div>
            <span className="text-[11px] text-stone-400">{metrics.staffPerformance.length} agents tracked</span>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {metrics.staffPerformance.length === 0 ? (
              <p className="text-stone-500 text-xs py-8 text-center">No staff performance records found.</p>
            ) : (
              metrics.staffPerformance.map((staff, idx) => (
                <div key={staff.staffId} className="p-3 bg-stone-950/70 border border-stone-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-stone-800 text-stone-300 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-white">{staff.staffName}</span>
                      <span className="text-[10px] text-stone-500 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                        {staff.role}
                      </span>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">
                      €{staff.revenueEur.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>
                      {staff.bookingsCount} won / {staff.leadsHandled} leads
                    </span>
                    <span className="text-teal-400 font-medium">{staff.conversionRate}% conversion</span>
                  </div>

                  <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, staff.conversionRate * 1.5)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lead Sources Breakdown */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <Share2 className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white">Lead Acquisition Sources</h3>
            </div>
            <span className="text-[11px] text-stone-400">{metrics.leadSources.length} channels</span>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {metrics.leadSources.length === 0 ? (
              <p className="text-stone-500 text-xs py-8 text-center">No lead sources tracked.</p>
            ) : (
              metrics.leadSources.map((ls) => (
                <div key={ls.source} className="p-3 bg-stone-950/70 border border-stone-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{ls.source}</span>
                    <span className="font-mono text-teal-400 font-bold">
                      €{ls.revenueEur.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>
                      {ls.count} inquiries · {ls.convertedCount} converted
                    </span>
                    <span className="text-sky-400">{ls.conversionRate}% conversion rate</span>
                  </div>

                  <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, ls.conversionRate * 2)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Breakdown Grid: Tour & Destination Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best-Selling Tours */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <Compass className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold text-white">Best-Selling Tours &amp; Excursions</h3>
            </div>
            <span className="text-[11px] text-stone-400">{metrics.bestSellingTours.length} active</span>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {metrics.bestSellingTours.length === 0 ? (
              <p className="text-stone-500 text-xs py-8 text-center">No tour bookings recorded in this date range.</p>
            ) : (
              metrics.bestSellingTours.map((item, idx) => (
                <div key={item.id} className="p-3 bg-stone-950/70 border border-stone-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white truncate max-w-[240px]">
                      {idx + 1}. {item.name}
                    </span>
                    <span className="font-mono text-teal-400 font-bold">
                      €{item.revenueEur.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>{item.count} bookings ({item.percentage}%)</span>
                    <span>Avg: €{(item.count > 0 ? item.revenueEur / item.count : 0).toFixed(0)} / booking</span>
                  </div>

                  <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, item.percentage * 2)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Best Destinations */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white">Best Destination Markets</h3>
            </div>
            <span className="text-[11px] text-stone-400">{metrics.bestDestinations.length} destinations</span>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {metrics.bestDestinations.length === 0 ? (
              <p className="text-stone-500 text-xs py-8 text-center">No destination bookings recorded.</p>
            ) : (
              metrics.bestDestinations.map((dest) => (
                <div key={dest.id} className="p-3 bg-stone-950/70 border border-stone-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{dest.name}</span>
                    <span className="font-mono text-sky-400 font-bold">
                      €{dest.revenueEur.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>{dest.count} reservations ({dest.percentage}%)</span>
                    <span className="text-stone-500">Destination share</span>
                  </div>

                  <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, dest.percentage * 1.5)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
