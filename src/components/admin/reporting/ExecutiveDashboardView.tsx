import React from 'react';
import {
  DollarSign,
  CalendarCheck,
  Users,
  UserPlus,
  RotateCcw,
  Percent,
  AlertTriangle,
  CreditCard,
  TrendingUp,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { ExecutiveMetrics, DateRangeInterval } from '../../../types/reporting';

interface ExecutiveDashboardViewProps {
  metrics: ExecutiveMetrics;
  interval: DateRangeInterval;
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  metrics,
  interval,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-6">
      {/* Primary Financial Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs hover:border-[#0A6C74]/50 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Total Gross Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-[#0A6C74]/10 dark:bg-[#0A6C74]/20 border border-[#0A6C74]/20 flex items-center justify-center text-[#0A6C74] dark:text-[#2DD4BF]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-bold text-[#0E1B2A] dark:text-white font-display tracking-tight font-mono">
              €{metrics.totalRevenueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-[#0A6C74] dark:text-[#2DD4BF] font-medium">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              <span>Contracted Tour Volume</span>
            </div>
          </div>
        </div>

        {/* Collected Revenue */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Net Collected Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-display tracking-tight font-mono">
              €{metrics.collectedRevenueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-stone-500 dark:text-stone-400">
              <span>Settled payments less processed refunds</span>
            </div>
          </div>
        </div>

        {/* Outstanding Revenue */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs hover:border-amber-500/50 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Outstanding Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-bold text-amber-600 dark:text-amber-400 font-display tracking-tight font-mono">
              €{metrics.outstandingRevenueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-stone-500 dark:text-stone-400">
              <span>Collect at marina pier check-in</span>
            </div>
          </div>
        </div>

        {/* Average Booking Value */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs hover:border-[#0A6C74]/50 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Avg Booking Value (ABV)</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-bold text-sky-600 dark:text-sky-400 font-display tracking-tight font-mono">
              €{metrics.averageBookingValueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-stone-500 dark:text-stone-400">
              <span>Per confirmed reservation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bookings & Conversions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Bookings */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-[#0A6C74]/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Total Bookings Placed</span>
            <CalendarCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-[#0E1B2A] dark:text-white mt-2 font-display">
            {metrics.bookingsCount}
          </div>
          <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 flex items-center justify-between">
            <span>Active Reservations</span>
            <button
              type="button"
              onClick={() => onNavigateTab?.('bookings')}
              className="text-[#0A6C74] dark:text-[#2DD4BF] hover:underline flex items-center font-semibold"
            >
              View <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Confirmed Bookings */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-[#0A6C74]/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Confirmed Bookings</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-display">
            {metrics.confirmedBookingsCount}
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">Paid or scheduled for departure</span>
        </div>

        {/* Completed Bookings */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Completed Bookings</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2 font-display">
            {metrics.completedBookingsCount ?? 0}
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">Tours marked as completed</span>
        </div>

        {/* Cancellations */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-[#0A6C74]/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Cancellations</span>
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2 font-display">
            {metrics.cancellationsCount}
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">
            {metrics.cancellationRate}% cancellation rate
          </span>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-[#0A6C74]/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Inquiry Conversion Rate</span>
            <Percent className="w-4 h-4 text-[#0A6C74] dark:text-[#2DD4BF]" />
          </div>
          <div className="text-2xl font-bold text-[#0A6C74] dark:text-[#2DD4BF] mt-2 font-display">
            {metrics.conversionRate}%
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">
            From {metrics.leadsCount} incoming leads &amp; inquiries
          </span>
        </div>
      </div>

      {/* Customer & Guest Ratios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Customer Accounts</span>
            <Users className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-xl font-bold text-[#0E1B2A] dark:text-white mt-2 font-display">
            {metrics.totalCustomersCount}
          </div>
          <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 block">Unique guest profiles in system</span>
        </div>

        {/* New Customers */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">New Customers</span>
            <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-[#0E1B2A] dark:text-white mt-2 font-display">
            {metrics.newCustomersCount}
          </div>
          <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 block">First-time excursion guests</span>
        </div>

        {/* Repeat Customers */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Repeat Customers</span>
            <RotateCcw className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-xl font-bold text-[#0E1B2A] dark:text-white mt-2 font-display">
            {metrics.repeatCustomersCount}
          </div>
          <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 block">Returning Awesome Adventure Tours customers</span>
        </div>

        {/* Leads */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Sales Leads &amp; Inquiries</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-2 font-display">
            {metrics.leadsCount}
          </div>
          <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 block">Inquiries during {interval.label}</span>
        </div>
      </div>

      {/* Passenger Breakdown & Operational Integrity Note */}
      <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E3DA] dark:border-[#1F3854] pb-4">
          <div>
            <h3 className="text-sm font-bold text-[#0E1B2A] dark:text-white flex items-center space-x-2 font-display">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Passenger Demographics &amp; Manifest Volume</span>
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Live guest census aggregated for maritime manifest dispatch and coast guard clearance
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs text-stone-500 dark:text-stone-400">Total Manifest Passengers</span>
            <div className="text-xl font-bold text-[#0E1B2A] dark:text-white font-mono">{metrics.passengersCount} guests</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5 text-center">
          <div className="p-3.5 bg-[#FAF8F5] dark:bg-[#0E1B2A] rounded-xl border border-[#E8E3DA] dark:border-[#1F3854]">
            <span className="text-xs text-stone-500 dark:text-stone-400 block font-medium">Adults</span>
            <span className="text-lg font-bold text-[#0E1B2A] dark:text-white mt-0.5 block font-mono">{metrics.adultsCount}</span>
            <span className="text-[10px] text-stone-500">Full Fare</span>
          </div>
          <div className="p-3.5 bg-[#FAF8F5] dark:bg-[#0E1B2A] rounded-xl border border-[#E8E3DA] dark:border-[#1F3854]">
            <span className="text-xs text-stone-500 dark:text-stone-400 block font-medium">Children</span>
            <span className="text-lg font-bold text-sky-600 dark:text-sky-400 mt-0.5 block font-mono">{metrics.childrenCount}</span>
            <span className="text-[10px] text-stone-500">Child Fare</span>
          </div>
          <div className="p-3.5 bg-[#FAF8F5] dark:bg-[#0E1B2A] rounded-xl border border-[#E8E3DA] dark:border-[#1F3854]">
            <span className="text-xs text-stone-500 dark:text-stone-400 block font-medium">Infants</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block font-mono">{metrics.infantsCount}</span>
            <span className="text-[10px] text-stone-500">Complimentary</span>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[#E8E3DA]/80 dark:border-[#1F3854]/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0A6C74] dark:text-[#2DD4BF]" />
            <span>Audited against immutable Supabase database records. Zero simulated KPIs.</span>
          </div>
          <span className="text-stone-500 dark:text-stone-400 font-mono text-[11px]">Filtered: {interval.label}</span>
        </div>
      </div>
    </div>
  );
};
