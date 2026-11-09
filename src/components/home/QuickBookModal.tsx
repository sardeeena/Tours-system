import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Users, 
  MapPin, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  ArrowRight,
  Phone,
  Mail,
  User
} from 'lucide-react';
import { Tour, CurrencyConfig } from '../../types';
import { formatPrice } from '../../data/toursData';

interface QuickBookModalProps {
  tour: Tour | null;
  currency: CurrencyConfig;
  onClose: () => void;
  onSuccess: (bookingDetails: {
    bookingId: string;
    tourTitle: string;
    date: string;
    guests: number;
    totalPrice: string;
  }) => void;
}

export const QuickBookModal: React.FC<QuickBookModalProps> = ({
  tour,
  currency,
  onClose,
  onSuccess,
}) => {
  if (!tour) return null;

  const [date, setDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [hotelName, setHotelName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentPreference, setPaymentPreference] = useState<'pay_later' | 'credit_card'>('pay_later');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Price calculations
  const adultTotal = adults * tour.priceEur;
  const childTotal = children * (tour.childPriceEur || tour.priceEur * 0.5);
  const totalEur = adultTotal + childTotal;
  const formattedTotal = formatPrice(totalEur, currency);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const generatedId = `RSE-${Math.floor(10000 + Math.random() * 90000)}`;
      onSuccess({
        bookingId: generatedId,
        tourTitle: tour.title,
        date,
        guests: adults + children,
        totalPrice: formattedTotal,
      });
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-white rounded-sm border border-[#E8E3DA] shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-[#FAF8F5]">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6C74]">
              Direct Vessel Reservation
            </span>
            <h2 className="font-display text-lg font-bold text-[#0E1B2A] line-clamp-1">
              Book: {tour.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-900 rounded-sm hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
          
          {/* Excursion Meta Summary */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded text-xs flex items-center justify-between">
            <div>
              <span className="font-semibold text-stone-900 block">{tour.destination}</span>
              <span className="text-stone-500">{tour.durationLabel}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Rate</span>
              <span className="font-bold text-[#0A6C74]">{formatPrice(tour.priceEur, currency)} / adult</span>
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-[#0A6C74]" />
              Select Date of Excursion
            </label>
            <input
              type="date"
              required
              min={new Date().toISOString().split('T')[0]}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
            />
          </div>

          {/* Guests count */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Adults (Age 12+)
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={adults <= 1}
                  onClick={() => setAdults(Math.max(1, adults - 1))}
                  className="w-8 h-8 rounded border border-stone-300 flex items-center justify-center text-stone-700 disabled:opacity-30"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-bold text-stone-800">{adults}</span>
                <button
                  type="button"
                  onClick={() => setAdults(adults + 1)}
                  className="w-8 h-8 rounded border border-stone-300 flex items-center justify-center text-stone-700"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Children (Age 2-11)
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={children <= 0}
                  onClick={() => setChildren(Math.max(0, children - 1))}
                  className="w-8 h-8 rounded border border-stone-300 flex items-center justify-center text-stone-700 disabled:opacity-30"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-bold text-stone-800">{children}</span>
                <button
                  type="button"
                  onClick={() => setChildren(children + 1)}
                  className="w-8 h-8 rounded border border-stone-300 flex items-center justify-center text-stone-700"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Hotel Pickup Info */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1.5 text-[#0A6C74]" />
              Resort / Hotel Name for Pickup
            </label>
            <input
              type="text"
              required
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              placeholder="e.g. Steigenberger ALDAU Beach, Hurghada"
              className="w-full px-3 py-2 border border-stone-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
            />
            <span className="text-[11px] text-stone-500 mt-1 block">
              We provide direct lobby-to-pier transfers. Exact pickup time will be confirmed on your voucher.
            </span>
          </div>

          {/* Lead Contact Info */}
          <div className="space-y-3 pt-2 border-t border-stone-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Lead Guest Information
            </h3>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Marcus Weber"
                className="w-full px-3 py-2 border border-stone-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Email (for Voucher)
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full px-3 py-2 border border-stone-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+49 170 1234567"
                  className="w-full px-3 py-2 border border-stone-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                />
              </div>
            </div>
          </div>

          {/* Payment Preference option */}
          <div className="pt-2 border-t border-stone-200">
            <label className="block text-xs font-semibold text-stone-700 mb-2">
              Payment Option
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className={`p-2.5 rounded border cursor-pointer flex flex-col justify-between ${
                paymentPreference === 'pay_later'
                  ? 'border-[#0A6C74] bg-[#E8F3F4] text-[#0E1B2A] font-medium'
                  : 'border-stone-200 hover:bg-stone-50'
              }`}>
                <div className="flex items-center space-x-1.5 mb-1">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentPreference === 'pay_later'}
                    onChange={() => setPaymentPreference('pay_later')}
                    className="text-[#0A6C74]"
                  />
                  <span className="font-semibold">Pay on Hotel Pickup</span>
                </div>
                <span className="text-[10px] text-stone-500">Pay cash/card when the van arrives</span>
              </label>

              <label className={`p-2.5 rounded border cursor-pointer flex flex-col justify-between ${
                paymentPreference === 'credit_card'
                  ? 'border-[#0A6C74] bg-[#E8F3F4] text-[#0E1B2A] font-medium'
                  : 'border-stone-200 hover:bg-stone-50'
              }`}>
                <div className="flex items-center space-x-1.5 mb-1">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentPreference === 'credit_card'}
                    onChange={() => setPaymentPreference('credit_card')}
                    className="text-[#0A6C74]"
                  />
                  <span className="font-semibold">Online Credit Card</span>
                </div>
                <span className="text-[10px] text-stone-500">Instant secure card payment</span>
              </label>
            </div>
          </div>

          {/* Price Calculation Summary */}
          <div className="p-4 bg-[#FAF8F5] border border-[#E8E3DA] rounded text-xs space-y-1.5">
            <div className="flex justify-between text-stone-600">
              <span>{adults} Adult(s) × {formatPrice(tour.priceEur, currency)}:</span>
              <span className="font-semibold">{formatPrice(adultTotal, currency)}</span>
            </div>
            {children > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>{children} Child(ren):</span>
                <span className="font-semibold">{formatPrice(childTotal, currency)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline text-sm">
              <span className="font-bold text-[#0E1B2A]">Total Payable:</span>
              <span className="font-bold text-lg text-[#0A6C74]">{formattedTotal}</span>
            </div>
          </div>

          {/* Cancellation Notice */}
          <div className="flex items-center text-[11px] text-emerald-800 bg-emerald-50 p-2.5 rounded border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
            <span>Free cancellation up to 24 hours prior to departure for a 100% refund.</span>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#0A6C74] hover:bg-[#08565C] text-white text-sm font-semibold rounded transition-colors shadow flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <span>Generating Official Booking Voucher...</span>
              ) : (
                <>
                  <span>Confirm Reservation ({formattedTotal})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
