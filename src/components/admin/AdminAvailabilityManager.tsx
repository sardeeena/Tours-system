import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Users,
  Clock,
  Save,
  ChevronLeft,
  ChevronRight,
  Filter,
  Ban,
  Check
} from 'lucide-react';
import { supabase, isSupabaseConfigured, formatSupabaseError } from '../../services/supabaseClient';
import { adminListTours, notifyCatalogueDataChanged } from '../../services/tourService';
import { DbTour, DbTourAvailability } from '../../types/database';
import { useToast } from '../../contexts/ToastContext';

const LOCAL_AVAIL_KEY = 'rse_admin_availability_cache';

export const AdminAvailabilityManager: React.FC = () => {
  const { showToast } = useToast();
  const [tours, setTours] = useState<DbTour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, DbTourAvailability>>({});

  // Generate next 28 days
  const dates = React.useMemo(() => {
    const list: string[] = [];
    const today = new Date();
    for (let i = 0; i < 28; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      list.push(d.toISOString().split('T')[0]);
    }
    return list;
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const loadedTours = await adminListTours();
        setTours(loadedTours);
        if (loadedTours.length > 0) {
          setSelectedTourId(loadedTours[0].id);
        }
      } catch (err) {
        console.warn('Failed to load tours for availability:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // When selected tour changes, load availability
  useEffect(() => {
    if (!selectedTourId) return;

    async function loadSlots() {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('tour_availability')
          .select('*')
          .eq('tour_id', selectedTourId)
          .gte('date', dates[0])
          .lte('date', dates[dates.length - 1]);

        if (!error && data) {
          const map: Record<string, DbTourAvailability> = {};
          data.forEach((slot: any) => {
            map[slot.date] = slot;
          });
          setAvailabilityMap(map);
          return;
        }
      }

      // Local storage fallback
      try {
        const raw = localStorage.getItem(`${LOCAL_AVAIL_KEY}_${selectedTourId}`);
        if (raw) {
          setAvailabilityMap(JSON.parse(raw));
          return;
        }
      } catch {
        // ignore
      }

      setAvailabilityMap({});
    }

    loadSlots();
  }, [selectedTourId, dates]);

  const selectedTour = tours.find((t) => t.id === selectedTourId);
  const defaultCapacity = selectedTour?.max_guests || 35;

  // Toggle status for a date
  const handleToggleStatus = (dateStr: string) => {
    const current = availabilityMap[dateStr];
    let nextStatus: 'available' | 'unavailable' | 'sold_out' = 'unavailable';

    if (!current || current.status === 'available') {
      nextStatus = 'unavailable';
    } else if (current.status === 'unavailable') {
      nextStatus = 'sold_out';
    } else {
      nextStatus = 'available';
    }

    const updatedSlot: DbTourAvailability = {
      id: current?.id || `avail-${selectedTourId}-${dateStr}`,
      tour_id: selectedTourId,
      date: dateStr,
      max_capacity: current?.max_capacity || defaultCapacity,
      booked_count: nextStatus === 'sold_out' ? (current?.max_capacity || defaultCapacity) : 0,
      status: nextStatus,
      notes: null,
      created_at: current?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newMap = { ...availabilityMap, [dateStr]: updatedSlot };
    setAvailabilityMap(newMap);
    localStorage.setItem(`${LOCAL_AVAIL_KEY}_${selectedTourId}`, JSON.stringify(newMap));
  };

  // Change capacity for a date
  const handleCapacityChange = (dateStr: string, newCap: number) => {
    const current = availabilityMap[dateStr];
    const cap = Math.max(1, newCap);

    const updatedSlot: DbTourAvailability = {
      id: current?.id || `avail-${selectedTourId}-${dateStr}`,
      tour_id: selectedTourId,
      date: dateStr,
      max_capacity: cap,
      booked_count: current?.booked_count || 0,
      status: current?.status || 'available',
      notes: null,
      created_at: current?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newMap = { ...availabilityMap, [dateStr]: updatedSlot };
    setAvailabilityMap(newMap);
    localStorage.setItem(`${LOCAL_AVAIL_KEY}_${selectedTourId}`, JSON.stringify(newMap));
  };

  // Save changes to Supabase
  const handleSaveToSupabase = async () => {
    setSaving(true);
    setActionMessage(null);

    const records = Object.values(availabilityMap).map((slot) => ({
      tour_id: slot.tour_id,
      date: slot.date,
      max_capacity: slot.max_capacity,
      booked_count: slot.booked_count,
      status: slot.status,
      notes: slot.notes,
    }));

    if (isSupabaseConfigured() && records.length > 0) {
      try {
        const { error } = await supabase
          .from('tour_availability')
          .upsert(records, { onConflict: 'tour_id,date' });

        if (error) {
          throw error;
        }
        showToast('Availability slots synchronized with Supabase database.', 'success');
      } catch (err: any) {
        console.warn('Failed to upsert tour availability in Supabase:', err);
        showToast(formatSupabaseError(err), 'error');
      }
    } else {
      showToast('Availability slots saved in local storage cache.', 'info');
    }

    setSaving(false);
    setActionMessage('Availability slots and daily capacities synchronized successfully.');
    notifyCatalogueDataChanged('tours');
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Quick set all to available
  const handleSetAllAvailable = () => {
    const newMap = { ...availabilityMap };
    dates.forEach((d) => {
      newMap[d] = {
        id: `avail-${selectedTourId}-${d}`,
        tour_id: selectedTourId,
        date: d,
        max_capacity: defaultCapacity,
        booked_count: 0,
        status: 'available',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
    setAvailabilityMap(newMap);
    localStorage.setItem(`${LOCAL_AVAIL_KEY}_${selectedTourId}`, JSON.stringify(newMap));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">
            Tour Availability & Daily Capacity Calendar
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Manage daily passenger quotas, blackout dates, and departure capacity for the next 4 weeks.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleSetAllAvailable}
            className="px-3 py-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
          >
            Mark All Days Available
          </button>

          <button
            type="button"
            onClick={handleSaveToSupabase}
            disabled={saving}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Availability'}</span>
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Tour Selector Toolbar */}
      <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <span className="text-stone-300 font-semibold whitespace-nowrap">Select Excursion:</span>
          <select
            value={selectedTourId}
            onChange={(e) => setSelectedTourId(e.target.value)}
            className="w-full sm:w-80 px-3 py-2 bg-stone-900 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
          >
            {tours.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} (Max: {t.max_guests} guests)
              </option>
            ))}
          </select>
        </div>

        {selectedTour && (
          <div className="flex items-center space-x-4 text-stone-400 text-xs">
            <span className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              <span>Departs: <strong className="text-white">{selectedTour.departure_time || '08:30 AM'}</strong></span>
            </span>
            <span className="flex items-center space-x-1">
              <Users className="w-3.5 h-3.5 text-stone-500" />
              <span>Standard Cap: <strong className="text-white">{selectedTour.max_guests}</strong></span>
            </span>
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-850">
          <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
            <CalendarIcon className="w-4 h-4 text-[#0A6C74]" />
            <span>4-Week Capacity Manifest</span>
          </h2>
          <div className="flex items-center space-x-4 text-[11px] text-stone-400">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Available</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Sold Out</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>Blackout / Closed</span>
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-stone-400">
            <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs">Loading availability calendar...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {dates.map((dateStr) => {
              const d = new Date(dateStr);
              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
              const monthName = d.toLocaleDateString('en-US', { month: 'short' });
              const dayNum = d.getDate();
              const isToday = dateStr === new Date().toISOString().split('T')[0];

              const slot = availabilityMap[dateStr];
              const status = slot?.status || 'available';
              const cap = slot?.max_capacity || defaultCapacity;

              return (
                <div
                  key={dateStr}
                  className={`p-3 rounded-lg border transition-all flex flex-col justify-between text-xs space-y-2 ${
                    status === 'available'
                      ? 'bg-stone-900/60 border-stone-800 hover:border-emerald-500/50'
                      : status === 'sold_out'
                      ? 'bg-amber-950/20 border-amber-800/40 hover:border-amber-700'
                      : 'bg-red-950/20 border-red-900/40 hover:border-red-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase font-mono block">
                        {dayName}
                      </span>
                      <span className={`text-base font-bold ${isToday ? 'text-[#2dd4bf]' : 'text-white'}`}>
                        {monthName} {dayNum}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(dateStr)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                        status === 'available'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : status === 'sold_out'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-red-500/20 text-red-300 border border-red-500/40'
                      }`}
                      title="Click to toggle: Available -> Unavailable -> Sold Out"
                    >
                      {status === 'available' ? 'Open' : status === 'sold_out' ? 'Full' : 'Blocked'}
                    </button>
                  </div>

                  {/* Daily Capacity Control */}
                  <div className="pt-1 border-t border-stone-850 flex items-center justify-between">
                    <span className="text-[10px] text-stone-400">Seats:</span>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={cap}
                      onChange={(e) => handleCapacityChange(dateStr, Number(e.target.value))}
                      className="w-14 px-1.5 py-0.5 bg-stone-950 border border-stone-800 rounded text-right text-white font-mono text-[11px] focus:outline-none focus:border-[#0A6C74]"
                      disabled={status === 'unavailable'}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
