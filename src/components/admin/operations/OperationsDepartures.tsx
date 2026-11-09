import React, { useState, useEffect } from 'react';
import {
  Anchor,
  Ship,
  Users,
  Clock,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  ShieldCheck,
  DollarSign,
  Car,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  getTodayDepartures,
  updateDepartureStatus,
  createDeparture,
  getMaritimeWeather,
  listVessels,
  listGuides,
} from '../../../services/operationsService';
import {
  OperationalDeparture,
  DepartureStatus,
  WeatherInfo,
} from '../../../types/operations';
import { DbVessel, DbGuide } from '../../../types/database';
import { Tour } from '../../../types';
import { ALL_TOURS } from '../../../data/toursData';
import { getPublishedTours } from '../../../services/tourService';
import { useToast } from '../../../contexts/ToastContext';

interface OperationsDeparturesProps {
  onNavigateTab?: (tabId: string, param?: string) => void;
}

export const OperationsDepartures: React.FC<OperationsDeparturesProps> = ({ onNavigateTab }) => {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [departures, setDepartures] = useState<OperationalDeparture[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [vessels, setVessels] = useState<DbVessel[]>([]);
  const [guides, setGuides] = useState<DbGuide[]>([]);
  const [tours, setTours] = useState<Tour[]>(ALL_TOURS);
  const [loading, setLoading] = useState(true);

  // New Departure Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTourId, setNewTourId] = useState(ALL_TOURS[0]?.id || '');
  const [newStartTime, setNewStartTime] = useState('08:30');
  const [newEndTime, setNewEndTime] = useState('16:30');
  const [newCapacity, setNewCapacity] = useState(35);
  const [newVesselId, setNewVesselId] = useState('');
  const [newGuideId, setNewGuideId] = useState('');
  const [newDriverId, setNewDriverId] = useState('');
  const [newStatus, setNewStatus] = useState<DepartureStatus>('scheduled');
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [deps, wea, ves, gui, loadedTours] = await Promise.all([
        getTodayDepartures(selectedDate),
        getMaritimeWeather(selectedDate),
        listVessels(),
        listGuides(),
        getPublishedTours().catch(() => []),
      ]);
      setDepartures(deps);
      setWeather(wea);
      setVessels(ves);
      setGuides(gui);
      if (loadedTours && loadedTours.length > 0) {
        setTours(loadedTours);
        if (!newTourId) setNewTourId(loadedTours[0].id);
      }
    } catch (err) {
      console.warn('Failed to load departures:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleStatusChange = async (dep: OperationalDeparture, nextStatus: DepartureStatus) => {
    await updateDepartureStatus(dep.id, nextStatus);
    setDepartures((prev) =>
      prev.map((d) => (d.id === dep.id ? { ...d, status: nextStatus } : d))
    );
    showToast(`Departure status for "${dep.tourTitle}" updated to ${nextStatus}.`, 'success');
  };

  const handleCreateDeparture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTourId || !selectedDate) return;

    setSubmitting(true);
    const selectedTour = tours.find((t) => t.id === newTourId) || ALL_TOURS.find((t) => t.id === newTourId);

    const res = await createDeparture({
      tour_id: newTourId,
      tour_title: selectedTour?.title || 'Tour Departure',
      date: selectedDate,
      start_time: newStartTime,
      end_time: newEndTime,
      capacity: newCapacity,
      status: newStatus,
      vessel_id: newVesselId || null,
      guide_id: newGuideId || null,
      driver_id: newDriverId || null,
      notes: newNotes.trim() || null,
    });

    setSubmitting(false);

    if (!res.success) {
      showToast(res.error || 'Failed to create departure', 'error');
      return;
    }

    showToast('Scheduled departure created successfully.', 'success');
    setIsModalOpen(false);
    await loadData();
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || 'scheduled').toLowerCase();
    switch (s) {
      case 'scheduled':
        return 'bg-stone-800 text-stone-300 border-stone-700';
      case 'confirmed':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'boarding':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'in_progress':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-stone-800 text-stone-300 border-stone-700';
    }
  };

  const totalPassengers = departures.reduce((sum, d) => sum + d.passengerCount, 0);
  const totalRevenue = departures.reduce((sum, d) => sum + d.paymentSummary.totalEur, 0);
  const outstandingRevenue = departures.reduce((sum, d) => sum + d.paymentSummary.outstandingEur, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Harbor & Safari Dispatch
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Anchor className="w-6 h-6 text-[#2dd4bf]" />
            <span>Tour Departures & Pier Dispatch</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Real-time control center for scheduled tour departures, vessel allocations, guide check-ins, and passenger manifests.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-white text-xs font-mono"
          />

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Departure</span>
          </button>
        </div>
      </div>

      {/* Maritime Clearance / Weather Banner */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div
            className={`w-3.5 h-3.5 rounded-full shrink-0 ${
              !weather?.isAvailable
                ? 'bg-stone-500'
                : weather.coastGuardCleared
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          <div>
            <div className="flex items-center space-x-2">
              <strong className="text-white text-sm">
                {!weather?.isAvailable ? (
                  <span className="text-stone-400">Weather unavailable</span>
                ) : weather.coastGuardCleared ? (
                  'Coast Guard Maritime Clearance: GREEN FLAG (CLEARED)'
                ) : (
                  'Coast Guard Maritime Clearance: ADVISORY WARNING'
                )}
              </strong>
              {weather?.isAvailable && (
                <span className="text-[10px] text-stone-400 font-mono">
                  {weather.harborLocation}
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {weather?.isAvailable ? (
                <>
                  Air: {weather.airTemperatureC}°C &bull; Water: {weather.waterTemperatureC}°C &bull; Swell: {weather.swellHeightM}m &bull; Wind: {weather.windSpeedKnots} kts {weather.windDirection}
                </>
              ) : (
                'Live weather telemetry not currently connected for this harbor.'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-stone-300 font-mono text-[11px] shrink-0">
          <div>
            Departures: <strong className="text-white">{departures.length}</strong>
          </div>
          <div>&bull;</div>
          <div>
            Travelers: <strong className="text-[#2dd4bf]">{totalPassengers}</strong>
          </div>
          <div>&bull;</div>
          <div>
            Outstanding: <strong className="text-amber-400">€{outstandingRevenue}</strong>
          </div>
        </div>
      </div>

      {/* Departures List */}
      {loading ? (
        <div className="p-16 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Compiling departure manifests and fleet allocations...</p>
        </div>
      ) : departures.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400">
          <Ship className="w-8 h-8 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-300">No departures scheduled for {selectedDate}</p>
          <p className="text-xs text-stone-500 mt-1">
            Click "Schedule Departure" above or check the Operations Calendar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {departures.map((dep) => {
            const currentStatus = dep.status || (dep.operationalStatus.toLowerCase() as DepartureStatus);
            const maxCap = dep.capacity || dep.vesselCapacity || 35;
            const isFull = dep.passengerCount >= maxCap;
            const remaining = Math.max(0, maxCap - dep.passengerCount);

            return (
              <div
                key={dep.id}
                className="bg-stone-950 border border-stone-800 rounded-xl p-5 space-y-4 hover:border-stone-700 transition-colors shadow-xs"
              >
                {/* Departure Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 font-mono font-bold text-white text-base">
                      {dep.startTime || dep.departureTime}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">{dep.tourTitle}</h3>
                      <div className="flex items-center space-x-2 text-[11px] text-stone-400 mt-0.5">
                        <span className="flex items-center space-x-1">
                          <Users className="w-3.5 h-3.5 text-stone-500" />
                          <strong className="text-white">{dep.passengerCount}</strong> booked /{' '}
                          <span className="text-stone-300">{maxCap} capacity</span>
                        </span>
                        <span>&bull;</span>
                        <span className={remaining === 0 ? 'text-red-400 font-bold' : 'text-stone-400'}>
                          {remaining} spots left
                        </span>
                        <span>&bull;</span>
                        <span>{dep.bookingsCount} Reservations</span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Quick Transition */}
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-bold border uppercase tracking-wider ${getStatusBadge(
                        currentStatus
                      )}`}
                    >
                      {currentStatus.replace('_', ' ')}
                    </span>

                    <select
                      value={currentStatus}
                      onChange={(e) => handleStatusChange(dep, e.target.value as DepartureStatus)}
                      className="px-2.5 py-1 bg-stone-900 border border-stone-800 rounded text-stone-200 text-xs focus:outline-none"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="boarding">Boarding</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {/* Logistics Grid: Vessel, Guide, Pickups, and Finances */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  {/* Assigned Vessel */}
                  <div className="p-3 bg-stone-900/60 rounded-lg border border-stone-800/80 space-y-1">
                    <span className="text-[10px] text-stone-500 uppercase font-bold flex items-center space-x-1">
                      <Ship className="w-3 h-3 text-[#2dd4bf]" />
                      <span>Assigned Vessel</span>
                    </span>
                    <div className="font-bold text-white text-xs truncate">
                      {dep.vesselName || 'Unassigned Vessel'}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      Capacity: {dep.passengerCount} / {dep.vesselCapacity || maxCap} pax
                      {isFull && <span className="text-red-400 font-bold ml-1">(FULL)</span>}
                    </div>
                  </div>

                  {/* Guide / Captain */}
                  <div className="p-3 bg-stone-900/60 rounded-lg border border-stone-800/80 space-y-1">
                    <span className="text-[10px] text-stone-500 uppercase font-bold flex items-center space-x-1">
                      <Users className="w-3 h-3 text-sky-400" />
                      <span>Guide & Captain</span>
                    </span>
                    <div className="font-bold text-white text-xs truncate">
                      {dep.guideName || dep.captainName || 'Pending Staff Assignment'}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      Role: {dep.guideRole || 'Lead Guide / Captain'}
                    </div>
                  </div>

                  {/* Transfer Driver */}
                  <div className="p-3 bg-stone-900/60 rounded-lg border border-stone-800/80 space-y-1">
                    <span className="text-[10px] text-stone-500 uppercase font-bold flex items-center space-x-1">
                      <Car className="w-3 h-3 text-amber-400" />
                      <span>Transfer Dispatch</span>
                    </span>
                    <div className="font-bold text-white text-xs truncate">
                      {dep.driverName || 'Central Fleet Transfer'}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      Pickups: {dep.pickupLocations.length} locations
                    </div>
                  </div>

                  {/* Pier Financial Balance */}
                  <div className="p-3 bg-stone-900/60 rounded-lg border border-stone-800/80 space-y-1">
                    <span className="text-[10px] text-stone-500 uppercase font-bold flex items-center space-x-1">
                      <DollarSign className="w-3 h-3 text-emerald-400" />
                      <span>Financial Status</span>
                    </span>
                    <div className="font-bold text-white text-xs">
                      €{dep.paymentSummary.totalEur} Total
                    </div>
                    <div className="text-[10px] text-stone-400">
                      Balance Due: <strong className="text-amber-400">€{dep.paymentSummary.outstandingEur}</strong>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Pickups overview and navigation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-[11px] text-stone-400 border-t border-stone-800/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-stone-500 font-semibold">Pickup Stops:</span>
                    {dep.pickupLocations.slice(0, 3).map((loc, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-stone-900 rounded border border-stone-800 text-stone-300"
                      >
                        {loc.name} ({loc.passengerCount}pax)
                      </span>
                    ))}
                    {dep.pickupLocations.length > 3 && (
                      <span className="text-stone-500">
                        +{dep.pickupLocations.length - 3} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => onNavigateTab && onNavigateTab('ops_manifests', dep.tourId)}
                      className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
                    >
                      View Manifest
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab && onNavigateTab('ops_assignments')}
                      className="px-2.5 py-1 bg-[#0A6C74]/20 hover:bg-[#0A6C74]/30 border border-[#0A6C74]/40 text-[#2dd4bf] rounded text-xs transition-colors cursor-pointer"
                    >
                      Assign Staff & Vessel
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Schedule Departure */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-white text-base">Schedule New Tour Departure</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateDeparture} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Select Excursion</label>
                <select
                  value={newTourId}
                  onChange={(e) => setNewTourId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  required
                >
                  {tours.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Departure Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Max Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="150"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(parseInt(e.target.value) || 35)}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">End Time</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Assign Vessel</label>
                  <select
                    value={newVesselId}
                    onChange={(e) => setNewVesselId(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  >
                    <option value="">Unassigned Vessel</option>
                    {vessels.map((v) => (
                      <option
                        key={v.id}
                        value={v.id}
                        disabled={!v.is_active || v.status === 'maintenance' || v.status === 'dry_dock'}
                      >
                        {v.name} ({v.passenger_capacity} pax)
                        {!v.is_active || v.status === 'maintenance' ? ' - INACTIVE' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Lead Guide / Captain</label>
                  <select
                    value={newGuideId}
                    onChange={(e) => setNewGuideId(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                  >
                    <option value="">Unassigned Guide</option>
                    {guides.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.full_name} ({g.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Initial Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as DepartureStatus)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="boarding">Boarding</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Operations Notes</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Special instructions, marine permissions, or guest dietary notes..."
                  rows={2}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Scheduling...' : 'Save Departure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
