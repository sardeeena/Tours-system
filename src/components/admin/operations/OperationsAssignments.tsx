import React, { useState, useEffect } from 'react';
import {
  Compass,
  Ship,
  Anchor,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Car,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import {
  listAssignments,
  saveAssignment,
  listVessels,
  listGuides,
  getTodayDepartures,
  detectAssignmentConflicts,
} from '../../../services/operationsService';
import {
  OperationalAssignment,
  OperationalStatus,
  AssignmentConflict,
} from '../../../types/operations';
import { DbVessel, DbGuide } from '../../../types/database';
import { Tour } from '../../../types';
import { ALL_TOURS } from '../../../data/toursData';
import { getPublishedTours } from '../../../services/tourService';
import { useToast } from '../../../contexts/ToastContext';

export const OperationsAssignments: React.FC = () => {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [assignments, setAssignments] = useState<OperationalAssignment[]>([]);
  const [vessels, setVessels] = useState<DbVessel[]>([]);
  const [guides, setGuides] = useState<DbGuide[]>([]);
  const [tours, setTours] = useState<Tour[]>(ALL_TOURS);
  const [loading, setLoading] = useState(true);

  // Assignment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tourId, setTourId] = useState<string>(ALL_TOURS[0]?.id || '');
  const [departureTime, setDepartureTime] = useState<string>('08:30');
  const [vesselId, setVesselId] = useState<string>('');
  const [guideId, setGuideId] = useState<string>('');
  const [captainId, setCaptainId] = useState<string>('');
  const [driverId, setDriverId] = useState<string>('');
  const [status, setStatus] = useState<OperationalStatus>('Scheduled');
  const [notes, setNotes] = useState<string>('');
  const [preSaveConflicts, setPreSaveConflicts] = useState<AssignmentConflict[]>([]);
  const [validatingConflicts, setValidatingConflicts] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assigns, ves, gui, loadedTours] = await Promise.all([
        listAssignments(selectedDate),
        listVessels(),
        listGuides(),
        getPublishedTours().catch(() => []),
      ]);
      setAssignments(assigns);
      setVessels(ves);
      setGuides(gui);
      if (loadedTours && loadedTours.length > 0) {
        setTours(loadedTours);
        if (!tourId) setTourId(loadedTours[0].id);
      }
    } catch (err) {
      console.warn('Failed to load assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  // Real-time pre-save conflict check whenever inputs change in the modal
  useEffect(() => {
    if (!isModalOpen || !tourId || !selectedDate) {
      setPreSaveConflicts([]);
      return;
    }

    let active = true;
    setValidatingConflicts(true);

    const timer = setTimeout(async () => {
      try {
        const found = await detectAssignmentConflicts({
          departureId: editingId || undefined,
          tourId,
          date: selectedDate,
          startTime: departureTime,
          vesselId: vesselId || null,
          guideId: guideId || null,
          captainId: captainId || null,
          driverId: driverId || null,
        });
        if (active) {
          setPreSaveConflicts(found);
        }
      } catch {
        // ignore
      } finally {
        if (active) setValidatingConflicts(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isModalOpen, tourId, selectedDate, departureTime, vesselId, guideId, captainId, driverId, editingId]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setTourId(ALL_TOURS[0]?.id || '');
    setDepartureTime('08:30');
    setVesselId('');
    setGuideId('');
    setCaptainId('');
    setDriverId('');
    setStatus('Scheduled');
    setNotes('');
    setPreSaveConflicts([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (a: OperationalAssignment) => {
    setEditingId(a.id);
    setTourId(a.tourId);
    setDepartureTime(a.departureTime || '08:30');
    setVesselId(a.vesselId || '');
    setGuideId(a.guideId || '');
    setCaptainId(a.captainId || '');
    setDriverId(a.driverId || '');
    setStatus(a.status || 'Scheduled');
    setNotes(a.notes || '');
    setPreSaveConflicts([]);
    setIsModalOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tourId || !selectedDate) return;

    const res = await saveAssignment({
      id: editingId || undefined,
      tourId,
      date: selectedDate,
      departureTime,
      vesselId: vesselId || null,
      guideId: guideId || null,
      captainId: captainId || null,
      driverId: driverId || null,
      status,
      notes: notes.trim() || null,
    });

    if (!res.success) {
      showToast(res.error || 'Conflict detected', 'error');
      if (res.conflicts) setPreSaveConflicts(res.conflicts);
      return;
    }

    showToast('Operational departure assignment confirmed.', 'success');
    setIsModalOpen(false);
    await loadData();
  };

  const captains = guides.filter((g) => g.role === 'captain');
  const tourGuides = guides.filter((g) => g.role === 'guide' || g.role === 'tour_guide' || g.role === 'dive_master' || g.role === 'snorkel_guide');
  const transferDrivers = guides.filter((g) => g.role === 'driver');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Logistics & Crew Dispatch
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Compass className="w-6 h-6 text-[#2dd4bf]" />
            <span>Operational Assignments & Dispatch</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Assign maritime vessels, certified captains, lead tour guides, and transfer drivers to scheduled tour departures with real-time conflict detection.
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
            onClick={handleOpenCreate}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Assignment</span>
          </button>
        </div>
      </div>

      {/* Assignments Table */}
      {loading ? (
        <div className="p-16 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading operational dispatch assignments...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400">
          <Compass className="w-8 h-8 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-300">No crew assignments dispatched for {selectedDate}</p>
          <p className="text-xs text-stone-500 mt-1">
            Click "Create Assignment" above to assign fleet vessels, captains, and guides.
          </p>
        </div>
      ) : (
        <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3 font-mono">Time</th>
                  <th className="py-3 px-3">Tour Excursion</th>
                  <th className="py-3 px-3">Assigned Vessel</th>
                  <th className="py-3 px-3">Captain</th>
                  <th className="py-3 px-3">Lead Guide</th>
                  <th className="py-3 px-3">Transfer Driver</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80">
                {assignments.map((a) => {
                  const vessel = vessels.find((v) => v.id === a.vesselId);
                  const guide = guides.find((g) => g.id === a.guideId);
                  const captain = guides.find((g) => g.id === a.captainId);
                  const driver = guides.find((g) => g.id === a.driverId);

                  return (
                    <tr key={a.id} className="hover:bg-stone-900/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#2dd4bf]">
                        {a.departureTime || '08:30'}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-white">{a.tourTitle}</div>
                        {a.notes && (
                          <div className="text-[10px] text-stone-400 truncate max-w-xs italic">
                            Note: {a.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {vessel ? (
                          <div>
                            <div className="font-semibold text-white flex items-center space-x-1">
                              <Ship className="w-3.5 h-3.5 text-[#2dd4bf]" />
                              <span>{vessel.name}</span>
                            </div>
                            <div className="text-[10px] text-stone-400">
                              {vessel.passenger_capacity} pax &bull; {vessel.port_marina}
                            </div>
                          </div>
                        ) : (
                          <span className="text-amber-400/80 text-[11px] italic">Unassigned Fleet</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {captain ? (
                          <div className="font-medium text-stone-200 flex items-center space-x-1">
                            <Anchor className="w-3.5 h-3.5 text-[#2dd4bf]" />
                            <span>{captain.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-stone-500">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {guide ? (
                          <div className="font-medium text-stone-200 flex items-center space-x-1">
                            <Users className="w-3.5 h-3.5 text-sky-400" />
                            <span>{guide.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-amber-400/80 text-[11px] italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {driver ? (
                          <div className="font-medium text-stone-200 flex items-center space-x-1">
                            <Car className="w-3.5 h-3.5 text-amber-400" />
                            <span>{driver.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-stone-500">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-900 text-stone-300 border border-stone-800">
                          {a.status || 'Scheduled'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(a)}
                          className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-stone-800 cursor-pointer"
                          title="Edit Assignment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Assign Crew & Fleet with Real-time Conflict Detector */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingId ? 'Edit Operational Assignment' : 'Dispatch Operational Assignment'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* PRE-SAVE CONFLICT WARNING BOX */}
            {preSaveConflicts.length > 0 && (
              <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg space-y-1.5 text-xs">
                <div className="flex items-center space-x-2 text-red-400 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Scheduling Conflicts Detected (Review Before Saving)</span>
                </div>
                <div className="space-y-1 pl-6">
                  {preSaveConflicts.map((c, idx) => (
                    <div key={idx} className="text-red-300 text-[11px] list-disc">
                      &bull; {c.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validatingConflicts && (
              <div className="text-[10px] text-stone-400 flex items-center space-x-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Checking fleet and staff availability for conflicts...</span>
              </div>
            )}

            <form onSubmit={handleSaveAssignment} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Select Tour Excursion</label>
                <select
                  value={tourId}
                  onChange={(e) => setTourId(e.target.value)}
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
                  <label className="block text-stone-300 font-semibold mb-1">Departure Time</label>
                  <input
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Vessel assignment */}
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Assign Maritime Vessel</label>
                <select
                  value={vesselId}
                  onChange={(e) => setVesselId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                >
                  <option value="">Unassigned Fleet</option>
                  {vessels.map((v) => (
                    <option
                      key={v.id}
                      value={v.id}
                      disabled={!v.is_active || v.status === 'maintenance' || v.status === 'dry_dock'}
                    >
                      {v.name} ({v.passenger_capacity} pax) - {v.port_marina}
                      {!v.is_active || v.status === 'maintenance' ? ' (INACTIVE/MAINTENANCE)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Captain assignment */}
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Assign Captain</label>
                <select
                  value={captainId}
                  onChange={(e) => setCaptainId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                >
                  <option value="">No Captain Assigned</option>
                  {captains.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.rating}★)
                    </option>
                  ))}
                </select>
              </div>

              {/* Lead Guide assignment */}
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Assign Lead Guide</label>
                <select
                  value={guideId}
                  onChange={(e) => setGuideId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                >
                  <option value="">No Lead Guide Assigned</option>
                  {tourGuides.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.full_name} ({g.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer driver assignment */}
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Assign Transfer Driver</label>
                <select
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                >
                  <option value="">Central Dispatch / Unassigned</option>
                  {transferDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.phone || 'Driver'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Operational Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OperationalStatus)}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-stone-200"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Preparing">Preparing / Boarding</option>
                  <option value="Ready">Ready for Pier Departure</option>
                  <option value="Departed">Departed (Underway)</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Dispatch Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specific maritime clearance instructions, fuel status, or captain brief..."
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
                  disabled={preSaveConflicts.some((c) => c.type === 'vessel_inactive' || c.type === 'vessel_capacity_exceeded')}
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
