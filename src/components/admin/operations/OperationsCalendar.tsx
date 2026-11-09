import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Ship,
  Users,
  Clock,
  RefreshCw,
  Car,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Compass,
} from 'lucide-react';
import {
  getTodayDepartures,
  getDailyPickupSchedule,
  listAvailabilitySlots,
  listVessels,
  listGuides,
} from '../../../services/operationsService';
import {
  OperationalDeparture,
  PickupScheduleItem,
  AvailabilitySlot,
} from '../../../types/operations';
import { DbVessel, DbGuide } from '../../../types/database';

interface OperationsCalendarProps {
  onSelectDepartureDate?: (date: string) => void;
}

type CalendarViewMode = 'day' | 'week' | 'month';

export const OperationsCalendar: React.FC<OperationsCalendarProps> = ({
  onSelectDepartureDate,
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  // Real operational datasets
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [departures, setDepartures] = useState<OperationalDeparture[]>([]);
  const [pickups, setPickups] = useState<PickupScheduleItem[]>([]);
  const [vessels, setVessels] = useState<DbVessel[]>([]);
  const [guides, setGuides] = useState<DbGuide[]>([]);

  const selectedDateStr = currentDate.toISOString().split('T')[0];

  const loadData = async () => {
    setLoading(true);
    try {
      const [allSlots, deps, pUps, ves, gui] = await Promise.all([
        listAvailabilitySlots(),
        getTodayDepartures(selectedDateStr),
        getDailyPickupSchedule(selectedDateStr),
        listVessels(),
        listGuides(),
      ]);
      setSlots(allSlots);
      setDepartures(deps);
      setPickups(pUps);
      setVessels(ves);
      setGuides(gui);
    } catch (err) {
      console.warn('Failed to load operational calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDateStr, viewMode]);

  // Navigation handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day') {
      d.setDate(d.getDate() - 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day') {
      d.setDate(d.getDate() + 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Month generation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const monthDaysArray: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const prevDate = new Date(year, month - 1, day);
    monthDaysArray.push({
      dateStr: prevDate.toISOString().split('T')[0],
      dayNum: day,
      isCurrentMonth: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    monthDaysArray.push({
      dateStr: dateObj.toISOString().split('T')[0],
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  // Week generation
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
  const weekDaysArray: Array<{ dateStr: string; dayNum: number; dayName: string }> = [];
  for (let i = 0; i < 7; i++) {
    const wDate = new Date(startOfWeek);
    wDate.setDate(startOfWeek.getDate() + i);
    weekDaysArray.push({
      dateStr: wDate.toISOString().split('T')[0],
      dayNum: wDate.getDate(),
      dayName: wDate.toLocaleDateString(undefined, { weekday: 'short' }),
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#2dd4bf] font-bold block mb-0.5">
            Operational Schedule Matrix
          </span>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <CalendarIcon className="w-6 h-6 text-[#2dd4bf]" />
            <span>Operations & Dispatch Calendar</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Real-time multi-view matrix of departures, reservations, pickup runs, fleet allocations, and guide dispatch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle: Day, Week, Month */}
          <div className="bg-stone-900 border border-stone-800 rounded-lg p-0.5 flex items-center text-xs">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                viewMode === 'day'
                  ? 'bg-[#0A6C74] text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-[#0A6C74] text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-[#0A6C74] text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Month
            </button>
          </div>

          {/* Date Controls */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs font-mono cursor-pointer"
            >
              Today
            </button>

            <span className="text-xs font-bold font-mono text-white px-3 py-1.5 bg-stone-950 border border-stone-800 rounded">
              {viewMode === 'day' &&
                currentDate.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              {viewMode === 'week' &&
                `Week of ${startOfWeek.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}`}
              {viewMode === 'month' &&
                currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>

            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* VIEW: MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs">
          <div className="grid grid-cols-7 bg-stone-900 border-b border-stone-800 text-center text-[11px] font-semibold text-stone-400 py-2.5">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-stone-800/80">
            {monthDaysArray.map((dayItem, idx) => {
              const daySlots = slots.filter((s) => s.date === dayItem.dateStr);
              const totalBooked = daySlots.reduce((sum, s) => sum + s.bookedCount, 0);
              const isToday = dayItem.dateStr === todayStr;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentDate(new Date(dayItem.dateStr));
                    if (onSelectDepartureDate) onSelectDepartureDate(dayItem.dateStr);
                  }}
                  className={`min-h-[115px] p-2 flex flex-col justify-between transition-colors cursor-pointer ${
                    dayItem.isCurrentMonth
                      ? 'bg-stone-950 hover:bg-stone-900/60'
                      : 'bg-stone-950/40 text-stone-600'
                  } ${isToday ? 'ring-1 ring-inset ring-[#2dd4bf]' : ''}`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-mono font-bold ${
                        isToday
                          ? 'px-1.5 py-0.2 rounded bg-[#0A6C74] text-white text-[11px]'
                          : dayItem.isCurrentMonth
                          ? 'text-white'
                          : 'text-stone-600'
                      }`}
                    >
                      {dayItem.dayNum}
                    </span>

                    {totalBooked > 0 && dayItem.isCurrentMonth && (
                      <span className="text-[10px] font-mono font-bold text-[#2dd4bf]">
                        {totalBooked} pax
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 mt-1">
                    {daySlots.slice(0, 2).map((s) => (
                      <div
                        key={s.id}
                        className={`text-[9px] px-1 py-0.5 rounded truncate font-medium ${
                          s.status === 'unavailable'
                            ? 'bg-red-500/20 text-red-300'
                            : s.status === 'sold_out'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-stone-900 text-stone-300 border border-stone-800'
                        }`}
                      >
                        {s.tourTitle.split(':')[0].substring(0, 16)}
                        {s.bookedCount > 0 && ` (${s.bookedCount})`}
                      </div>
                    ))}
                    {daySlots.length > 2 && (
                      <span className="text-[9px] text-stone-500 block">
                        +{daySlots.length - 2} more tours
                      </span>
                    )}
                  </div>

                  <div className="text-[9px] text-stone-500 font-mono text-right mt-1">
                    {dayItem.isCurrentMonth && (
                      <span className="hover:text-stone-300">&rarr; Inspect Day</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-xs">
          <div className="grid grid-cols-7 bg-stone-900 border-b border-stone-800 divide-x divide-stone-800 text-center py-2.5">
            {weekDaysArray.map((day, idx) => (
              <div key={idx} className="text-xs">
                <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                  {day.dayName}
                </span>
                <span
                  className={`font-mono font-bold inline-block px-1.5 py-0.5 rounded mt-0.5 ${
                    day.dateStr === todayStr
                      ? 'bg-[#0A6C74] text-white'
                      : 'text-stone-200'
                  }`}
                >
                  {day.dayNum}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-stone-800/80 min-h-[380px]">
            {weekDaysArray.map((day, idx) => {
              const daySlots = slots.filter((s) => s.date === day.dateStr);
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentDate(new Date(day.dateStr));
                    setViewMode('day');
                  }}
                  className="p-2 space-y-2 hover:bg-stone-900/30 transition-colors cursor-pointer"
                >
                  {daySlots.length === 0 ? (
                    <div className="text-[10px] text-stone-600 text-center pt-8">
                      No tours booked
                    </div>
                  ) : (
                    daySlots.map((s) => (
                      <div
                        key={s.id}
                        className="p-2 rounded bg-stone-900 border border-stone-800 text-xs space-y-1 hover:border-stone-700"
                      >
                        <div className="font-semibold text-white text-[11px] truncate">
                          {s.tourTitle}
                        </div>
                        <div className="text-[10px] text-[#2dd4bf] font-mono flex items-center justify-between">
                          <span>{s.departureTime}</span>
                          <span>{s.bookedCount} pax</span>
                        </div>
                        <div className="text-[9px] text-stone-400">
                          {s.remainingCapacity} spots remaining
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: DAY VIEW */}
      {viewMode === 'day' && (
        <div className="space-y-4">
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-[#0A6C74]/20 border border-[#0A6C74]/40 flex items-center justify-center font-mono font-bold text-[#2dd4bf] text-lg">
                {currentDate.getDate()}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {currentDate.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h3>
                <p className="text-xs text-stone-400">
                  {departures.length} scheduled departures &bull; {pickups.length} scheduled hotel pickups
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => onSelectDepartureDate && onSelectDepartureDate(selectedDateStr)}
                className="px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold cursor-pointer"
              >
                Dispatch Pier Controls &rarr;
              </button>
            </div>
          </div>

          {/* Day Grid: Departures & Pickups Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Departures Column */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-stone-800 pb-2">
                <Ship className="w-3.5 h-3.5 text-[#2dd4bf]" />
                <span>Scheduled Departures ({departures.length})</span>
              </h4>

              {departures.length === 0 ? (
                <p className="text-xs text-stone-500 py-6 text-center">
                  No tour departures scheduled for this day.
                </p>
              ) : (
                <div className="space-y-2">
                  {departures.map((dep) => (
                    <div
                      key={dep.id}
                      className="p-3 bg-stone-900 rounded-lg border border-stone-800 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#2dd4bf]">
                          {dep.departureTime}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-800 text-stone-300 border border-stone-700">
                          {dep.status || dep.operationalStatus}
                        </span>
                      </div>
                      <div className="font-bold text-white text-sm">{dep.tourTitle}</div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-400">
                        <div>Vessel: <strong className="text-stone-200">{dep.vesselName || 'Unassigned'}</strong></div>
                        <div>Guide: <strong className="text-stone-200">{dep.guideName || 'Unassigned'}</strong></div>
                        <div>Booked: <strong className="text-white">{dep.passengerCount} pax</strong></div>
                        <div>Capacity: <strong className="text-stone-200">{dep.capacity || dep.vesselCapacity || 35} pax</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pickups Column */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-stone-800 pb-2">
                <Car className="w-3.5 h-3.5 text-amber-400" />
                <span>Hotel Pickup Runs ({pickups.length})</span>
              </h4>

              {pickups.length === 0 ? (
                <p className="text-xs text-stone-500 py-6 text-center">
                  No hotel pickups scheduled for this date.
                </p>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {pickups.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-stone-900 rounded-lg border border-stone-800 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-amber-300 font-mono font-bold">
                          <Clock className="w-3 h-3" />
                          <span>{p.pickupTime}</span>
                        </div>
                        <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-stone-800 text-stone-300 border border-stone-700">
                          {p.status}
                        </span>
                      </div>
                      <div className="font-bold text-white">{p.customerName} ({p.passengerCount} pax)</div>
                      <div className="text-[11px] text-stone-400 flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-stone-500 shrink-0" />
                        <span className="truncate">{p.hotelName} {p.roomNumber ? `(Room ${p.roomNumber})` : ''}</span>
                      </div>
                      <div className="text-[10px] text-stone-500">
                        Vehicle: {p.driverVehicle || 'Van #12'} &bull; Ref: {p.bookingReference}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
