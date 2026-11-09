import React from 'react';
import { MapPin, CheckCircle2, ArrowRight, ArrowLeft, MessageCircle, HelpCircle, Building } from 'lucide-react';
import { PickupLocation } from '../../types/booking';
import { CurrencyConfig } from '../../types';
import { STANDARD_PICKUP_LOCATIONS } from '../../data/bookingData';
import { formatCurrencyAmount } from '../../services/pricingService';
import { getWhatsAppSupportUrl } from '../../services/exportService';

interface StepPickupProps {
  selectedPickupId: string;
  onSelectPickup: (location: PickupLocation) => void;
  hotelName: string;
  onHotelNameChange: (name: string) => void;
  currency: CurrencyConfig;
  onNext: () => void;
  onBack: () => void;
  locations?: PickupLocation[];
}

export const StepPickup: React.FC<StepPickupProps> = ({
  selectedPickupId,
  onSelectPickup,
  hotelName,
  onHotelNameChange,
  currency,
  onNext,
  onBack,
  locations,
}) => {
  const pickupList = locations && locations.length > 0 ? locations : STANDARD_PICKUP_LOCATIONS;
  const selectedLocation = pickupList.find((l) => l.id === selectedPickupId) || pickupList[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Step Header */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-5 space-y-4">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-[#0E1B2A] flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-[#0A6C74]" />
            Choose Your Hotel Transfer Area
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            We provide direct air-conditioned van transfers from hotel reception lobbies to the departure marina.
          </p>
        </div>

        {/* Pickup Location Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {pickupList.map((loc) => {
            const isSelected = selectedPickupId === loc.id;
            return (
              <div
                key={loc.id}
                onClick={() => onSelectPickup(loc)}
                className={`p-4 rounded-sm border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#0A6C74] bg-[#E8F3F4]/50 ring-1 ring-[#0A6C74]'
                    : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-stone-900 text-xs sm:text-sm">
                        {loc.name}
                      </span>
                      {loc.isPopular && (
                        <span className="text-[9px] uppercase font-bold text-[#0A6C74] bg-[#E8F3F4] px-1.5 py-0.5 rounded">
                          Standard
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-stone-500 block">
                      {loc.area}
                    </span>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    {loc.feeEurPerPerson === 0 ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Included
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-stone-800">
                        +{formatCurrencyAmount(loc.feeEurPerPerson, currency)}
                        <span className="text-[10px] text-stone-500 font-normal"> / pers.</span>
                      </span>
                    )}
                  </div>
                </div>

                {loc.note && (
                  <p className="text-[10px] text-stone-600 mt-2 pt-2 border-t border-stone-200/60 leading-normal">
                    {loc.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Accommodation Name Input */}
        <div className="pt-3 border-t border-stone-200 space-y-2">
          <label htmlFor="hotel-input" className="block text-xs font-bold text-stone-900 flex items-center">
            <Building className="w-3.5 h-3.5 mr-1.5 text-[#0A6C74]" />
            Hotel name (Optional - can be provided later)
          </label>
          <input
            id="hotel-input"
            type="text"
            value={hotelName}
            onChange={(e) => onHotelNameChange(e.target.value)}
            placeholder="e.g. Steigenberger ALDAU Beach, Sunrise Crystal Bay, etc."
            className="w-full px-3.5 py-2.5 rounded border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0A6C74] bg-stone-50/50"
          />
          <span className="text-[11px] text-stone-500 block">
            Not sure about your hotel yet? You can leave this empty and tell us on WhatsApp before your tour.
          </span>
        </div>

        {/* Unlisted Pickup Notice */}
        <div className="p-3.5 bg-stone-50 border border-stone-200 rounded text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <HelpCircle className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-stone-900 block">Pickup location not listed?</span>
              <span className="text-stone-600 text-[11px]">
                Staying in a private apartment or unlisted hotel? Contact us directly on WhatsApp.
              </span>
            </div>
          </div>
          <a
            href={getWhatsAppSupportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs font-semibold text-[#0A6C74] hover:text-[#08565C] bg-white px-3 py-1.5 border border-stone-300 rounded shadow-2xs self-start sm:self-auto shrink-0"
          >
            <MessageCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            <span>Contact Us</span>
          </a>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs sm:text-sm font-semibold rounded-sm transition-colors flex items-center space-x-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="px-7 py-3 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs sm:text-sm font-semibold rounded-sm transition-colors shadow-xs flex items-center space-x-2"
        >
          <span>Continue</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
