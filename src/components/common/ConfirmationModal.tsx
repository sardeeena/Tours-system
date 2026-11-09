import React from 'react';
import { CheckCircle2, Download, MessageCircle, Calendar, MapPin, Users, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingDetails: {
    bookingId: string;
    tourTitle: string;
    date: string;
    guests: number;
    totalPrice: string;
  } | null;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  bookingDetails,
}) => {
  if (!isOpen || !bookingDetails) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white rounded-sm border border-[#E8E3DA] shadow-2xl overflow-hidden my-6 p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded">
            Reservation Confirmed
          </span>
          <h2 className="font-display text-2xl font-bold text-[#0E1B2A] mt-2">
            You're Ready for the Red Sea!
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            Your excursion voucher has been generated and sent to your email.
          </p>
        </div>

        {/* Voucher card */}
        <div className="bg-[#FAF8F5] border border-[#E8E3DA] rounded p-4 mb-6 text-xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-stone-200">
            <span className="text-stone-500 font-medium">Booking Reference</span>
            <span className="font-mono font-bold text-sm text-[#0E1B2A] bg-white px-2 py-0.5 rounded border border-stone-200">
              {bookingDetails.bookingId}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Excursion</span>
            <span className="font-semibold text-stone-900 block text-xs mt-0.5">{bookingDetails.tourTitle}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Date</span>
              <span className="font-medium text-stone-800">{bookingDetails.date}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400 block">Guests</span>
              <span className="font-medium text-stone-800">{bookingDetails.guests} Guests</span>
            </div>
          </div>

          <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
            <span className="font-medium text-stone-600">Total Price:</span>
            <span className="font-bold text-base text-[#0A6C74]">{bookingDetails.totalPrice}</span>
          </div>
        </div>

        {/* Next Steps Guide */}
        <div className="bg-stone-50 p-3.5 rounded border border-stone-200 text-xs text-stone-600 mb-6 space-y-1.5">
          <span className="font-bold text-stone-800 block">What happens next:</span>
          <p>1. Our operations desk will message your WhatsApp with exact hotel lobby pickup time (usually between 07:45 - 08:30 AM).</p>
          <p>2. Please bring swimsuits, towels, sunglasses, and camera.</p>
          <p>3. Free cancellation or date changes available up to 24 hours prior.</p>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <a
            href="https://wa.me/201515212741"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Connect with Pier Dispatcher on WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            Return to Homepage
          </button>
        </div>

      </div>
    </div>
  );
};
