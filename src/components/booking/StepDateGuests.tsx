import React, { useMemo } from 'react';
import { Calendar, Users, MapPin, Clock, AlertCircle, CheckCircle2, Plus, Minus, ArrowRight } from 'lucide-react';
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

      {/* Date Selection Box */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="booking-date" className="font-bold text-stone-900 text-sm flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-[#0A6C74]" />
            1. Choose your date
          </label>
          <span className="text-[11px] text-stone-500">
            Book at least {minimumNoticeHours} hours in advance
          </span>
        </div>

        <div className="space-y-2">
          <input
            id="booking-date"
            type="date"
            required
            min={earliestDate}
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6C74] bg-stone-50/50"
          />

          {/* Independently bookable departure times */}
          <div className="pt-2 space-y-2">
            <span className="font-bold text-stone-900 text-sm block">Departure time</span>
            {availabilityLoading ? (
              <div className="p-3 bg-stone-50 border border-stone-200 rounded text-xs text-stone-600">
                Checking departure times…
              </div>
            ) : availabilityError ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                We couldn't check departure times. Please try again in a moment.
              </div>
            ) : departureSlots.length === 0 ? (
              <div className="p-3 bg-stone-50 border border-stone-200 rounded text-xs text-stone-700">
                This departure is currently closed. Please choose another date.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {departureSlots.map((slot) => {
                    const selected = slot.departureId === selectedDepartureId;
                    return (
                      <button
                        key={slot.departureId}
                        type="button"
                        disabled={!slot.isAvailable}
                        aria-pressed={selected}
                        onClick={() => onDepartureChange(slot.departureId, slot.startTime)}
                        className={`rounded-lg border-2 px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6C74] focus-visible:ring-offset-2 ${
                          selected
                            ? 'border-[#0A6C74] bg-[#E8F3F4] text-[#07565C] shadow-sm'
                            : slot.isAvailable
                              ? 'border-stone-300 bg-white text-stone-800 hover:border-[#0A6C74] hover:bg-[#F5FAFA]'
                              : 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed'
                        }`}
                      >
                        <span className="font-semibold text-sm block">{slot.startTime}</span>
                        <span className="text-[10px] block">
                          {slot.isAvailable ? (slot.remainingCapacity <= 10 ? 'Limited availability' : 'Available') : 'Sold Out'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedDeparture?.isAvailable && exceedsCapacity ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold block">Party size exceeds available capacity</span>
                      <span>
                        This departure cannot accommodate your selected group size. Please reduce the number of guests or choose another departure.
                      </span>
                    </div>
                  </div>
                ) : selectedDeparture?.isAvailable ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-950 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong className="font-semibold text-emerald-950">
                          {selectedDeparture.remainingCapacity <= 10 ? 'Limited availability' : 'Departure available'}
                        </strong> for selected departure
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded text-xs text-stone-700">
                    This departure is currently closed. Please choose another date.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Guest Steppers */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-bold text-stone-900 text-sm flex items-center">
            <Users className="w-4 h-4 mr-2 text-[#0A6C74]" />
            2. How many people?
          </span>
          <span className="text-[11px] text-stone-500">
            Ages on date of tour
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          
          {/* Adults */}
          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-bold text-stone-900 block text-xs">Adults</span>
                <span className="text-[11px] text-stone-500">Age 12+</span>
              </div>
              <span className="font-semibold text-xs text-[#0A6C74]">
                {formatCurrencyAmount(adultRate, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={guests.adults <= 1}
                onClick={() => handleAdultsChange(-1)}
                className="w-8 h-8 rounded bg-white border border-stone-300 flex items-center justify-center text-stone-700 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-white transition-colors"
                aria-label="Decrease adults"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-display font-bold text-stone-900 text-base">
                {guests.adults}
              </span>
              <button
                type="button"
                onClick={() => handleAdultsChange(1)}
                className="w-8 h-8 rounded bg-white border border-stone-300 flex items-center justify-center text-stone-700 hover:bg-stone-100 transition-colors"
                aria-label="Increase adults"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Children */}
          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-bold text-stone-900 block text-xs">Children</span>
                <span className="text-[11px] text-stone-500">Age 2–11</span>
              </div>
              <span className="font-semibold text-xs text-[#0A6C74]">
                {formatCurrencyAmount(
                  childRate,
                  currency
                )}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={guests.children <= 0}
                onClick={() => handleChildrenChange(-1)}
                className="w-8 h-8 rounded bg-white border border-stone-300 flex items-center justify-center text-stone-700 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-white transition-colors"
                aria-label="Decrease children"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-display font-bold text-stone-900 text-base">
                {guests.children}
              </span>
              <button
                type="button"
                onClick={() => handleChildrenChange(1)}
                className="w-8 h-8 rounded bg-white border border-stone-300 flex items-center justify-center text-stone-700 hover:bg-stone-100 transition-colors"
                aria-label="Increase children"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Infants */}
          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-bold text-stone-900 block text-xs">Infants</span>
                <span className="text-[11px] text-stone-500">Under 2 yrs</span>
              </div>
              <span className="font-bold text-xs text-emerald-700">Free</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={guests.infants <= 0}
                onClick={() => handleInfantsChange(-1)}
                className="w-8 h-8 rounded bg-white border border-stone-300 flex items-center justify-center text-stone-700 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-white transition-colors"
                aria-label="Decrease infants"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-display font-bold text-stone-900 text-base">
                {guests.infants}
              </span>
              <button
                type="button"
                onClick={() => handleInfantsChange(1)}
                className="w-8 h-8 rounded bg-white border border-stone-300 flex items-center justify-center text-stone-700 hover:bg-stone-100 transition-colors"
                aria-label="Increase infants"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        <p className="text-[11px] text-stone-500">
          * Minimum 1 adult required.
        </p>
      </div>

      {/* CTA Button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={!isFormValid}
          onClick={onNext}
          className="w-full sm:w-auto px-7 py-3 bg-[#0A6C74] hover:bg-[#08565C] disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-sm transition-colors shadow-xs flex items-center justify-center space-x-2"
        >
          <span>Choose Pickup</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
