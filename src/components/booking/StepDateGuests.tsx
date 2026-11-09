import React, { useMemo } from 'react';
import { Calendar, Users, MapPin, Clock, AlertCircle, CheckCircle2, ShieldAlert, Plus, Minus, ArrowRight } from 'lucide-react';
import { Tour, CurrencyConfig } from '../../types';
import { GuestCounts, Availability } from '../../types/booking';
import { getEarliestSelectableDate, getTourAvailability } from '../../services/availabilityService';
import { formatCurrencyAmount } from '../../services/pricingService';

interface StepDateGuestsProps {
  tour: Tour;
  date: string;
  onDateChange: (date: string) => void;
  guests: GuestCounts;
  onGuestsChange: (guests: GuestCounts) => void;
  currency: CurrencyConfig;
  onNext: () => void;
}

export const StepDateGuests: React.FC<StepDateGuestsProps> = ({
  tour,
  date,
  onDateChange,
  guests,
  onGuestsChange,
  currency,
  onNext,
}) => {
  const earliestDate = useMemo(() => getEarliestSelectableDate(24), []);

  // Set default date to earliestDate if none set
  React.useEffect(() => {
    if (!date) {
      onDateChange(earliestDate);
    }
  }, [date, earliestDate, onDateChange]);

  const availability: Availability = useMemo(() => {
    return getTourAvailability(tour, date || earliestDate);
  }, [tour, date, earliestDate]);

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

  const totalPartySize = guests.adults + guests.children + guests.infants;
  const exceedsCapacity = availability.isAvailable && totalPartySize > availability.remaining;
  const isFormValid = date && availability.isAvailable && !availability.isSoldOut && !exceedsCapacity;

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
            {formatCurrencyAmount(tour.priceEur, currency)}
            <span className="text-xs text-stone-500 font-normal"> / adult</span>
          </span>
        </div>
      </div>

      {/* Date Selection Box */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="booking-date" className="font-bold text-stone-900 text-sm flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-[#0A6C74]" />
            1. Choose your date
          </label>
          <span className="text-[11px] text-stone-500">
            Book at least 24 hours in advance
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

          {/* Availability Status Notification */}
          <div className="pt-1">
            {availability.isSoldOut ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                <div>
                  <span className="font-bold block">Sold Out for this date</span>
                  <span>All passenger seats are fully booked. Please select another date.</span>
                </div>
              </div>
            ) : exceedsCapacity ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold block">Party size exceeds available capacity</span>
                  <span>
                    You have selected {totalPartySize} guests, but only {availability.remaining} spots remain on this departure. Please reduce group size or choose another date.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-950 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong className="font-semibold text-emerald-950">
                      {availability.remaining} spots available
                    </strong> for selected date
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded font-mono">
                  Live Availability
                </span>
              </div>
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
                {formatCurrencyAmount(tour.priceEur, currency)}
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
                  tour.childPriceEur || Math.round(tour.priceEur * 0.5),
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
          * Minimum 1 adult required. Flotation vests for children and infants are certified and stocked on all vessels.
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
