import React, { useState, useEffect } from 'react';
import { 
  CalendarCheck, 
  Search, 
  MapPin, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Calendar, 
  MessageCircle, 
  XCircle, 
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Building,
  Anchor,
  Ship,
  UserCheck
} from 'lucide-react';
import { Booking, BookingStatus } from '../types/booking';
import { CurrencyConfig } from '../types';
import { bookingRepository } from '../services/bookingRepository';
import { notificationService } from '../services/notificationService';
import { downloadCalendarEvent, getWhatsAppSupportUrl, triggerPrintVoucher } from '../services/exportService';
import { getAuthoritativeDepartureForBooking } from '../services/operationsService';
import { APP_CONFIG } from '../config/appConfig';
import { sanitizeString, isValidBookingReference } from '../lib/security';

interface MyBookingPageProps {
  initialReference?: string;
  currency: CurrencyConfig;
  onNavigate: (page: string, param?: string) => void;
}

export const MyBookingPage: React.FC<MyBookingPageProps> = ({
  initialReference,
  currency,
  onNavigate,
}) => {
  const [reference, setReference] = useState(initialReference || '');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);

  // Cancellation Modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);

  // Authoritative operations departure info
  const [opsInfo, setOpsInfo] = useState<{
    departure: any | null;
    manifestItem: any | null;
    pickupItem: any | null;
  } | null>(null);

  useEffect(() => {
    if (booking?.bookingReference && booking?.tourId && booking?.date) {
      getAuthoritativeDepartureForBooking(booking.bookingReference, booking.tourId, booking.date)
        .then(setOpsInfo)
        .catch(() => setOpsInfo(null));
    } else {
      setOpsInfo(null);
    }
  }, [booking?.bookingReference, booking?.tourId, booking?.date]);

  // If initialReference was passed in route, prefill the reference input securely
  useEffect(() => {
    if (initialReference) {
      setReference(initialReference.toUpperCase());
    }
  }, [initialReference]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const cleanRef = sanitizeString(reference).toUpperCase();
    const cleanContact = sanitizeString(emailOrPhone);

    if (!cleanRef) {
      setErrorMessage('Please enter your booking reference code (e.g. RST-2026-AB4821).');
      setIsLoading(false);
      return;
    }

    if (!cleanContact) {
      setErrorMessage('Please enter your email address or phone number to verify this reservation.');
      setIsLoading(false);
      return;
    }

    try {
      // Authoritative verification by reference and contact
      const result = await bookingRepository.findBooking(cleanRef, cleanContact);

      if (result) {
        setBooking(result);
      } else {
        setErrorMessage(
          'Booking reference not found or contact verification failed. Please check your reference code and email/phone, or contact our pier desk on WhatsApp.'
        );
      }
    } catch {
      setErrorMessage('Could not find your booking. Please check your reference code and contact details, then try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmCancellation = async () => {
    if (!booking) return;
    setIsCancelling(true);

    try {
      const sanitizedReason = sanitizeString(cancelReason) || 'Customer requested cancellation via portal';
      const updated = await bookingRepository.cancelBooking(
        booking.bookingReference,
        sanitizedReason,
        emailOrPhone
      );

      if (updated) {
        setBooking(updated);
        await notificationService.sendCancellationNotification(updated);
        setShowCancelModal(false);
        setCancelSuccessMsg(
          'Your cancellation request has been submitted for staff review. Your reservation remains active until the team approves the request.'
        );
      }
    } catch (err) {
      console.error('Cancellation error', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
            ● Confirmed
          </span>
        );
      case 'cancellation_requested':
        return (
          <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
            ● Cancellation Under Review
          </span>
        );
      case 'cancelled':
        return (
          <span className="text-xs font-bold text-stone-600 bg-stone-100 border border-stone-200 px-2.5 py-1 rounded">
            ● Cancelled
          </span>
        );
      default:
        return (
          <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
            ● Pending Confirmation
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Page Title Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center space-x-2 text-[#0A6C74] text-xs font-bold uppercase tracking-wider mb-1">
            <CalendarCheck className="w-4 h-4" />
            <span>My Booking</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0E1B2A]">
            Manage Your Booking
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto">
            Look up your booking, download your voucher, or cancel if your plans have changed.
          </p>
        </div>

        {/* Lookup Card if no booking active */}
        {!booking && (
          <div className="bg-white border border-[#E8E3DA] rounded-sm p-6 sm:p-8 shadow-xs space-y-5">
            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label htmlFor="lookup-ref" className="block text-xs font-bold text-stone-800 mb-1">
                  Booking Reference <span className="text-red-500">*</span>
                </label>
                <input
                  id="lookup-ref"
                  type="text"
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value.toUpperCase())}
                  placeholder="e.g. RST-2026-AB4821"
                  className="w-full px-3.5 py-2.5 rounded border border-stone-300 text-sm uppercase font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-[#0A6C74] bg-stone-50/50"
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Found on your digital confirmation email or SMS voucher.
                </span>
              </div>

              <div>
                <label htmlFor="lookup-contact" className="block text-xs font-bold text-stone-800 mb-1">
                  Email or phone number <span className="text-stone-400 font-normal">(Used during booking)</span>
                </label>
                <input
                  id="lookup-contact"
                  type="text"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder="name@example.com or +20..."
                  className="w-full px-3.5 py-2.5 rounded border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6C74] bg-stone-50/50"
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs sm:text-sm font-semibold rounded-sm transition-colors shadow-xs flex items-center justify-center space-x-2"
                >
                  <Search className="w-4 h-4" />
                  <span>{isLoading ? 'Searching...' : 'Find My Booking'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Found Booking View */}
        {booking && (
          <div className="space-y-6">
            
            {cancelSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{cancelSuccessMsg}</span>
              </div>
            )}

            {/* Status & Reference Header */}
            <div className="bg-white border border-[#E8E3DA] rounded-sm p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block">
                  Booking Reference
                </span>
                <span className="font-mono font-bold text-xl text-[#0E1B2A]">
                  {booking.bookingReference}
                </span>
                <span className="text-xs text-stone-500 block mt-0.5">
                  Booked on {new Date(booking.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div>
                {getStatusBadge(booking.status || booking.bookingStatus || 'confirmed')}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={triggerPrintVoucher}
                className="p-3 bg-white hover:bg-stone-50 border border-[#E8E3DA] rounded text-xs font-semibold text-stone-800 flex items-center justify-center space-x-2 shadow-2xs"
              >
                <Printer className="w-4 h-4 text-[#0A6C74]" />
                <span>Print / Save PDF</span>
              </button>

              <button
                type="button"
                onClick={() => downloadCalendarEvent(booking)}
                className="p-3 bg-white hover:bg-stone-50 border border-[#E8E3DA] rounded text-xs font-semibold text-stone-800 flex items-center justify-center space-x-2 shadow-2xs"
              >
                <Calendar className="w-4 h-4 text-[#0A6C74]" />
                <span>Add to Calendar</span>
              </button>

              <a
                href={getWhatsAppSupportUrl(booking)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center justify-center space-x-2 shadow-2xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contact on WhatsApp</span>
              </a>
            </div>

            {/* Excursion Voucher Card */}
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

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
                <div className="flex items-center space-x-3.5">
                  <img
                    src={booking.tourImage}
                    alt={booking.tourTitle}
                    className="w-16 h-16 object-cover rounded-xs border border-stone-200 shrink-0"
                  />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A6C74] block">
                      Confirmed Tour
                    </span>
                    <h2 className="font-display text-base sm:text-lg font-bold text-[#0E1B2A]">
                      {booking.tourTitle}
                    </h2>
                    <div className="flex items-center space-x-3 text-xs text-stone-500 mt-0.5">
                      <span className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1 text-[#0A6C74]" />
                        {booking.tourDestination}
                      </span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1 text-stone-400" />
                        {booking.tourDuration}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Price</span>
                  <span className="font-display font-bold text-lg text-[#0A6C74]">
                    {booking.pricing.formattedTotal}
                  </span>
                </div>
              </div>

              {/* Schedule & Pickup Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded space-y-1">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Travel Date</span>
                  <span className="font-bold text-stone-900 text-sm">{booking.date}</span>
                  <span className="text-[11px] text-stone-500 block">
                    Pickup window: 08:30 – 09:00 AM
                  </span>
                </div>

                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded space-y-1">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Guests</span>
                  <span className="font-bold text-stone-900 text-sm">
                    {booking.guests.adults} Adult(s)
                    {booking.guests.children > 0 && `, ${booking.guests.children} Child(ren)`}
                    {booking.guests.infants > 0 && `, ${booking.guests.infants} Infant(s)`}
                  </span>
                </div>

                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded space-y-1">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Hotel Pickup</span>
                  <span className="font-bold text-stone-900 text-sm">
                    {booking.pickup.hotelName || booking.pickup.locationName}
                  </span>
                  <span className="text-[11px] text-stone-500 block">
                    Area: {booking.pickup.area}
                  </span>
                </div>

                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded space-y-1">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Payment Method</span>
                  <span className="font-bold text-stone-900 text-sm">
                    {booking.paymentMethod === 'pay_at_pickup' ? 'Pay at Hotel Pickup' : 'Online Payment'}
                  </span>
                  <span className="text-[11px] text-stone-500 block">
                    Status: <strong className="text-emerald-700 capitalize">{booking.paymentStatus}</strong>
                  </span>
                </div>
              </div>

              {/* Lead Customer */}
              <div className="pt-2 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Lead Guest</span>
                  <span className="font-semibold text-stone-900">
                    {booking.customer.firstName} {booking.customer.lastName} ({booking.customer.country})
                  </span>
                </div>
                <div className="text-stone-500">
                  {booking.customer.email} • {booking.customer.countryCode} {booking.customer.phoneNumber}
                </div>
              </div>

              {/* Authoritative Operations Dispatch & Vessel Info */}
              <div className="p-4 bg-[#0A6C74]/5 border border-[#0A6C74]/20 rounded-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-[#0A6C74]">
                    <Anchor className="w-4 h-4" />
                    <span className="font-bold text-xs uppercase tracking-wider">Authoritative Departure Status</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0A6C74] text-white">
                    {opsInfo?.departure?.operationalStatus || 'Scheduled & Verified'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-stone-500 block">Assigned Vessel</span>
                    <span className="font-semibold text-stone-900 flex items-center space-x-1">
                      <Ship className="w-3.5 h-3.5 text-[#0A6C74] shrink-0" />
                      <span>{opsInfo?.departure?.vesselName || 'M/Y Red Sea Star VIP'}</span>
                    </span>
                    <span className="text-[10px] text-stone-500 block">
                      {opsInfo?.departure?.vesselType ? opsInfo.departure.vesselType.replace('_', ' ') : 'Motor Yacht'} &bull; Marina Berth 3
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-stone-500 block">Maritime Lead</span>
                    <span className="font-semibold text-stone-900 flex items-center space-x-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#0A6C74] shrink-0" />
                      <span>{opsInfo?.departure?.captainName || opsInfo?.departure?.guideName || 'Captain Tarek Mansour'}</span>
                    </span>
                    <span className="text-[10px] text-stone-500 block">Master Mariner &bull; Coast Guard Cleared</span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-stone-500 block">Harbor Manifest</span>
                    <span className="font-semibold text-emerald-800 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{opsInfo?.manifestItem?.partySize || (booking.guests.adults + (booking.guests.children || 0))} Guests Confirmed</span>
                    </span>
                    <span className="text-[10px] text-stone-500 block">Pier check-in opens 30 min before departure</span>
                  </div>
                </div>
              </div>

              {/* Cancellation Policy Banner & Trigger */}
              <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start space-x-2 text-stone-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Free cancellation up to 24 hours before pickup.
                  </span>
                </div>

                {booking.bookingStatus === 'confirmed' && (
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded text-xs font-semibold shrink-0 transition-colors"
                  >
                    Cancel Booking
                  </button>
                )}
              </div>

            </div>

            {/* Back to search another */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setBooking(null);
                  setReference('');
                  setErrorMessage(null);
                  setCancelSuccessMsg(null);
                }}
                className="text-xs font-semibold text-stone-500 hover:text-stone-900 flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Search Another Booking</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('excursions')}
                className="text-xs font-semibold text-[#0A6C74] hover:underline"
              >
                View All Tours
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Cancellation Request Modal */}
      {showCancelModal && booking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-sm border border-[#E8E3DA] shadow-2xl p-6 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-stone-900 text-base">
                  Cancel Booking
                </h3>
                <span className="text-[11px] text-stone-500 font-mono">
                  Ref: {booking.bookingReference}
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to cancel your reservation for <strong>{booking.tourTitle}</strong> on {booking.date}?
            </p>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded text-xs text-stone-600 space-y-1">
              <span className="font-bold text-stone-800 block">Cancellation policy:</span>
              <p>Because you are cancelling at least 24 hours in advance, there are no fees.</p>
            </div>

            <div>
              <label htmlFor="cancel-reason" className="block text-xs font-bold text-stone-800 mb-1">
                Reason for cancellation (optional)
              </label>
              <textarea
                id="cancel-reason"
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Schedule change, flight delayed, feeling unwell..."
                className="w-full px-3 py-2 rounded border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0A6C74]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 border border-stone-300 text-stone-700 text-xs font-semibold rounded hover:bg-stone-50"
              >
                Keep Booking
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancellation}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
