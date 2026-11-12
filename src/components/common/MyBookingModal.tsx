import React, { useState } from 'react';
import { 
  X, 
  CalendarCheck, 
  MapPin, 
  Clock, 
  User, 
  CheckCircle2, 
  Download, 
  MessageCircle, 
  AlertCircle 
} from 'lucide-react';
import { CurrencyConfig } from '../../types';
import { Booking } from '../../types/booking';
import { bookingRepository } from '../../services/bookingRepository';
import { formatCurrencyAmount } from '../../services/pricingService';
import { sanitizeString } from '../../lib/security';

interface MyBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyConfig;
}

export const MyBookingModal: React.FC<MyBookingModalProps> = ({ isOpen, onClose, currency }) => {
  const [bookingRef, setBookingRef] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setBooking(null);

    const cleanRef = sanitizeString(bookingRef).toUpperCase();
    const cleanContact = sanitizeString(emailOrPhone);

    if (!cleanRef || !cleanContact) {
      setErrorMessage('Please enter both your booking reference and the email address or full phone number used during booking.');
      setIsLoading(false);
      return;
    }

    try {
      const result = await bookingRepository.findBooking(cleanRef, cleanContact);

      if (result) {
        setBooking(result);
      } else {
        setErrorMessage(
          `Booking reference "${cleanRef}" was not found. Please verify the code on your confirmation voucher or contact our pier coordinator on WhatsApp.`
        );
      }
    } catch {
      setErrorMessage('Could not retrieve booking details. Please verify your reference and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const resetLookup = () => {
    setBooking(null);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-white rounded-sm border border-[#E8E3DA] shadow-2xl overflow-hidden my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-[#FAF8F5]">
          <div className="flex items-center space-x-2">
            <CalendarCheck className="w-5 h-5 text-[#0A6C74]" />
            <h2 className="font-display text-lg font-bold text-[#0E1B2A]">
              Retrieve Booking Voucher
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-900 rounded-sm hover:bg-stone-200 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!booking ? (
            <form onSubmit={handleLookup} className="space-y-4">
              <p className="text-xs text-stone-600">
                Enter your booking confirmation reference number and optional email or WhatsApp phone to inspect your excursion voucher, pickup time, and reservation status.
              </p>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Booking Reference Number *
                </label>
                <input
                  type="text"
                  required
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value.toUpperCase())}
                  placeholder="e.g. RST-2026-AB4821"
                  className="w-full px-3 py-2 border border-stone-300 rounded text-sm uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Email Address or WhatsApp Phone *
                </label>
                <input
                  type="text"
                  required
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder="name@domain.com or +20 151 5212741"
                  className="w-full px-3 py-2 border border-stone-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !bookingRef.trim()}
                  className="w-full py-2.5 bg-[#0A6C74] hover:bg-[#08565C] disabled:bg-stone-300 text-white text-xs font-semibold rounded transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isLoading ? <span>Checking your booking...</span> : <span>Find My Excursion</span>}
                </button>
              </div>

              <p className="text-[11px] text-stone-600 text-center">
                Need immediate assistance? Contact our Hurghada marina dispatch desk on WhatsApp: +20 151 5212741.
              </p>
            </form>
          ) : (
            <div className="space-y-5 animate-in fade-in">
              {/* Status Header */}
              <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block">Booking Confirmed & Dispatched</span>
                    <span className="text-[11px] text-emerald-700 font-mono">Ref: {booking.bookingReference}</span>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white capitalize">
                  {booking.status}
                </span>
              </div>

              {/* Excursion Summary */}
              <div className="border border-stone-200 rounded p-4 space-y-3 bg-[#FAF8F5]">
                <h3 className="font-display font-bold text-sm text-[#0E1B2A]">
                  {booking.tourTitle}
                </h3>
                
                <div className="grid grid-cols-2 gap-3 text-xs text-stone-600">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-stone-400">Date</span>
                    <span className="font-semibold text-stone-800">{booking.date}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-stone-400">Guests</span>
                    <span className="font-semibold text-stone-800">
                      {booking.guests.adults} Adults
                      {booking.guests.children > 0 && `, ${booking.guests.children} Children`}
                      {booking.guests.infants > 0 && `, ${booking.guests.infants} Infants`}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-stone-400">Hotel Pickup</span>
                    <span className="font-semibold text-stone-800">
                      {booking.pickup.hotelName || booking.pickup.locationName || 'Resort Lobby'}
                      {booking.pickup.roomNumber && ` (Room ${booking.pickup.roomNumber})`}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-stone-400">Lead Passenger</span>
                    <span className="font-semibold text-stone-800">
                      {booking.customer.firstName} {booking.customer.lastName}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
                  <span className="font-medium text-stone-500">
                    Payment Method: <span className="capitalize">{booking.paymentMethod.replace(/_/g, ' ')}</span>
                  </span>
                  <span className="font-bold text-emerald-700">
                    {formatCurrencyAmount(booking.pricing.totalEur, currency)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="py-2 px-3 border border-stone-300 rounded text-xs font-semibold text-stone-800 hover:bg-stone-50 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-stone-500" />
                  <span>Print Voucher</span>
                </button>
                <a
                  href={`https://wa.me/201515212741?text=${encodeURIComponent(`Hello, I have an inquiry about my reservation reference ${booking.bookingReference}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center justify-center space-x-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Pier Support</span>
                </a>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={resetLookup}
                  className="text-[#0A6C74] hover:underline text-[11px] font-medium cursor-pointer"
                >
                  Look up another booking
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-medium text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
