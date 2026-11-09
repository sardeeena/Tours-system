import React from 'react';
import { Tour, CurrencyConfig } from '../../types';
import { GuestCounts, PickupLocation, BookingExtra, CustomerInfo, BookingPricing } from '../../types/booking';
import { 
  Calendar, 
  Users, 
  MapPin, 
  Sparkles, 
  User, 
  Edit2, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  ShieldCheck,
  Building
} from 'lucide-react';

interface StepReviewProps {
  tour: Tour;
  date: string;
  guests: GuestCounts;
  pickupLocation?: PickupLocation | null;
  hotelName: string;
  selectedExtras: BookingExtra[];
  customer: CustomerInfo;
  pricing: BookingPricing;
  currency: CurrencyConfig;
  onGoToStep: (stepNumber: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export const StepReview: React.FC<StepReviewProps> = ({
  tour,
  date,
  guests,
  pickupLocation,
  hotelName,
  selectedExtras,
  customer,
  pricing,
  currency,
  onGoToStep,
  onNext,
  onBack,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Introduction */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-5">
        <h2 className="font-display text-base sm:text-lg font-bold text-[#0E1B2A]">
          Review your booking
        </h2>
        <p className="text-xs text-stone-600 mt-1">
          Please check your dates, pickup location, and contact information before paying.
        </p>
      </div>

      {/* Review Section 1: Excursion & Schedule */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-stone-200">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#0A6C74]" />
            <h3 className="font-bold text-xs sm:text-sm text-stone-900 uppercase tracking-wider">
              Tour and Date
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onGoToStep(1)}
            className="text-xs font-semibold text-[#0A6C74] hover:text-[#08565C] flex items-center space-x-1 hover:underline"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-display font-bold text-stone-900 text-sm block">
              {tour.title}
            </span>
            <div className="flex items-center space-x-3 text-stone-500 mt-1 text-[11px]">
              <span className="flex items-center">
                <MapPin className="w-3 h-3 mr-1 text-[#0A6C74]" />
                {tour.destination}
              </span>
              <span>•</span>
              <span className="flex items-center">
                <Clock className="w-3 h-3 mr-1 text-stone-400" />
                {tour.durationLabel}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:text-right bg-stone-50 p-2.5 rounded sm:bg-transparent sm:p-0">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Travel Date</span>
              <span className="font-semibold text-stone-800">{date}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Guests</span>
              <span className="font-semibold text-stone-800">
                {guests.adults} Adult{guests.adults > 1 ? 's' : ''}
                {guests.children > 0 && `, ${guests.children} Child${guests.children > 1 ? 'ren' : ''}`}
                {guests.infants > 0 && `, ${guests.infants} Infant${guests.infants > 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Review Section 2: Hotel Pickup Details */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-stone-200">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-[#0A6C74]" />
            <h3 className="font-bold text-xs sm:text-sm text-stone-900 uppercase tracking-wider">
              Pickup & Transfer
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onGoToStep(2)}
            className="text-xs font-semibold text-[#0A6C74] hover:text-[#08565C] flex items-center space-x-1 hover:underline"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Transfer Region</span>
            <span className="font-semibold text-stone-800">
              {pickupLocation ? pickupLocation.name : 'Hurghada Standard'}
            </span>
            <span className="text-[11px] text-stone-500 block mt-0.5">
              {pickupLocation?.area}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Hotel / Resort Name</span>
            <span className="font-semibold text-stone-800">
              {hotelName ? hotelName : customer.hotelName || 'To be confirmed before departure'}
            </span>
            {customer.roomNumber && (
              <span className="text-[11px] text-stone-500 block mt-0.5">
                Room: {customer.roomNumber}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Review Section 3: Selected Extras */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-stone-200">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#0A6C74]" />
            <h3 className="font-bold text-xs sm:text-sm text-stone-900 uppercase tracking-wider">
              Selected Extras
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onGoToStep(3)}
            className="text-xs font-semibold text-[#0A6C74] hover:text-[#08565C] flex items-center space-x-1 hover:underline"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        {selectedExtras.length === 0 ? (
          <p className="text-xs text-stone-500 italic">No additional extras selected.</p>
        ) : (
          <div className="space-y-1.5 text-xs">
            {selectedExtras.map((extra) => (
              <div key={extra.id} className="flex justify-between items-center text-stone-700 bg-stone-50 px-3 py-2 rounded">
                <span className="font-medium">• {extra.name}</span>
                <span className="font-semibold text-[#0A6C74]">
                  +€{extra.priceEur} ({extra.pricingType === 'per_person' ? 'per guest' : 'flat'})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Section 4: Lead Traveler Contact */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-stone-200">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-[#0A6C74]" />
            <h3 className="font-bold text-xs sm:text-sm text-stone-900 uppercase tracking-wider">
              Lead Traveler Contact
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onGoToStep(4)}
            className="text-xs font-semibold text-[#0A6C74] hover:text-[#08565C] flex items-center space-x-1 hover:underline"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Name</span>
            <span className="font-semibold text-stone-800">{customer.firstName} {customer.lastName}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Email Address</span>
            <span className="font-semibold text-stone-800">{customer.email}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">WhatsApp / Phone</span>
            <span className="font-semibold text-stone-800">{customer.countryCode} {customer.phoneNumber}</span>
          </div>
        </div>

        {customer.specialRequests && (
          <div className="pt-2 border-t border-stone-200/60 text-xs text-stone-600">
            <span className="font-semibold text-stone-800 block text-[11px]">Special Requests:</span>
            <span>{customer.specialRequests}</span>
          </div>
        )}
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
          <span>Continue to Payment</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
