import React from 'react';
import {
  Anchor,
  Users,
  Percent,
  AlertTriangle,
  XCircle,
  Car,
  Ship,
  CalendarCheck,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Info,
  Clock,
  Compass,
} from 'lucide-react';
import { OperationsMetrics, DateRangeInterval } from '../../../types/reporting';

interface OperationsDashboardViewProps {
  metrics: OperationsMetrics;
  interval: DateRangeInterval;
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const OperationsDashboardView: React.FC<OperationsDashboardViewProps> = ({
  metrics,
  interval,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Operations KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Departures */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-[#0A6C74]/50 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Departures</span>
            <Anchor className="w-4 h-4 text-[#0A6C74] dark:text-[#2DD4BF]" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-[#0E1B2A] dark:text-white mt-2 font-mono">
            {metrics.departuresCount}
          </div>
          <span className="text-[11px] text-[#0A6C74] dark:text-[#2DD4BF] mt-1 block font-medium">Scheduled maritime runs</span>
        </div>

        {/* Passenger Volume */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-sky-500/50 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Passengers Carried</span>
            <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-sky-600 dark:text-sky-400 mt-2 font-mono">
            {metrics.passengerCounts.total}
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">
            {metrics.passengerCounts.adults} Ad · {metrics.passengerCounts.children} Ch · {metrics.passengerCounts.infants} Inf
          </span>
        </div>

        {/* Fleet Utilization */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-emerald-500/50 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Capacity Utilization</span>
            <Percent className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {metrics.capacityUtilizationPct}%
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">Booked seats vs total capacity</span>
        </div>

        {/* Cancellations */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-rose-500/50 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">Cancellations</span>
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-rose-600 dark:text-rose-400 mt-2 font-mono">
            {metrics.cancellationsCount}
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">{metrics.cancellationRatePct}% cancellation rate</span>
        </div>

        {/* No-Shows */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 shadow-xs hover:border-amber-500/50 transition-colors">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span className="font-medium">No-Shows</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {metrics.noShowsCount}
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 block">Pier check-in absences</span>
        </div>
      </div>

      {/* Operational Issues & Guide Assignments Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operational Issues Log */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-[#1F3854] pb-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-[#0E1B2A] dark:text-white font-display">Active Operational Issues &amp; Bulletins</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('ops_weather')}
              className="text-xs text-[#0A6C74] dark:text-[#2DD4BF] hover:underline font-semibold"
            >
              Weather Bulletin
            </button>
          </div>

          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {metrics.operationalIssues.length === 0 ? (
              <p className="text-stone-400 text-xs py-8 text-center">No operational issues recorded.</p>
            ) : (
              metrics.operationalIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-3.5 rounded-xl border space-y-1.5 ${
                    issue.severity === 'critical'
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
                      : issue.severity === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                      : 'bg-[#E8F3F4] dark:bg-[#0A6C74]/20 border-[#0A6C74]/20 text-[#0A6C74] dark:text-[#2DD4BF]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center space-x-1.5">
                      {issue.severity === 'critical' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
                      {issue.severity === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                      {issue.severity === 'info' && <CheckCircle2 className="w-3.5 h-3.5 text-[#0A6C74] dark:text-[#2DD4BF]" />}
                      <span>{issue.title}</span>
                    </span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-black/10 dark:bg-black/40 font-bold">
                      {issue.category}
                    </span>
                  </div>
                  <p className="text-xs opacity-90 leading-relaxed">{issue.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Guide Assignments Workload */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-[#1F3854] pb-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-[#0E1B2A] dark:text-white font-display">Guide &amp; Captain Assignments</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('ops_assignments')}
              className="text-xs text-[#0A6C74] dark:text-[#2DD4BF] hover:underline font-semibold"
            >
              Assignments Manager
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center mb-2">
            <div className="p-3 bg-[#FAF8F5] dark:bg-[#0E1B2A] rounded-xl border border-[#E8E3DA] dark:border-[#1F3854]">
              <span className="text-[11px] text-stone-500 dark:text-stone-400 block font-medium">Total Assigned</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {metrics.guideAssignments.assignedTours}
              </span>
            </div>
            <div className="p-3 bg-[#FAF8F5] dark:bg-[#0E1B2A] rounded-xl border border-[#E8E3DA] dark:border-[#1F3854]">
              <span className="text-[11px] text-stone-500 dark:text-stone-400 block font-medium">Unassigned</span>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">
                {metrics.guideAssignments.unassignedTours}
              </span>
            </div>
            <div className="p-3 bg-[#FAF8F5] dark:bg-[#0E1B2A] rounded-xl border border-[#E8E3DA] dark:border-[#1F3854]">
              <span className="text-[11px] text-stone-500 dark:text-stone-400 block font-medium">Active Roster</span>
              <span className="text-lg font-bold text-[#0E1B2A] dark:text-white font-mono">
                {metrics.guideAssignments.activeGuidesCount}
              </span>
            </div>
          </div>

          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
            {metrics.guideAssignments.guides.map((g) => (
              <div key={g.guideId} className="p-3 bg-[#FAF8F5] dark:bg-[#0E1B2A] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0E1B2A] dark:text-white">{g.guideName}</span>
                <div className="flex items-center space-x-3 text-stone-500 dark:text-stone-400">
                  <span>{g.assignedCount} excursions</span>
                  <span className="text-[#0A6C74] dark:text-[#2DD4BF] font-mono font-medium">{g.hoursLogged} hrs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle Grid: Fleet Vessel Utilization & Hotel Pickup Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Vessel Utilization */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-[#1F3854] pb-3">
            <div className="flex items-center space-x-2">
              <Ship className="w-4 h-4 text-[#0A6C74] dark:text-[#2DD4BF]" />
              <h3 className="text-sm font-bold text-[#0E1B2A] dark:text-white font-display">Vessel Deployment &amp; Utilization</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('ops_vessels')}
              className="text-xs text-[#0A6C74] dark:text-[#2DD4BF] hover:underline font-semibold"
            >
              Fleet Manager
            </button>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {metrics.vesselUtilization.length === 0 ? (
              <p className="text-stone-400 text-xs py-8 text-center">No active vessels deployed.</p>
            ) : (
              metrics.vesselUtilization.map((ves) => (
                <div key={ves.vesselId} className="p-3.5 bg-[#FAF8F5] dark:bg-[#0E1B2A] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0E1B2A] dark:text-white">{ves.vesselName}</span>
                    <span className="font-bold text-[#0A6C74] dark:text-[#2DD4BF] font-mono">{ves.utilizationPct}% load</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                    <span>
                      {ves.tripsCount} trips · {ves.passengersCarried} guests carried
                    </span>
                    <span>Max Capacity: {ves.maxCapacity} pax</span>
                  </div>

                  <div className="w-full bg-[#E8E3DA] dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        ves.utilizationPct > 80
                          ? 'bg-emerald-500'
                          : ves.utilizationPct > 50
                          ? 'bg-[#0A6C74]'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${ves.utilizationPct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pickup Route Distribution */}
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-5 lg:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E3DA] dark:border-[#1F3854] pb-3">
            <div className="flex items-center space-x-2">
              <Car className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h3 className="text-sm font-bold text-[#0E1B2A] dark:text-white font-display">Pickup Hotel &amp; Area Logistics</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('ops_pickups')}
              className="text-xs text-[#0A6C74] dark:text-[#2DD4BF] hover:underline font-semibold"
            >
              Pickup Schedule
            </button>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {metrics.pickupDistribution.length === 0 ? (
              <p className="text-stone-400 text-xs py-8 text-center">No hotel pickups scheduled.</p>
            ) : (
              metrics.pickupDistribution.map((item) => (
                <div key={item.locationName} className="p-3.5 bg-[#FAF8F5] dark:bg-[#0E1B2A] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0E1B2A] dark:text-white truncate max-w-[260px]">{item.locationName}</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400 font-mono">{item.guestsCount} guests</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                    <span>{item.area}</span>
                    <span>{item.percentage}% of route</span>
                  </div>
                  <div className="w-full bg-[#E8E3DA] dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, item.percentage * 3)}%` }}
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
