import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Users,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Edit2,
  Plus,
  RefreshCw,
  Compass,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  listAvailabilitySlots,
  updateAvailabilitySlot,
  setBlackoutDate,
} from '../../../services/operationsService';
import { AvailabilitySlot } from '../../../types/operations';
import { Tour } from '../../../types';
import { ALL_TOURS } from '../../../data/toursData';
import { getPublishedTours } from '../../../services/tourService';
import { useToast } from '../../../contexts/ToastContext';

export const OperationsAvailability: React.FC = () => {
  const { showToast } = useToast();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [tours, setTours] = useState<Tour[]>(ALL_TOURS);
  const [loading, setLoading] = useState(true);
  const [tourFilter, setTourFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit / Change Capacity Modal
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [editCapacity, setEditCapacity] = useState<number>(35);
  const [editNotes, setEditNotes] = useState<string>('');
  const [savingAction, setSavingAction] = useState(false);

  // Blackout Date Modal
  const [isBlackoutModalOpen, setIsBlackoutModalOpen] = useState(false);
  const [blackoutTourId, setBlackoutTourId] = useState<string>(ALL_TOURS[0]?.id || '');
  const [blackoutDateVal, setBlackoutDateVal] = useState<string>('');
  const [blackoutNotes, setBlackoutNotes] = useState<string>('Annual vessel drydock & Coast Guard inspection');

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, loadedTours] = await Promise.all([
        listAvailabilitySlots(),
        getPublishedTours().catch(() => []),
      ]);
      setSlots(data);
      if (loadedTours && loadedTours.length > 0) {
        setTours(loadedTours);
        if (!blackoutTourId) setBlackoutTourId(loadedTours[0].id);
      }
    } catch (err) {
      console.warn('Failed to load availability slots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (tourFilter !== 'all' && slot.tourId !== tourFilter) return false;
      if (statusFilter !== 'all' && slot.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          slot.tourTitle.toLowerCase().includes(q) ||
          slot.date.includes(q) ||
          (slot.notes && slot.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [slots, tourFilter, statusFilter, searchQuery]);

  const handleToggleOpenClose = async (slot: AvailabilitySlot) => {
    const nextStatus = slot.status === 'available' ? 'unavailable' : 'available';
    const isBlackout = nextStatus === 'unavailable';
    await updateAvailabilitySlot(slot.id, {
      status: nextStatus,
      isBlackout,
      notes: isBlackout ? 'Closed by operations staff' : null,
    });
    setSlots((prev) =>
      prev.map((s) => (s.id === slot.id ? { ...s, status: nextStatus, isBlackout } : s))
    );
    showToast(
      `Departure on ${slot.date} marked as ${nextStatus === 'available' ? 'OPEN' : 'CLOSED'}.`,
      'success'
    );
  };

  const handleSaveCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setSavingAction(true);
    try {
      await updateAvailabilitySlot(selectedSlot.id, {
        maxCapacity: editCapacity,
        notes: editNotes || null,
      });
      setSlots((prev) =>
        prev.map((s) =>
          s.id === selectedSlot.id
            ? {
                ...s,
                maxCapacity: editCapacity,
                remainingCapacity: Math.max(0, editCapacity - s.bookedCount),
                notes: editNotes || null,
              }
            : s
        )
      );
      showToast(`Capacity updated to ${editCapacity} seats for ${selectedSlot.date}.`, 'success');
      setSelectedSlot(null);
    } catch {
      showToast('Failed to update capacity', 'error');
    } finally {
      setSavingAction(false);
    }
  };

  const handleApplyBlackout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blackoutTourId || !blackoutDateVal) return;

    await setBlackoutDate(blackoutTourId, blackoutDateVal, true, blackoutNotes);
    showToast(`Blackout date scheduled on ${blackoutDateVal}. Bookings blocked.`, 'success');
    setIsBlackoutModalOpen(false);
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Capacity & Slot Management
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <Calendar className="w-6 h-6 text-[#2dd4bf]" />
            <span>Tour Availability & Capacity Calendar</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Authoritative seat caps, blackout date triggers, real-time booked counts, and booking cutoff gates.
          </p>
        </div>

        <div className="flex items-center space-x-2">
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
            onClick={() => {
              setBlackoutDateVal(new Date().toISOString().split('T')[0]);
              setIsBlackoutModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-200 rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-red-400" />
            <span>Set Blackout Date</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search excursion title or date (YYYY-MM-DD)..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tourFilter}
            onChange={(e) => setTourFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-300 focus:outline-none max-w-xs"
          >
            <option value="all">All Tours ({tours.length})</option>
            {tours.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="available">Open / Available</option>
            <option value="sold_out">Sold Out</option>
            <option value="unavailable">Closed / Blackout</option>
          </select>
        </div>
      </div>

      {/* Availability Table */}
      {loading ? (
        <div className="p-16 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Computing real-time passenger capacity across all dates...</p>
        </div>
      ) : filteredSlots.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400">
          <Calendar className="w-8 h-8 text-stone-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-300">No availability slots found</p>
          <p className="text-xs text-stone-500">Try modifying your tour or status filter.</p>
        </div>
      ) : (
        <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 border-b border-stone-800 text-stone-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Departure Date</th>
                  <th className="py-3 px-4">Tour / Excursion</th>
                  <th className="py-3 px-4 font-mono text-center">Departure Time</th>
                  <th className="py-3 px-4 font-mono text-center">Max Cap</th>
                  <th className="py-3 px-4 font-mono text-center">Booked</th>
                  <th className="py-3 px-4 font-mono text-center">Remaining</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Operational Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/80">
                {filteredSlots.map((slot) => {
                  const isClosed = slot.status === 'unavailable';
                  const isSoldOut = slot.status === 'sold_out';

                  return (
                    <tr
                      key={slot.id}
                      className={`hover:bg-stone-900/50 transition-colors ${
                        isClosed ? 'bg-red-950/20' : isSoldOut ? 'bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                        {slot.date}
                      </td>

                      <td className="py-3 px-4 font-medium text-stone-200">
                        {slot.tourTitle}
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-stone-300">
                        {slot.departureTime}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-white">
                        {slot.maxCapacity}
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-sky-400 font-bold">
                        {slot.bookedCount}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {slot.remainingCapacity <= 0 ? (
                          <span className="text-red-400">0</span>
                        ) : slot.remainingCapacity <= 5 ? (
                          <span className="text-amber-400">{slot.remainingCapacity}</span>
                        ) : (
                          <span className="text-emerald-400">{slot.remainingCapacity}</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isClosed
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : isSoldOut
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isClosed ? 'Closed / Blackout' : isSoldOut ? 'Sold Out' : 'Open'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-stone-400 text-[11px] max-w-xs truncate">
                        {slot.notes || 'Normal daily departure'}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSlot(slot);
                            setEditCapacity(slot.maxCapacity);
                            setEditNotes(slot.notes || '');
                          }}
                          className="px-2 py-1 bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white rounded text-[10px] font-semibold border border-stone-800 cursor-pointer"
                        >
                          Capacity
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleOpenClose(slot)}
                          className={`px-2 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                            isClosed
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-stone-800 hover:bg-red-950 text-stone-300 hover:text-red-300'
                          }`}
                        >
                          {isClosed ? 'Reopen' : 'Close'}
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

      {/* CHANGE CAPACITY MODAL */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Edit2 className="w-4 h-4 text-[#2dd4bf]" />
              <span>Modify Slot Capacity</span>
            </h3>

            <p className="text-stone-300">
              Editing passenger capacity for <strong className="text-white">{selectedSlot.tourTitle}</strong> on{' '}
              <strong className="text-white font-mono">{selectedSlot.date}</strong>.
            </p>

            <form onSubmit={handleSaveCapacity} className="space-y-3">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">
                  Maximum Passenger Capacity (Pax) *
                </label>
                <input
                  type="number"
                  required
                  min={selectedSlot.bookedCount}
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white font-mono"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">
                  Currently booked: {selectedSlot.bookedCount} travelers. Cannot set below active reservations.
                </span>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Operational Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Switched to larger catamaran vessel"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAction}
                  className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold cursor-pointer"
                >
                  Save Capacity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BLACKOUT DATE MODAL */}
      {isBlackoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Lock className="w-4 h-4 text-red-400" />
              <span>Configure Operational Blackout Date</span>
            </h3>

            <p className="text-stone-300 text-[11px]">
              Blackout dates immediately close departures and prevent public online bookings from going through.
            </p>

            <form onSubmit={handleApplyBlackout} className="space-y-3">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Excursion *</label>
                <select
                  value={blackoutTourId}
                  onChange={(e) => setBlackoutTourId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                >
                  {tours.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Blackout Date *</label>
                <input
                  type="date"
                  required
                  value={blackoutDateVal}
                  onChange={(e) => setBlackoutDateVal(e.target.value)}
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Reason / Notes</label>
                <input
                  type="text"
                  value={blackoutNotes}
                  onChange={(e) => setBlackoutNotes(e.target.value)}
                  placeholder="e.g. Vessel maintenance, Coast Guard harbor closure"
                  className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsBlackoutModalOpen(false)}
                  className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold cursor-pointer"
                >
                  Apply Blackout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
