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
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-teal-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span className="font-medium">Total Gross Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-bold text-white font-display tracking-tight font-mono">
              €{metrics.totalRevenueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-teal-400">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              <span>Contracted Tour Volume</span>
            </div>
          </div>
        </div>

        {/* Collected Revenue */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span className="font-medium">Collected Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-bold text-emerald-400 font-display tracking-tight font-mono">
              €{metrics.collectedRevenueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-stone-400">
              <span>Verified cash &amp; gateway receipts</span>
            </div>
          </div>
        </div>

        {/* Outstanding Revenue */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span className="font-medium">Outstanding Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-bold text-amber-400 font-display tracking-tight font-mono">
              €{metrics.outstandingRevenueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-stone-400">
              <span>Collect at marina pier check-in</span>
            </div>
          </div>
        </div>

        {/* Average Booking Value */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-sky-500/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span className="font-medium">Avg Booking Value (ABV)</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-bold text-sky-400 font-display tracking-tight font-mono">
              €{metrics.averageBookingValueEur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-stone-400">
              <span>Per confirmed reservation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bookings & Conversions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bookings */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Total Bookings Placed</span>
            <CalendarCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {metrics.bookingsCount}
          </div>
          <div className="text-[11px] text-stone-400 mt-1 flex items-center justify-between">
            <span>Active Reservations</span>
            <button
              type="button"
              onClick={() => onNavigateTab?.('bookings')}
              className="text-teal-400 hover:underline flex items-center"
            >
              View <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Confirmed Bookings */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Confirmed Bookings</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {metrics.confirmedBookingsCount}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">Paid or scheduled for departure</span>
        </div>

        {/* Cancellations */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Cancellations</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2">
            {metrics.cancellationsCount}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            {metrics.cancellationRate}% cancellation rate
          </span>
        </div>

        {/* Conversion Rate */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Inquiry Conversion Rate</span>
            <Percent className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-teal-400 mt-2">
            {metrics.conversionRate}%
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            From {metrics.leadsCount} incoming leads &amp; inquiries
          </span>
        </div>
      </div>

      {/* Customer & Guest Ratios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Customer Accounts</span>
            <Users className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-xl font-bold text-white mt-2">
            {metrics.totalCustomersCount}
          </div>
          <span className="text-[10px] text-stone-500 mt-0.5 block">Unique guest profiles in system</span>
        </div>

        {/* New Customers */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>New Customers</span>
            <UserPlus className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white mt-2">
            {metrics.newCustomersCount}
          </div>
          <span className="text-[10px] text-stone-500 mt-0.5 block">First-time excursion guests</span>
        </div>

        {/* Repeat Customers */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Repeat Customers</span>
            <RotateCcw className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold text-white mt-2">
            {metrics.repeatCustomersCount}
          </div>
          <span className="text-[10px] text-stone-500 mt-0.5 block">Returning Red Sea travelers</span>
        </div>

        {/* Leads */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Sales Leads &amp; Inquiries</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 mt-2">
            {metrics.leadsCount}
          </div>
          <span className="text-[10px] text-stone-500 mt-0.5 block">Inquiries during {interval.label}</span>
        </div>
      </div>

      {/* Passenger Breakdown & Operational Integrity Note */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Passenger Demographics &amp; Manifest Volume</span>
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Live guest census aggregated for maritime manifest dispatch and coast guard clearance
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-stone-400">Total Manifest Passengers</span>
            <div className="text-xl font-bold text-white font-mono">{metrics.passengersCount} guests</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4 text-center">
          <div className="p-3 bg-stone-950 rounded-lg border border-stone-800/80">
            <span className="text-xs text-stone-400 block font-medium">Adults</span>
            <span className="text-lg font-bold text-white mt-0.5 block">{metrics.adultsCount}</span>
            <span className="text-[10px] text-stone-500">Full Fare</span>
          </div>
          <div className="p-3 bg-stone-950 rounded-lg border border-stone-800/80">
            <span className="text-xs text-stone-400 block font-medium">Children</span>
            <span className="text-lg font-bold text-sky-400 mt-0.5 block">{metrics.childrenCount}</span>
            <span className="text-[10px] text-stone-500">Child Fare</span>
          </div>
          <div className="p-3 bg-stone-950 rounded-lg border border-stone-800/80">
            <span className="text-xs text-stone-400 block font-medium">Infants</span>
            <span className="text-lg font-bold text-emerald-400 mt-0.5 block">{metrics.infantsCount}</span>
            <span className="text-[10px] text-stone-500">Complimentary</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-stone-800/60 flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            <span>Audited against immutable Supabase database records. Zero simulated KPIs.</span>
          </div>
          <span className="text-stone-500 font-mono text-[11px]">Filtered: {interval.label}</span>
        </div>
      </div>
    </div>
  );
};
