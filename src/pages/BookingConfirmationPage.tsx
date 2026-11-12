import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  Printer, 
  Calendar, 
  MessageCircle, 
  MapPin, 
  Users, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  Download,
  AlertCircle,
  UserPlus
} from 'lucide-react';
import { Booking } from '../types/booking';
import { CurrencyConfig } from '../types';
import { downloadCalendarEvent, getWhatsAppSupportUrl, triggerPrintVoucher } from '../services/exportService';
import { useAuth } from '../contexts/AuthContext';

interface BookingConfirmationPageProps {
  booking: Booking;
  currency: CurrencyConfig;
  onNavigate: (page: string, param?: string) => void;
}

export const BookingConfirmationPage: React.FC<BookingConfirmationPageProps> = ({
  booking,
  currency,
  onNavigate,
}) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopyRef = () => {
    navigator.clipboard.writeText(booking.bookingReference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Success Header Banner */}
        <div className="bg-white border border-[#E8E3DA] rounded-sm p-6 sm:p-8 text-center shadow-xs">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block mb-2">
            {booking.status === 'confirmed' ? 'Booking Confirmed' : 'Reservation Received'}
          </span>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0E1B2A] tracking-tight">
            {booking.status === 'confirmed' ? 'Your booking is confirmed' : 'Your reservation has been received'}
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto mt-2">
            We have saved your booking and sent the details to{' '}
            <strong className="text-stone-900">{booking.customer.email}</strong>.
          </p>

          {/* Reference Badge with Copy */}
          <div className="mt-5 p-3.5 bg-[#FAF8F5] border border-[#E8E3DA] rounded inline-flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className="text-center sm:text-left">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">
                Booking Reference
              </span>
              <span className="font-mono font-bold text-lg sm:text-xl text-[#0A6C74] tracking-wider">
                {booking.bookingReference}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyRef}
              className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-300 rounded text-xs font-semibold text-stone-700 flex items-center space-x-1.5 transition-colors shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                  <span>Copy Reference</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
          <button
            type="button"
            onClick={triggerPrintVoucher}
            className="p-3 bg-white hover:bg-stone-50 border border-[#E8E3DA] rounded text-xs font-semibold text-stone-800 flex items-center justify-center space-x-2 shadow-2xs transition-colors"
          >
            <Printer className="w-4 h-4 text-[#0A6C74]" />
            <span>Print Voucher (PDF)</span>
          </button>

          <button
            type="button"
            onClick={() => downloadCalendarEvent(booking)}
            className="p-3 bg-white hover:bg-stone-50 border border-[#E8E3DA] rounded text-xs font-semibold text-stone-800 flex items-center justify-center space-x-2 shadow-2xs transition-colors"
          >
            <Calendar className="w-4 h-4 text-[#0A6C74]" />
            <span>Add to Calendar</span>
          </button>

          <a
            href={getWhatsAppSupportUrl(booking)}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center justify-center space-x-2 shadow-2xs transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Contact on WhatsApp</span>
          </a>
        </div>

        {/* Printable Official Voucher Card */}
        <div id="printable-ticket" className="bg-white border border-[#E8E3DA] rounded-sm p-6 sm:p-8 space-y-6 shadow-xs">
          
          {/* Print-Only Official Company Header */}
          <div className="hidden print:flex items-center justify-between border-b-2 border-[#0A6C74] pb-4 mb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#0E1B2A] uppercase">
                Awesome Adventure Tours
              </h1>
              <p className="text-xs text-stone-600">
                Official Excursion Ticket & Hotel Pickup Voucher • Red Sea, Egypt
              </p>
            </div>
            <div className="text-right text-xs text-stone-700">
              <p className="font-mono font-bold text-sm text-[#0A6C74]">REF: {booking.bookingReference}</p>
              <p className="text-[11px] text-stone-500">24/7 Support: +20 151 5212741</p>
            </div>
          </div>

          <div className="flex items-start justify-between border-b border-stone-200 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A6C74] block">
                Booking Voucher
              </span>
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#0E1B2A]">
                {booking.tourTitle}
              </h2>
              <div className="flex items-center space-x-3 text-xs text-stone-500 mt-1">
                <span className="flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-[#0A6C74]" />
                  {booking.tourDestination}
                </span>
                <span>•</span>
                <span className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1 text-stone-400" />
                  {booking.tourDuration}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Status</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                booking.status === 'confirmed'
                  ? 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                  : 'text-amber-800 bg-amber-50 border border-amber-200'
              }`}>
                {booking.status === 'confirmed' ? 'Confirmed' : 'Pending Confirmation'}
              </span>
            </div>
          </div>

          {/* Grid Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded space-y-1">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Date of Excursion</span>
              <span className="font-bold text-stone-900 text-sm">{booking.date}</span>
              <span className="text-[11px] text-stone-500 block">
                Vessel departure approx. 08:30 – 09:00 AM
              </span>
            </div>

            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded space-y-1">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Guests Reserved</span>
              <span className="font-bold text-stone-900 text-sm">
                {booking.guests.adults} Adult(s)
                {booking.guests.children > 0 && `, ${booking.guests.children} Child(ren)`}
                {booking.guests.infants > 0 && `, ${booking.guests.infants} Infant(s)`}
              </span>
              <span className="text-[11px] text-stone-500 block">
                Marine park admission pass included
              </span>
            </div>

            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded space-y-1">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Hotel / Pickup Point</span>
              <span className="font-bold text-stone-900 text-sm block">
                {booking.pickup.hotelName || booking.customer.hotelName || booking.pickup.locationName}
              </span>
              <span className="text-[11px] text-stone-500 block">
                Transfer Zone: {booking.pickup.area}
                {(booking.pickup.roomNumber || booking.customer.roomNumber) && ` (Room ${booking.pickup.roomNumber || booking.customer.roomNumber})`}
              </span>
            </div>

            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded space-y-1">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Tour Language</span>
              <span className="font-bold text-stone-900 text-sm">{booking.tourLanguage || 'To be confirmed'}</span>
            </div>

            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded space-y-1">
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Payment Terms</span>
              <span className="font-bold text-stone-900 text-sm">
                {booking.paymentMethod === 'pay_online' ? 'Paid Online' : 'Pay on Hotel Pickup'}
              </span>
              <span className="text-[11px] text-stone-500 block">
                Amount payable: <strong className="text-emerald-700">{booking.pricing.formattedTotal}</strong>
              </span>
            </div>
          </div>

          {/* Selected Extras */}
          {booking.extras && booking.extras.length > 0 && (
            <div className="pt-2 border-t border-stone-200">
              <span className="text-[10px] uppercase font-bold text-stone-400 block mb-2">
                Included Booking Upgrades & Add-ons
              </span>
              <div className="space-y-1.5 text-xs">
                {booking.extras.map((ex) => (
                  <div key={ex.extraId} className="flex justify-between items-center text-stone-700 bg-stone-50 px-2.5 py-1.5 rounded border border-stone-200/60">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-stone-900">• {ex.name}</span>
                      <span className="text-[10px] text-stone-500">
                        ({ex.quantity || 1}x @ €{ex.priceEur.toFixed(2)}{ex.pricingType === 'per_person' ? '/pers' : ''})
                      </span>
                    </div>
                    <span className="font-bold text-stone-900">€{(ex.amountEur || (ex.priceEur * (ex.quantity || 1))).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lead Traveler */}
          <div className="pt-2 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Lead Traveler</span>
              <span className="font-semibold text-stone-900">
                {booking.customer.firstName} {booking.customer.lastName} ({booking.customer.country})
              </span>
            </div>
            <div className="text-stone-500">
              <span>{booking.customer.email}</span> • <span>{booking.customer.countryCode} {booking.customer.phoneNumber}</span>
            </div>
          </div>

          {/* What to Expect Next */}
          <div className="p-4 bg-[#FAF8F5] border border-[#E8E3DA] rounded text-xs space-y-2 text-stone-700">
            <span className="font-bold text-stone-900 block text-xs">
              What happens next:
            </span>
            <ul className="space-y-1 text-[11px] text-stone-600 list-disc list-inside">
              <li>
                <strong>WhatsApp message:</strong> We will send a WhatsApp message the evening before your tour (between 18:00 and 20:00) with your exact pickup time and driver details.
              </li>
              <li>
                <strong>What to bring:</strong> Passports (or hotel card for Coast Guard check), beach towels, swimwear, sunglasses, and sun cream.
              </li>
              <li>
                <strong>Meeting point:</strong> Please wait in your main hotel lobby 10 minutes before the pickup time.
              </li>
              <li>
                <strong>Emergency Helpline:</strong> Contact our 24/7 excursion dispatch desk at +20 151 5212741.
              </li>
            </ul>
          </div>

        </div>

        {/* Guest Account Prompt */}
        {!user && (
          <div className="bg-[#E8F3F4] border border-[#0A6C74]/30 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
            <div className="text-center sm:text-left space-y-1">
              <span className="font-bold text-sm text-[#0E1B2A] block">
                Booked as a guest? Link this reservation to a free account
              </span>
              <p className="text-xs text-stone-600">
                Create a password to access all your vouchers, manage dates, and get live WhatsApp updates anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('register')}
              className="px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded-lg shrink-0 flex items-center space-x-1.5 transition-colors shadow-2xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 print:hidden">
          <button
            type="button"
            onClick={() => onNavigate('my-booking', booking.bookingReference)}
            className="text-xs font-semibold text-[#0A6C74] hover:text-[#08565C] hover:underline"
          >
            View or cancel booking in My Booking
          </button>

          <button
            type="button"
            onClick={() => onNavigate('excursions')}
            className="px-6 py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <span>View All Tours</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
