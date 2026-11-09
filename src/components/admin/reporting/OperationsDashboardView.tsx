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
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Departures</span>
            <Anchor className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-white mt-2 font-mono">
            {metrics.departuresCount}
          </div>
          <span className="text-[11px] text-teal-400 mt-1 block">Scheduled maritime runs</span>
        </div>

        {/* Passenger Volume */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Passengers Carried</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-sky-400 mt-2 font-mono">
            {metrics.passengerCounts.total}
          </div>
          <span className="text-[11px] text-stone-400 mt-1 block">
            {metrics.passengerCounts.adults} Ad · {metrics.passengerCounts.children} Ch · {metrics.passengerCounts.infants} Inf
          </span>
        </div>

        {/* Fleet Utilization */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Capacity Utilization</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-emerald-400 mt-2 font-mono">
            {metrics.capacityUtilizationPct}%
          </div>
          <span className="text-[11px] text-stone-400 mt-1 block">Booked seats vs total capacity</span>
        </div>

        {/* Cancellations */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>Cancellations</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-rose-400 mt-2 font-mono">
            {metrics.cancellationsCount}
          </div>
          <span className="text-[11px] text-stone-400 mt-1 block">{metrics.cancellationRatePct}% cancellation rate</span>
        </div>

        {/* No-Shows */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>No-Shows</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-amber-400 mt-2 font-mono">
            {metrics.noShowsCount}
          </div>
          <span className="text-[11px] text-stone-400 mt-1 block">Pier check-in absences</span>
        </div>
      </div>

      {/* Operational Issues & Guide Assignments Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operational Issues Log */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Active Operational Issues &amp; Bulletins</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('ops_weather')}
              className="text-xs text-teal-400 hover:text-teal-300 underline font-medium"
            >
              Weather Bulletin
            </button>
          </div>

          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {metrics.operationalIssues.length === 0 ? (
              <p className="text-stone-500 text-xs py-8 text-center">No operational issues recorded.</p>
            ) : (
              metrics.operationalIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-3 rounded-lg border space-y-1.5 ${
                    issue.severity === 'critical'
                      ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                      : issue.severity === 'warning'
                      ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                      : 'bg-teal-950/30 border-teal-800/60 text-teal-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center space-x-1.5">
                      {issue.severity === 'critical' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                      {issue.severity === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
                      {issue.severity === 'info' && <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />}
                      <span>{issue.title}</span>
                    </span>
                    <span className="text-[10px] opacity-75 uppercase px-1.5 py-0.5 rounded bg-black/40">
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
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Guide &amp; Captain Assignments</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('ops_assignments')}
              className="text-xs text-teal-400 hover:text-teal-300 underline font-medium"
            >
              Assignments Manager
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mb-2">
            <div className="p-2.5 bg-stone-950 rounded border border-stone-800">
              <span className="text-[11px] text-stone-400 block">Total Assigned</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {metrics.guideAssignments.assignedTours}
              </span>
            </div>
            <div className="p-2.5 bg-stone-950 rounded border border-stone-800">
              <span className="text-[11px] text-stone-400 block">Unassigned</span>
              <span className="text-lg font-bold text-amber-400 font-mono">
                {metrics.guideAssignments.unassignedTours}
              </span>
            </div>
            <div className="p-2.5 bg-stone-950 rounded border border-stone-800">
              <span className="text-[11px] text-stone-400 block">Active Roster</span>
              <span className="text-lg font-bold text-white font-mono">
                {metrics.guideAssignments.activeGuidesCount}
              </span>
            </div>
          </div>

          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
            {metrics.guideAssignments.guides.map((g) => (
              <div key={g.guideId} className="p-2.5 bg-stone-950/70 border border-stone-800 rounded-lg flex items-center justify-between text-xs">
                <span className="font-semibold text-white">{g.guideName}</span>
                <div className="flex items-center space-x-3 text-stone-400">
                  <span>{g.assignedCount} excursions</span>
                  <span className="text-teal-400 font-mono">{g.hoursLogged} hrs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle Grid: Fleet Vessel Utilization & Hotel Pickup Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Vessel Utilization */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <Ship className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold text-white">Vessel Deployment &amp; Utilization</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('ops_vessels')}
              className="text-xs text-teal-400 hover:text-teal-300 underline font-medium"
            >
              Fleet Manager
            </button>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {metrics.vesselUtilization.length === 0 ? (
              <p className="text-stone-500 text-xs py-8 text-center">No active vessels deployed.</p>
            ) : (
              metrics.vesselUtilization.map((ves) => (
                <div key={ves.vesselId} className="p-3 bg-stone-950/70 border border-stone-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{ves.vesselName}</span>
                    <span className="font-bold text-teal-400">{ves.utilizationPct}% load</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-400">
                    <span>
                      {ves.tripsCount} trips · {ves.passengersCarried} guests carried
                    </span>
                    <span>Max Capacity: {ves.maxCapacity} pax</span>
                  </div>

                  <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        ves.utilizationPct > 80
                          ? 'bg-emerald-500'
                          : ves.utilizationPct > 50
                          ? 'bg-teal-500'
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
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center space-x-2">
              <Car className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white">Pickup Hotel &amp; Area Logistics</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('ops_pickups')}
              className="text-xs text-teal-400 hover:text-teal-300 underline font-medium"
            >
              Pickup Schedule
            </button>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {metrics.pickupDistribution.length === 0 ? (
              <p className="text-stone-500 text-xs py-8 text-center">No hotel pickups scheduled.</p>
            ) : (
              metrics.pickupDistribution.map((item) => (
                <div key={item.locationName} className="p-3 bg-stone-950/70 border border-stone-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white truncate max-w-[260px]">{item.locationName}</span>
                    <span className="font-bold text-sky-400">{item.guestsCount} guests</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span>{item.area}</span>
                    <span>{item.percentage}% of route</span>
                  </div>
                  <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
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
