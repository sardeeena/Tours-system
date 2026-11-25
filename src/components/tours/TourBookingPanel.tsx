import React, { useState } from 'react';
import { Calendar, Users, MapPin, CheckCircle2, ArrowRight, Plus, Minus, Info } from 'lucide-react';
import { Tour, CurrencyConfig } from '../../types';
import { formatPrice } from '../../data/toursData';
import { getTourAdultRateEur, getTourChildRateEur } from '../../services/pricingService';

const formatQuickPickWeekday = (value: Date) => value.toLocaleDateString(undefined, { weekday: 'short' });
const formatQuickPickMonth = (value: Date) => value.toLocaleDateString(undefined, { month: 'short' });

interface TourBookingPanelProps {
  tour: Tour;
  currency: CurrencyConfig;
  onBook: (bookingState: {
    tour: Tour;
    date: string;
    adults: number;
    children: number;
    pickupLocation: string;
    selectedExtras: string[];
    totalEur: number;
  }) => void;
}

export const TourBookingPanel: React.FC<TourBookingPanelProps> = ({
  tour,
  currency,
  onBook,
}) => {
  const today = new Date();
  const tomorrowDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 12);
  const tomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(tomorrow);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [pickupLocation, setPickupLocation] = useState('');
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  const handleToggleExtra = (extraId: string) => {
    setSelectedExtras((prev) =>
      prev.includes(extraId) ? prev.filter((id) => id !== extraId) : [...prev, extraId]
    );
  };

  const adultRate = getTourAdultRateEur(tour);
  const childRate = getTourChildRateEur(tour);
  const adultSubtotal = adults * adultRate;
  const childSubtotal = children * childRate;
  
  const extrasSubtotal = (tour.optionalExtras || []).reduce((acc, extra) => {
    return selectedExtras.includes(extra.id) ? acc + extra.priceEur : acc;
  }, 0);

  const totalEur = adultSubtotal + childSubtotal + extrasSubtotal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onBook({
      tour,
      date,
      adults,
      children,
      pickupLocation,
      selectedExtras,
      totalEur,
    });
  };

  return (
    <div id="booking-panel" className="bg-white border border-[#E8E3DA] rounded-2xl p-4 sm:p-5 shadow-md min-w-0">
      {/* Price Header */}
      <div className="pb-4 border-b border-stone-200">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-600 block">From</span>
            <div className="flex items-baseline space-x-1">
              <span className="font-display text-2xl sm:text-3xl font-bold text-[#0E1B2A]">
                {formatPrice(adultRate, currency)}
              </span>
              <span className="text-xs text-stone-600 font-medium">/ person</span>
            </div>
          </div>
          {tour.tourType !== 'Private' && tour.childPriceEur && (
            <span className="text-[11px] text-stone-500">
              Child: {formatPrice(tour.childPriceEur, currency)}
            </span>
          )}
        </div>
      </div>

      {/* Booking Form */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
        
        {/* Date selector with quick-pick day tiles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2"><div><span className="aa-step-kicker">Choose your day</span><label htmlFor="tour-panel-date" className="mt-1 block font-bold text-stone-900">When would you like to go?</label></div><Calendar className="h-5 w-5 text-[#0A6C74]" /></div>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {Array.from({ length: 5 }, (_, index) => { const [year, month, day] = date.split('-').map(Number); const tile = new Date(year, month - 1, day + index, 12); const value = `${tile.getFullYear()}-${String(tile.getMonth() + 1).padStart(2, '0')}-${String(tile.getDate()).padStart(2, '0')}`; const selected = value === date; return <button key={value} type="button" aria-pressed={selected} onClick={() => setDate(value)} className={`aa-date-tile ${selected ? 'is-selected' : ''}`}><span className="text-[9px] sm:text-[10px] font-semibold uppercase">{formatQuickPickWeekday(tile)}</span><span className="font-display text-lg sm:text-xl font-bold leading-none">{tile.getDate()}</span><span className="text-[9px] sm:text-[10px]">{formatQuickPickMonth(tile)}</span></button>; })}
          </div>
          <label htmlFor="tour-panel-date" className="block text-[11px] font-semibold text-[#0A6C74]">Need a different date?
            <input id="tour-panel-date" type="date" required min={(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })()} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-800" />
          </label>
        </div>

        {/* Guests Steppers */}
        <div className="grid grid-cols-2 gap-3">
          {/* Adults */}
          <div className="aa-guest-card">
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-bold text-stone-900">Adults</span>
              <span className="text-[10px] text-stone-600">Age 12+</span>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                disabled={adults <= 1}
                onClick={() => setAdults(Math.max(1, adults - 1))}
                className="aa-stepper-button w-9 h-9 rounded-full bg-white border border-stone-300 flex items-center justify-center text-stone-700 disabled:opacity-30 hover:bg-stone-100"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold text-stone-900 text-sm">{adults}</span>
              <button
                type="button"
                onClick={() => setAdults(adults + 1)}
                className="aa-stepper-button w-7 h-7 rounded-full bg-white border border-stone-300 flex items-center justify-center text-stone-700 hover:bg-stone-100"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Children */}
          <div className="aa-guest-card">
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-bold text-stone-900">Children</span>
              <span className="text-[10px] text-stone-600">Age 2-11</span>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                disabled={children <= 0}
                onClick={() => setChildren(Math.max(0, children - 1))}
                className="aa-stepper-button w-7 h-7 rounded-full bg-white border border-stone-300 flex items-center justify-center text-stone-700 disabled:opacity-30 hover:bg-stone-100"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-bold text-stone-900 text-sm">{children}</span>
              <button
                type="button"
                onClick={() => setChildren(children + 1)}
                className="aa-stepper-button w-7 h-7 rounded-full bg-white border border-stone-300 flex items-center justify-center text-stone-700 hover:bg-stone-100"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Pickup Location */}
        <div>
          <label className="block font-bold text-stone-900 mb-1.5 flex items-center">
            <MapPin className="w-3.5 h-3.5 mr-1.5 text-[#0A6C74]" />
            Hotel Pickup Location
          </label>
          <input
            type="text"
            required
            value={pickupLocation}
            onChange={(e) => setPickupLocation(e.target.value)}
            placeholder="e.g. Sunrise Crystal Bay, Hurghada"
            className="w-full px-3 py-2 border border-stone-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#0A6C74] bg-stone-50/50"
          />
          <span className="text-[10px] text-stone-600 mt-1 block">
            Pickup time will be confirmed on your voucher.
          </span>
        </div>

        {/* Optional Extras */}
        {tour.optionalExtras && tour.optionalExtras.length > 0 && (
          <div className="pt-2 border-t border-stone-200">
            <span className="block font-bold text-stone-900 mb-2">
              Optional Extras
            </span>
            <div className="space-y-2">
              {tour.optionalExtras.map((extra) => {
                const checked = selectedExtras.includes(extra.id);
                return (
                  <label
                    key={extra.id}
                    className={`flex items-start justify-between p-2 rounded border cursor-pointer transition-colors ${
                      checked
                        ? 'border-[#0A6C74] bg-[#E8F3F4]/60'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleExtra(extra.id)}
                        className="rounded border-stone-300 text-[#0A6C74] focus:ring-[#0A6C74] mt-0.5"
                      />
                      <div>
                        <span className="font-semibold text-stone-800 block text-xs">
                          {extra.name}
                        </span>
                        {extra.description && (
                          <span className="text-[10px] text-stone-600 block">
                            {extra.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-[#0A6C74] text-xs shrink-0 ml-2">
                      +{formatPrice(extra.priceEur, currency)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Price Breakdown */}
        <div className="p-3.5 bg-[#FAF8F5] border border-[#E8E3DA] rounded space-y-1.5 text-xs">
          <div className="flex justify-between text-stone-600">
            <span>{adults} Adult(s) × {formatPrice(adultRate, currency)}:</span>
            <span className="font-semibold">{formatPrice(adultSubtotal, currency)}</span>
          </div>

          {children > 0 && (
            <div className="flex justify-between text-stone-600">
              <span>{children} Child(ren):</span>
              <span className="font-semibold">{formatPrice(childSubtotal, currency)}</span>
            </div>
          )}

          {extrasSubtotal > 0 && (
            <div className="flex justify-between text-stone-600">
              <span>Optional Extras:</span>
              <span className="font-semibold">{formatPrice(extrasSubtotal, currency)}</span>
            </div>
          )}

          <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline">
            <span className="font-bold text-stone-900 text-sm">Total:</span>
            <span className="font-bold text-xl text-[#0A6C74]">
              {formatPrice(totalEur, currency)}
            </span>
          </div>
        </div>

        {/* Cancellation terms notice */}
        <div className="flex items-center text-[11px] text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
          <Info className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
          <span>{tour.cancellationPolicy || 'Cancellation terms are shown on your booking voucher.'}</span>
        </div>

        {/* Large CTA button */}
        <button
          type="submit"
          className="aa-primary-action w-full min-h-12 py-3 bg-[#0A6C74] hover:bg-[#08565C] text-white text-sm font-semibold rounded-full transition-all shadow flex items-center justify-center space-x-2"
        >
          <span>Book This Excursion</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[10px] text-center text-stone-600">
          No prepayment required for standard bookings. Pay on hotel pickup.
        </p>
      </form>
    </div>
  );
};
