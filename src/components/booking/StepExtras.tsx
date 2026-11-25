import React from 'react';
import { Sparkles, Check, ArrowRight, ArrowLeft, Plus, Minus, Info } from 'lucide-react';
import { BookingExtra } from '../../types/booking';
import { CurrencyConfig } from '../../types';
import { GLOBAL_BOOKING_EXTRAS } from '../../data/bookingData';
import { formatCurrencyAmount } from '../../services/pricingService';

interface StepExtrasProps {
  selectedExtraIds: string[];
  onToggleExtra: (extraId: string) => void;
  currency: CurrencyConfig;
  onNext: () => void;
  onBack: () => void;
  extras?: BookingExtra[];
  extraQuantities?: Record<string, number>;
  onUpdateQuantity?: (extraId: string, quantity: number) => void;
}

export const StepExtras: React.FC<StepExtrasProps> = ({
  selectedExtraIds,
  onToggleExtra,
  currency,
  onNext,
  onBack,
  extras,
  extraQuantities = {},
  onUpdateQuantity,
}) => {
  // Authoritative: Never fall back to global extras if tour-assigned extras list was passed (even if empty)
  const extrasList = extras !== undefined ? extras : GLOBAL_BOOKING_EXTRAS;

  const getPricingBadgeLabel = (type: string) => {
    switch (type) {
      case 'per_person':
        return 'Per Guest';
      case 'per_adult':
        return 'Per Adult';
      case 'per_child':
        return 'Per Child';
      case 'per_vehicle':
        return 'Per Vehicle';
      case 'per_item':
        return 'Per Item';
      case 'per_booking':
      default:
        return 'Flat Per Booking';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <section className="aa-booking-section rounded-2xl border border-stone-200 bg-white p-4 sm:p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#0E1B2A] flex items-center">
            <Sparkles className="w-4 h-4 mr-2 text-[#0A6C74]" />
            Optional Extras & Add-ons
          </h2>
          <p className="text-sm text-stone-500 mt-2">
            Enhance your excursion with optional upgrades. You can skip this step or modify selections later.
          </p>
        </div>

        {/* Empty State when Tour has No Assigned Extras */}
        {extrasList.length === 0 ? (
          <div className="p-8 text-center bg-stone-50 border border-stone-200 rounded-sm space-y-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#0E1B2A]">
                Everything is Included in Your Excursion
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                This excursion includes all primary equipment, permits, and activities with no mandatory add-ons required.
              </p>
            </div>
          </div>
        ) : (
          /* Extras Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {extrasList.map((extra) => {
              const isSelected = selectedExtraIds.includes(extra.id);
              const qty = extraQuantities[extra.id] || extra.minQuantity || 1;
              const maxQty = extra.maxQuantity || 10;
              const minQty = extra.minQuantity || 1;

              return (
                <div
                  key={extra.id}
                  className={`aa-extra-card aa-selectable-card p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#0A6C74] bg-[#E8F3F4]/50 ring-1 ring-[#0A6C74]'
                      : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onToggleExtra(extra.id)}
                    className="w-full cursor-pointer text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6C74] focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="font-bold text-stone-900 text-sm sm:text-base block">
                          {extra.name}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#0A6C74] bg-[#E8F3F4] px-1.5 py-0.5 rounded inline-block">
                          {getPricingBadgeLabel(extra.pricingType)}
                        </span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-xs border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-[#0A6C74] border-[#0A6C74] text-white'
                            : 'border-stone-300 bg-white text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </div>

                    <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                      {extra.description}
                    </p>
                  </button>

                  <div className="pt-4 mt-4 border-t border-stone-200/60 flex items-center justify-between gap-2 text-xs flex-wrap">
                    <div>
                      <span className="font-bold text-[#0A6C74] text-xs sm:text-sm">
                        +{formatCurrencyAmount(extra.priceEur, currency)}
                        {extra.pricingType === 'per_person' && (
                          <span className="text-[10px] text-stone-500 font-normal"> / person</span>
                        )}
                        {extra.pricingType === 'per_vehicle' && (
                          <span className="text-[10px] text-stone-500 font-normal"> / vehicle</span>
                        )}
                        {extra.pricingType === 'per_item' && (
                          <span className="text-[10px] text-stone-500 font-normal"> / item</span>
                        )}
                      </span>
                    </div>

                    {/* Quantity Selector for Selected Vehicle / Item Add-ons */}
                    {isSelected && (extra.pricingType === 'per_vehicle' || extra.pricingType === 'per_item' || (extra.maxQuantity && extra.maxQuantity > 1)) && (
                      <div className="flex items-center space-x-1.5 bg-white border border-stone-300 rounded px-1.5 py-0.5 shadow-2xs">
                        <span className="text-[10px] text-stone-500 font-medium mr-1">Qty:</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onUpdateQuantity) {
                              onUpdateQuantity(extra.id, Math.max(minQty, qty - 1));
                            }
                          }}
                          disabled={qty <= minQty}
                          aria-label={`Decrease ${extra.name} quantity`}
                          className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6C74] disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-xs text-stone-900 w-4 text-center">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onUpdateQuantity) {
                              onUpdateQuantity(extra.id, Math.min(maxQty, qty + 1));
                            }
                          }}
                          disabled={qty >= maxQty}
                          aria-label={`Increase ${extra.name} quantity`}
                          className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6C74] disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="aa-secondary-action px-5 py-3 border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-semibold rounded-full transition-colors flex items-center space-x-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="aa-primary-action px-7 py-3 bg-[#0A6C74] hover:bg-[#08565C] text-white text-sm font-semibold rounded-full transition-colors shadow-xs flex items-center space-x-2"
        >
          <span>Continue</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
