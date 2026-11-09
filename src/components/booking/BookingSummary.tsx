import React from 'react';
import { MapPin, Clock, Calendar, Users, ShieldCheck, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Tour, CurrencyConfig } from '../../types';
import { GuestCounts, PickupLocation, BookingExtra, BookingPricing } from '../../types/booking';

interface BookingSummaryProps {
  tour: Tour;
  date?: string;
  guests: GuestCounts;
  pickupLocation?: PickupLocation | null;
  hotelName?: string;
  selectedExtras?: BookingExtra[];
  pricing: BookingPricing;
  currency: CurrencyConfig;
  showGuarantee?: boolean;
  collapsibleMobile?: boolean;
  isMobileExpanded?: boolean;
  onToggleMobileExpand?: () => void;
}

export const BookingSummary: React.FC<BookingSummaryProps> = ({
  tour,
  date,
  guests,
  pickupLocation,
  hotelName,
  selectedExtras = [],
  pricing,
  currency,
  showGuarantee = true,
  collapsibleMobile = false,
  isMobileExpanded = false,
  onToggleMobileExpand,
}) => {
  const totalGuests = (guests.adults || 1) + (guests.children || 0) + (guests.infants || 0);

  return (
    <aside className="bg-white border border-[#E8E3DA] rounded-sm shadow-xs overflow-hidden text-xs">
      
      {/* Header with Tour info */}
      <div className="p-4 bg-[#FAF8F5] border-b border-[#E8E3DA]">
        <div className="flex space-x-3">
          <img
            src={tour.primaryImage}
            alt={tour.title}
            className="w-20 h-16 object-cover rounded-xs shrink-0 border border-stone-200"
          />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A6C74] block">
              {tour.category}
            </span>
            <h3 className="font-display font-bold text-stone-900 text-xs sm:text-sm line-clamp-2 leading-tight">
              {tour.title}
            </h3>
            <div className="flex items-center space-x-2 text-[11px] text-stone-600 mt-1">
              <span className="flex items-center">
                <MapPin className="w-3 h-3 text-[#0A6C74] mr-0.5" />
                {tour.destination}
              </span>
              <span>•</span>
              <span className="flex items-center">
                <Clock className="w-3 h-3 text-stone-400 mr-0.5" />
                {tour.durationLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile quick expand bar */}
        {collapsibleMobile && (
          <button
            type="button"
            onClick={onToggleMobileExpand}
            className="w-full mt-3 pt-2 border-t border-stone-200 flex items-center justify-between text-[#0A6C74] font-semibold text-xs lg:hidden"
          >
            <span>{isMobileExpanded ? 'Hide booking breakdown' : 'View booking breakdown'}</span>
            {isMobileExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Breakdown Details (Always shown on desktop; toggleable on mobile if requested) */}
      <div className={`p-4 space-y-3.5 ${collapsibleMobile && !isMobileExpanded ? 'hidden lg:block' : 'block'}`}>
        
        {/* Date & Guests quick badge */}
        <div className="bg-stone-50 border border-stone-200/80 rounded p-2.5 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-stone-700">
            <span className="flex items-center text-stone-600 font-medium">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-[#0A6C74]" />
              Date:
            </span>
            <span className="font-semibold text-stone-900">
              {date ? date : 'Select a date in Step 1'}
            </span>
          </div>

          <div className="flex items-center justify-between text-stone-700">
            <span className="flex items-center text-stone-600 font-medium">
              <Users className="w-3.5 h-3.5 mr-1.5 text-[#0A6C74]" />
              Travelers:
            </span>
            <span className="font-semibold text-stone-900">
              {guests.adults} {guests.adults === 1 ? 'Adult' : 'Adults'}
              {guests.children > 0 && `, ${guests.children} ${guests.children === 1 ? 'Child' : 'Children'}`}
              {guests.infants > 0 && `, ${guests.infants} ${guests.infants === 1 ? 'Infant' : 'Infants'}`}
            </span>
          </div>

          {pickupLocation && (
            <div className="flex items-center justify-between text-stone-700 pt-1 border-t border-stone-200/60">
              <span className="flex items-center text-stone-600 font-medium truncate pr-2">
                <MapPin className="w-3.5 h-3.5 mr-1.5 text-[#0A6C74] shrink-0" />
                Pickup:
              </span>
              <span className="font-semibold text-stone-900 truncate text-right">
                {pickupLocation.name}
              </span>
            </div>
          )}
        </div>

        {/* Itemized Price Calculation */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between text-stone-600">
            <span>
              {guests.adults} Adult(s) × €{pricing.basePricePerAdultEur}:
            </span>
            <span className="font-semibold text-stone-800">
              €{pricing.adultSubtotalEur.toFixed(2)}
            </span>
          </div>

          {guests.children > 0 && (
            <div className="flex justify-between text-stone-600">
              <span>
                {guests.children} Child(ren) × €{pricing.basePricePerChildEur}:
              </span>
              <span className="font-semibold text-stone-800">
                €{pricing.childSubtotalEur.toFixed(2)}
              </span>
            </div>
          )}

          {guests.infants > 0 && (
            <div className="flex justify-between text-stone-500">
              <span>{guests.infants} Infant(s):</span>
              <span className="text-emerald-700 font-semibold">Free</span>
            </div>
          )}

          {/* Pickup Area Fee */}
          {pickupLocation && (
            <div className="flex justify-between text-stone-600">
              <span className="truncate pr-2">
                Pickup ({pickupLocation.name}):
              </span>
              <span className="font-semibold text-stone-800 shrink-0">
                {pricing.pickupSubtotalEur === 0 ? (
                  <span className="text-emerald-700">Free</span>
                ) : (
                  `€${pricing.pickupSubtotalEur.toFixed(2)}`
                )}
              </span>
            </div>
          )}

          {/* Extras list */}
          {pricing.extrasBreakdown.length > 0 && (
            <div className="pt-2 border-t border-dashed border-stone-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">
                Selected Extras
              </span>
              {pricing.extrasBreakdown.map((ex) => (
                <div key={ex.extraId} className="flex justify-between text-stone-600 pl-1">
                  <span className="truncate pr-2">• {ex.name}:</span>
                  <span className="font-semibold text-stone-800 shrink-0">
                    €{ex.amountEur.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {pricing.discountEur > 0 && (
            <div className="flex justify-between text-emerald-700 pt-1">
              <span>Promo Discount:</span>
              <span className="font-semibold">-€{pricing.discountEur.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Grand Total Bar */}
        <div className="pt-3 border-t border-stone-200">
          <div className="flex justify-between items-baseline">
            <div>
              <span className="text-stone-900 font-bold text-sm block">Total:</span>
              <span className="text-[10px] text-stone-400">All taxes and park fees included</span>
            </div>
            <div className="text-right">
              <span className="font-display font-bold text-2xl text-[#0A6C74]">
                {pricing.formattedTotal}
              </span>
              {currency.code !== 'EUR' && (
                <span className="block text-[10px] text-stone-400">
                  (approx. €{pricing.totalEur.toFixed(2)})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Free Cancellation Guarantee badge */}
        {showGuarantee && (
          <div className="p-2.5 bg-emerald-50 rounded border border-emerald-200/80 text-[11px] text-emerald-900 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Free 24h Cancellation</span>
              <span className="text-emerald-800">
                Cancel up to 24 hours before pickup for a full refund.
              </span>
            </div>
          </div>
        )}

      </div>
    </aside>
  );
};
