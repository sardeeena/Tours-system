import React, { useMemo } from 'react';
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Users, MapPin, Clock, AlertCircle, CheckCircle2, Plus, Minus, ArrowRight } from 'lucide-react';
import { Tour, CurrencyConfig } from '../../types';
import { GuestCounts, DepartureSlot } from '../../types/booking';
import { getEarliestSelectableDate, getTourDepartureSlotsFromServer } from '../../services/availabilityService';
import { formatCurrencyAmount, getTourAdultRateEur, getTourChildRateEur } from '../../services/pricingService';
import { useToast } from '../../contexts/ToastContext';

interface StepDateGuestsProps {
  tour: Tour;
  date: string;
  onDateChange: (date: string) => void;
  selectedDepartureId: string;
  onDepartureChange: (departureId: string, departureTime: string) => void;
  tourLanguage: string;
  onTourLanguageChange: (language: string) => void;
  guests: GuestCounts;
  onGuestsChange: (guests: GuestCounts) => void;
  currency: CurrencyConfig;
  onNext: () => void;
}


const parseBookingDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

const formatBookingDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addBookingDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

export const StepDateGuests: React.FC<StepDateGuestsProps> = ({
  tour,
  date,
  onDateChange,
  selectedDepartureId,
  onDepartureChange,
  tourLanguage,
  onTourLanguageChange,
  guests,
  onGuestsChange,
  currency,
  onNext,
}) => {
  const configuredNoticeHours = Number(tour.minimumBookingNoticeHours);
  const minimumNoticeHours = Number.isFinite(configuredNoticeHours) ? Math.max(0, configuredNoticeHours) : 12;
  const earliestDate = useMemo(() => getEarliestSelectableDate(minimumNoticeHours), [minimumNoticeHours]);
  const { showToast } = useToast();

  // Set default date to earliestDate if none set
  React.useEffect(() => {
    if (!date) {
      onDateChange(earliestDate);
    }
  }, [date, earliestDate, onDateChange]);

  const [calendarWeek, setCalendarWeek] = React.useState(0);
  const calendarStart = addBookingDays(parseBookingDate(earliestDate), calendarWeek * 7);
  const dateTiles = Array.from({ length: 7 }, (_, index) => addBookingDays(calendarStart, index));
  const selectedDateValue = date ? parseBookingDate(date) : null;
  const selectedDateWeek = selectedDateValue
    ? Math.max(0, Math.floor((selectedDateValue.getTime() - parseBookingDate(earliestDate).getTime()) / (7 * 86400000)))
    : 0;

  React.useEffect(() => {
    if (selectedDateValue && selectedDateWeek !== calendarWeek) setCalendarWeek(selectedDateWeek);
  }, [date, earliestDate]);

  const [departureSlots, setDepartureSlots] = React.useState<DepartureSlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = React.useState(true);
  const [availabilityError, setAvailabilityError] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const selectedDate = date || earliestDate;

    setAvailabilityLoading(true);
    setAvailabilityError(false);

    getTourDepartureSlotsFromServer(tour, selectedDate)
      .then((result) => {
        if (!active) return;
        setDepartureSlots(result);
        const current = result.find((slot) => slot.departureId === selectedDepartureId && slot.isAvailable);
        onDepartureChange(current?.departureId || '', current?.startTime || '');
      })
      .catch((error) => {
        console.warn('Could not load confirmed departure slots:', error);
        if (active) {
          showToast('We could not verify availability for this date. Please try again before continuing.', 'error');
          setDepartureSlots([]);
          onDepartureChange('', '');
          setAvailabilityError(true);
        }
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tour, date, earliestDate, selectedDepartureId, onDepartureChange, showToast]);

  const selectedDeparture = departureSlots.find((slot) => slot.departureId === selectedDepartureId) || null;

  const handleAdultsChange = (delta: number) => {
    const next = Math.max(1, guests.adults + delta);
    onGuestsChange({ ...guests, adults: next });
  };

  const handleChildrenChange = (delta: number) => {
    const next = Math.max(0, guests.children + delta);
    onGuestsChange({ ...guests, children: next });
  };

  const handleInfantsChange = (delta: number) => {
    const next = Math.max(0, guests.infants + delta);
    onGuestsChange({ ...guests, infants: next });
  };

  const languageOptions = Array.from(new Set((tour.languages || []).map((language) => language.trim()).filter(Boolean)));
  const availableLanguages = languageOptions.length > 0 ? languageOptions : ['English'];

  const totalPartySize = guests.adults + guests.children + guests.infants;
  const exceedsCapacity = Boolean(selectedDeparture?.isAvailable && totalPartySize > selectedDeparture.remainingCapacity);
  const isFormValid = Boolean(
    date &&
    !availabilityLoading &&
    !availabilityError &&
    selectedDeparture?.isAvailable &&
    !exceedsCapacity
  );
  const adultRate = getTourAdultRateEur(tour);
  const childRate = getTourChildRateEur(tour);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Selected Tour Header Preview */}
      <div className="p-4 bg-white border border-[#E8E3DA] rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <img
            src={tour.primaryImage}
            alt={tour.title}
            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xs border border-stone-200"
          />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A6C74] block">
              Selected Tour
            </span>
            <h2 className="font-display text-base sm:text-lg font-bold text-[#0E1B2A] leading-tight">
              {tour.title}
            </h2>
            <div className="flex items-center space-x-3 text-xs text-stone-500 mt-1">
              <span className="flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1 text-[#0A6C74]" />
                {tour.destination}
              </span>
              <span>•</span>
              <span className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-stone-400" />
                {tour.durationLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto flex sm:flex-col justify-between sm:justify-center items-baseline sm:items-end">
          <span className="text-[10px] uppercase font-bold text-stone-400 block">Starting from</span>
          <span className="font-display text-xl font-bold text-[#0A6C74]">
            {formatCurrencyAmount(adultRate, currency)}
            <span className="text-xs text-stone-500 font-normal"> / adult</span>
          </span>
        </div>
      </div>

      {/* Tour Language Selection */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-5 space-y-3">
        <label htmlFor="booking-tour-language" className="font-bold text-stone-900 text-sm block">
          Tour language <span className="text-red-500">*</span>
        </label>
        {availableLanguages.length > 1 ? (
          <select
            id="booking-tour-language"
            required
            value={tourLanguage}
            onChange={(e) => onTourLanguageChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6C74] bg-stone-50/50"
          >
            {availableLanguages.map((language) => <option key={language} value={language}>{language}</option>)}
          </select>
        ) : (
          <div className="w-full px-3.5 py-2.5 rounded border border-stone-200 text-sm bg-stone-50 text-stone-800">{availableLanguages[0]}</div>
        )}
        <p className="text-[11px] text-stone-500">Choose the language for your tour guide. Your selection will appear on your booking voucher.</p>
      </div>

      {/* Date selection — compact, bookable calendar strip */}
      <section className="aa-booking-section rounded-2xl border border-stone-200 bg-white p-4 sm:p-6 space-y-5" aria-labelledby="booking-date-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="aa-step-kicker">Step 1 · When are you going?</span>
            <h3 id="booking-date-heading" className="mt-1 font-display text-lg sm:text-xl font-bold text-[#0E1B2A]">Choose your date</h3>
            <p className="mt-1 text-xs sm:text-sm text-stone-500">Pick a day to see its available departure times.</p>
          </div>
          <span className="rounded-full bg-[#F2F7F6] px-3 py-1.5 text-[11px] font-semibold text-[#0A6C74]">Book {minimumNoticeHours}+ hours ahead</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-stone-800">{calendarStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous week" disabled={calendarWeek === 0} onClick={() => setCalendarWeek((week) => Math.max(0, week - 1))} className="aa-calendar-nav" ><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Next week" onClick={() => setCalendarWeek((week) => week + 1)} className="aa-calendar-nav"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2" role="group" aria-label="Choose a booking date">
          {dateTiles.map((tile) => {
            const tileValue = formatBookingDate(tile);
            const selected = date === tileValue;
            return (
              <button key={tileValue} type="button" aria-pressed={selected} onClick={() => onDateChange(tileValue)} className={`aa-date-tile ${selected ? 'is-selected' : ''}`}>
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide">{tile.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <span className="font-display text-xl sm:text-2xl font-bold leading-none">{tile.getDate()}</span>
                <span className="text-[10px]">{tile.toLocaleDateString(undefined, { month: 'short' })}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-stone-50 px-3.5 py-3">
          <div className="flex items-center gap-2 text-xs text-stone-600"><CalendarDays className="h-4 w-4 text-[#0A6C74]" /><span>{date ? parseBookingDate(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Select a date'}</span></div>
          <label htmlFor="booking-date" className="flex items-center gap-2 text-xs font-semibold text-[#0A6C74] cursor-pointer">Choose another date
            <input id="booking-date" type="date" required min={earliestDate} value={date} onChange={(e) => onDateChange(e.target.value)} className="aa-date-input" />
          </label>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><span className="aa-step-kicker">Step 2 · Choose a time</span><h4 className="mt-1 font-semibold text-stone-900">Departure time</h4></div>
            {selectedDeparture?.isAvailable && <span className="text-[11px] text-emerald-700 font-semibold">Time selected</span>}
          </div>
          {availabilityLoading ? (
            <div role="status" className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">Checking available departures…</div>
          ) : availabilityError ? (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">We couldn't check departure times. Please try again in a moment.</div>
          ) : departureSlots.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">No departures are scheduled for this date. Please choose another date.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {departureSlots.map((slot) => {
                  const selected = slot.departureId === selectedDepartureId;
                  return (
                    <button key={slot.departureId} type="button" disabled={!slot.isAvailable} aria-pressed={selected} onClick={() => onDepartureChange(slot.departureId, slot.startTime)} className={`aa-departure-card ${selected ? 'is-selected' : ''} ${!slot.isAvailable ? 'is-sold-out' : ''}`}>
                      <span className="flex items-center justify-between gap-2"><span className="text-lg font-bold">{slot.startTime}</span>{selected && <CheckCircle2 className="h-5 w-5" />}</span>
                      <span className="mt-2 flex items-center justify-between gap-2 text-[11px]"><span>{slot.isAvailable ? (slot.remainingCapacity <= 10 ? 'Limited places' : 'Available') : 'Sold out'}</span>{slot.isAvailable && <span>{slot.remainingCapacity} places left</span>}</span>
                    </button>
                  );
                })}
              </div>
              {selectedDeparture?.isAvailable && exceedsCapacity ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 flex items-start gap-2"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span><strong className="block">Not enough places for this group</strong>Reduce the number of guests or choose another departure.</span></div>
              ) : selectedDeparture?.isAvailable ? (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-xs font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{selectedDeparture.remainingCapacity <= 10 ? 'Limited availability' : 'This departure is available'} for your group</div>
              ) : (
                <p className="text-xs text-stone-500">{departureSlots.some((slot) => slot.isAvailable) ? 'Choose a departure time to continue.' : 'All departure times are sold out for this date.'}</p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Guest selection */}
      <section className="aa-booking-section rounded-2xl border border-stone-200 bg-white p-4 sm:p-6 space-y-5" aria-labelledby="booking-guests-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><span className="aa-step-kicker">Step 4 · Who's coming?</span><h3 id="booking-guests-heading" className="mt-1 font-display text-lg font-bold text-[#0E1B2A]">Your group</h3></div>
          <span className="text-xs text-stone-500">Ages on the day of the tour</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { key: 'adults', label: 'Adults', age: '12 years and over', count: guests.adults, rate: formatCurrencyAmount(adultRate, currency), change: handleAdultsChange, min: 1 },
            { key: 'children', label: 'Children', age: '2–11 years', count: guests.children, rate: formatCurrencyAmount(childRate, currency), change: handleChildrenChange, min: 0 },
            { key: 'infants', label: 'Infants', age: 'Under 2 years', count: guests.infants, rate: 'Free', change: handleInfantsChange, min: 0 },
          ] as const).map((guest) => (
            <div key={guest.key} className="aa-guest-card">
              <div className="flex items-start justify-between gap-2"><div><span className="block font-bold text-stone-900">{guest.label}</span><span className="mt-1 block text-[11px] text-stone-500">{guest.age}</span></div><span className="rounded-full bg-[#F0F7F6] px-2.5 py-1 text-[11px] font-semibold text-[#0A6C74]">{guest.rate}</span></div>
              <div className="mt-5 flex items-center justify-between">
                <button type="button" disabled={guest.count <= guest.min} onClick={() => guest.change(-1)} aria-label={`Remove one ${guest.label.toLowerCase()}`} className="aa-stepper-button"><Minus className="h-4 w-4" /></button>
                <span className="font-display text-2xl font-bold tabular-nums text-[#0E1B2A]" aria-live="polite">{guest.count}</span>
                <button type="button" onClick={() => guest.change(1)} aria-label={`Add one ${guest.label.toLowerCase()}`} className="aa-stepper-button"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-500">At least one adult is required for every booking.</p>
      </section>

      {/* CTA Button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={!isFormValid}
          onClick={onNext}
          className="aa-primary-action w-full sm:w-auto px-7 py-3 bg-[#0A6C74] hover:bg-[#08565C] disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full transition-colors shadow-xs flex items-center justify-center space-x-2"
        >
          <span>Choose Pickup</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
