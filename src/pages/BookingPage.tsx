import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { recordVisitorEvent } from '../services/visitorAnalyticsService';
import { motion, AnimatePresence } from 'motion/react';
import { Tour, CurrencyConfig } from '../types';
import { GuestCounts, BookingExtra, CustomerInfo, Booking, PickupLocation } from '../types/booking';
import { GLOBAL_BOOKING_EXTRAS } from '../data/bookingData';
import { getPublishedPickupLocations, getPublishedTourExtras } from '../services/tourService';
import { calculateBookingPrice } from '../services/pricingService';
import { bookingRepository, generateBookingReference } from '../services/bookingRepository';
import { loadBookingDraft, saveBookingDraft, clearBookingDraft, BookingDraftState } from '../services/draftStorage';
import { BookingSummary } from '../components/booking/BookingSummary';
import { StepDateGuests } from '../components/booking/StepDateGuests';
import { StepPickup } from '../components/booking/StepPickup';
import { StepExtras } from '../components/booking/StepExtras';
import { StepCustomerInfo } from '../components/booking/StepCustomerInfo';
import { StepReview } from '../components/booking/StepReview';
import { StepPayment } from '../components/booking/StepPayment';
import { 
  Calendar, 
  MapPin, 
  Sparkles, 
  User, 
  CheckSquare, 
  Lock, 
  Check, 
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';

interface BookingPageProps {
  tours: Tour[];
  initialTourSlug?: string;
  currency: CurrencyConfig;
  onBookingSuccess: (booking: Booking) => void;
  onNavigate: (page: string, param?: string) => void;
}

const STEPS = [
  { id: 1, label: 'Date & Guests', icon: Calendar },
  { id: 2, label: 'Pickup', icon: MapPin },
  { id: 3, label: 'Extras', icon: Sparkles },
  { id: 4, label: 'Guest Details', icon: User },
  { id: 5, label: 'Review', icon: CheckSquare },
  { id: 6, label: 'Payment', icon: Lock },
];

export const BookingPage: React.FC<BookingPageProps> = ({
  tours,
  initialTourSlug,
  currency,
  onBookingSuccess,
  onNavigate,
}) => {
  const { showToast } = useToast();
  const { language } = useLanguage();
  const requestedCustomerLocale = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('customer_locale') : null;
  const customerLocale = requestedCustomerLocale && ['en', 'de', 'it', 'ro', 'ru', 'fr', 'es', 'nl', 'pl', 'pt'].includes(requestedCustomerLocale) ? requestedCustomerLocale : language;

  // Find current tour or fallback
  const [selectedTourSlug, setSelectedTourSlug] = useState<string>(
    initialTourSlug || (tours.length > 0 ? tours[0].slug : '')
  );

  const currentTour = useMemo(() => {
    return (
      tours.find((t) => t.slug === selectedTourSlug) ||
      tours.find((t) => t.id === selectedTourSlug) ||
      tours[0]
    );
  }, [tours, selectedTourSlug]);

  // Load persisted draft
  const initialDraft = useMemo(() => {
    return loadBookingDraft(currentTour?.slug);
  }, [currentTour?.slug]);

  const [currentStep, setCurrentStep] = useState<number>(initialDraft.currentStep || 1);
  const bookingAnalyticsStarted = useRef(false);
  const previousBookingStep = useRef<number | null>(null);
  useEffect(() => {
    if (!bookingAnalyticsStarted.current) {
      bookingAnalyticsStarted.current = true;
      previousBookingStep.current = currentStep;
      void recordVisitorEvent({ event_name: 'booking_started', page_path: '/booking', event_data: { tour_slug: currentTour?.slug || 'unknown' } });
      void recordVisitorEvent({ event_name: 'booking_step_viewed', page_path: '/booking', event_data: { tour_slug: currentTour?.slug || 'unknown', booking_step: currentStep } });
      return;
    }
    if (previousBookingStep.current !== null && previousBookingStep.current !== currentStep) {
      void recordVisitorEvent({ event_name: 'booking_step_completed', page_path: '/booking', event_data: { tour_slug: currentTour?.slug || 'unknown', booking_step: previousBookingStep.current } });
      void recordVisitorEvent({ event_name: 'booking_step_viewed', page_path: '/booking', event_data: { tour_slug: currentTour?.slug || 'unknown', booking_step: currentStep } });
      previousBookingStep.current = currentStep;
    }
  }, [currentStep, currentTour?.slug]);

  const [date, setDate] = useState<string>(initialDraft.date || '');
  const [selectedDepartureId, setSelectedDepartureId] = useState<string>(initialDraft.departureId || '');
  const [selectedDepartureTime, setSelectedDepartureTime] = useState<string>(initialDraft.departureTime || '');
  const handleDateChange = useCallback((nextDate: string) => {
    setDate(nextDate);
    setSelectedDepartureId('');
    setSelectedDepartureTime('');
  }, []);
  const handleDepartureChange = useCallback((departureId: string, departureTime: string) => {
    setSelectedDepartureId(departureId);
    setSelectedDepartureTime(departureTime);
  }, []);
  const [selectedTourLanguage, setSelectedTourLanguage] = useState<string>(initialDraft.selectedTourLanguage || currentTour?.languages?.[0] || 'English');
  const [guests, setGuests] = useState<GuestCounts>(initialDraft.guests);
  const [pickupLocationId, setPickupLocationId] = useState<string>(initialDraft.pickupLocationId || '');
  const [hotelName, setHotelName] = useState<string>(initialDraft.hotelName || '');
  const [roomNumber, setRoomNumber] = useState<string>(initialDraft.roomNumber || '');
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>(initialDraft.selectedExtraIds || []);
  const [customer, setCustomer] = useState<CustomerInfo>(initialDraft.customer);
  const [paymentMethod, setPaymentMethod] = useState<'pay_at_pickup' | 'pay_online'>(initialDraft.paymentMethod || 'pay_at_pickup');
  const [couponCode, setCouponCode] = useState<string>(initialDraft.couponCode || '');
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState<string>(
    initialDraft.idempotencyKey || `idem_${crypto.randomUUID()}`
  );
  const lastDraftFingerprint = useRef<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(initialDraft.termsAccepted || false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const options = Array.from(new Set((currentTour?.languages || []).map((language) => language.trim()).filter(Boolean)));
    const supported = options.length > 0 ? options : ['English'];
    setSelectedTourLanguage((current) => supported.includes(current) ? current : supported[0]);
  }, [currentTour?.slug, currentTour?.languages?.join('|')]);

  // Dynamic database-backed pickup locations & extras
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [pickupLocationsLoading, setPickupLocationsLoading] = useState(true);
  const [pickupLocationsError, setPickupLocationsError] = useState<string | null>(null);
  const [availableExtras, setAvailableExtras] = useState<BookingExtra[]>([]);
  const [extraQuantities, setExtraQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;
    async function loadEntities() {
      if (!currentTour) return;
      setPickupLocationsLoading(true);
      setPickupLocationsError(null);
      try {
        const [pickupResult, extrasResult] = await Promise.allSettled([
          getPublishedPickupLocations(currentTour.id),
          getPublishedTourExtras(currentTour.id || currentTour.slug),
        ]);
        if (isMounted) {
          if (pickupResult.status === 'fulfilled') {
            const locs = pickupResult.value;
            setPickupLocations(locs);
            if (currentTour.pickupAvailable) {
              if (locs.length === 0) {
                setPickupLocationId('');
                setPickupLocationsError('No active pickup zone has been explicitly approved for this tour.');
              } else {
                setPickupLocationId((current) => locs.some((location) => location.id === current) ? current : locs[0].id);
              }
            } else {
              setPickupLocationId('');
            }
          } else {
            console.warn('Could not verify approved pickup locations:', pickupResult.reason);
            setPickupLocations([]);
            setPickupLocationId('');
            setPickupLocationsError('We could not verify this excursion\'s approved pickup locations. Please contact our booking team.');
          }

          if (extrasResult.status === 'fulfilled') {
            const exts = extrasResult.value;
            setAvailableExtras(exts);
            // Deselect any extras not assigned to this tour
            setSelectedExtraIds((prev) => prev.filter((id) => exts.some((e) => e.id === id)));
          } else {
            console.warn('Could not load tour-specific extras:', extrasResult.reason);
            setAvailableExtras([]);
            setSelectedExtraIds([]);
          }
        }
      } finally {
        if (isMounted) setPickupLocationsLoading(false);
      }
    }
    loadEntities();

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const entity = customEvent.detail?.entity;
      if (!entity || entity === 'locations' || entity === 'extras') {
        loadEntities();
      }
    };
    window.addEventListener('rse_data_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('rse_data_updated', handleUpdate);
    };
  }, [currentTour?.slug, currentTour?.id, currentTour?.destination]);

  const draftFingerprint = useMemo(() => JSON.stringify({
    tourSlug: currentTour?.slug,
    date,
    selectedDepartureId,
    selectedDepartureTime,
    selectedTourLanguage,
    guests,
    pickupLocationId,
    hotelName,
    roomNumber,
    selectedExtraIds,
    extraQuantities,
    customer,
    paymentMethod,
    couponCode,
  }), [currentTour?.slug, date, selectedDepartureId, selectedDepartureTime, guests, pickupLocationId, hotelName, roomNumber, selectedExtraIds, extraQuantities, customer, paymentMethod, couponCode]);

  useEffect(() => {
    if (lastDraftFingerprint.current === null) {
      lastDraftFingerprint.current = draftFingerprint;
      return;
    }
    if (lastDraftFingerprint.current !== draftFingerprint) {
      lastDraftFingerprint.current = draftFingerprint;
      setCheckoutIdempotencyKey(`idem_${crypto.randomUUID()}`);
    }
  }, [draftFingerprint]);

  // Synchronize draft to sessionStorage
  useEffect(() => {
    if (!currentTour) return;
    const draft: BookingDraftState = {
      tourSlug: currentTour.slug,
      selectedTourLanguage,
      currentStep,
      date,
      departureId: selectedDepartureId,
      departureTime: selectedDepartureTime,
      guests,
      pickupLocationId,
      hotelName: hotelName || customer.hotelName || '',
      roomNumber: roomNumber || customer.roomNumber || '',
      selectedExtraIds,
      customer: {
        ...customer,
        hotelName: customer.hotelName || hotelName || '',
        roomNumber: customer.roomNumber || roomNumber || '',
      },
      paymentMethod,
      termsAccepted,
      idempotencyKey: checkoutIdempotencyKey,
      couponCode,
    };
    saveBookingDraft(draft);
  }, [
    currentTour,
    currentStep,
    date,
    selectedDepartureId,
    selectedDepartureTime,
    selectedTourLanguage,
    guests,
    pickupLocationId,
    hotelName,
    roomNumber,
    selectedExtraIds,
    customer,
    paymentMethod,
    termsAccepted,
    checkoutIdempotencyKey,
    couponCode,
  ]);

  // Selected pickup object
  const selectedPickup = useMemo(() => {
    return pickupLocations.find((p) => p.id === pickupLocationId);
  }, [pickupLocations, pickupLocationId]);

  // Selected extras objects
  const selectedExtras = useMemo(() => {
    return availableExtras.filter((e) => selectedExtraIds.includes(e.id));
  }, [availableExtras, selectedExtraIds]);

  // Pricing calculation via dedicated engine
  const pricing = useMemo(() => {
    if (!currentTour) {
      return calculateBookingPrice({
        tour: tours[0],
        guests,
        pickupLocation: selectedPickup,
        selectedExtras: [],
        currency,
      });
    }
    return calculateBookingPrice({
      tour: currentTour,
      guests,
      pickupLocation: selectedPickup,
      selectedExtras: selectedExtras.map((e) => ({
        extra: e,
        quantity: extraQuantities[e.id] || 1,
      })),
      currency,
    });
  }, [currentTour, tours, guests, selectedPickup, selectedExtras, extraQuantities, currency]);

  const handleToggleExtra = (extraId: string) => {
    setSelectedExtraIds((prev) =>
      prev.includes(extraId) ? prev.filter((id) => id !== extraId) : [...prev, extraId]
    );
  };

  const handleUpdateQuantity = (extraId: string, quantity: number) => {
    setExtraQuantities((prev) => ({
      ...prev,
      [extraId]: quantity,
    }));
  };

  const handleHotelNameChange = (name: string) => {
    setHotelName(name);
    setCustomer((prev) => ({ ...prev, hotelName: name }));
  };

  const handleCustomerChange = (newCustomer: CustomerInfo) => {
    setCustomer(newCustomer);
    if (newCustomer.hotelName && newCustomer.hotelName !== hotelName) {
      setHotelName(newCustomer.hotelName);
    }
    if (newCustomer.roomNumber && newCustomer.roomNumber !== roomNumber) {
      setRoomNumber(newCustomer.roomNumber);
    }
  };

  const handleConfirmBooking = async () => {
    if (!currentTour) return;
    if (!selectedDepartureId || !selectedDepartureTime) {
      setCurrentStep(1);
      showToast('Please select a confirmed departure time before continuing.', 'error');
      return;
    }
    if (currentTour.pickupAvailable && (!selectedPickup || !pickupLocations.some((location) => location.id === selectedPickup.id))) {
      setCurrentStep(2);
      return;
    }
    setIsSubmitting(true);

    try {
      const ref = generateBookingReference(date);
      const payingGuests = (guests.adults || 1) + (guests.children || 0);
      const effectiveHotel = customer.hotelName || hotelName || '';
      const effectiveRoom = customer.roomNumber || roomNumber || '';

      const newBooking: Booking = {
        bookingId: `b-${Date.now()}`,
        bookingReference: ref,
        idempotencyKey: checkoutIdempotencyKey,
        couponCode: couponCode.trim() || undefined,
        tourId: currentTour.id,
        tourSlug: currentTour.slug,
        tourTitle: currentTour.title,
        tourImage: currentTour.primaryImage,
        tourDestination: currentTour.destination,
        tourDuration: currentTour.durationLabel,
        tourLanguage: selectedTourLanguage,
        customerLocale,
        date,
        departureId: selectedDepartureId,
        departureTime: selectedDepartureTime,
        guests,
        pickup: {
          locationId: selectedPickup?.id,
          locationName: selectedPickup?.name || 'No pickup service',
          area: selectedPickup?.area || '',
          feeEur: selectedPickup?.feeEurPerPerson || 0,
          hotelName: effectiveHotel,
          roomNumber: effectiveRoom,
        },
        extras: selectedExtras.map((e) => {
          const qty = extraQuantities[e.id] || 1;
          const amountEur = e.pricingType === 'per_person'
            ? e.priceEur * payingGuests * qty
            : e.pricingType === 'per_adult'
            ? e.priceEur * (guests.adults || 1) * qty
            : e.pricingType === 'per_child'
            ? e.priceEur * (guests.children || 0) * qty
            : e.priceEur * qty;
          return {
            extraId: e.id,
            name: e.name,
            priceEur: e.priceEur,
            pricingType: e.pricingType,
            quantity: qty,
            amountEur,
          };
        }),
        customer: {
          ...customer,
          hotelName: effectiveHotel,
          roomNumber: effectiveRoom,
        },
        pricing,
        paymentMethod,
        paymentStatus: 'pending',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await bookingRepository.createBooking(newBooking);
      void recordVisitorEvent({ event_name: 'booking_submitted', page_path: '/booking', event_data: { tour_slug: currentTour?.slug || 'unknown', booking_step: currentStep } });
      clearBookingDraft();
      // The database transaction has already enqueued booking.created in the durable
      // booking notification queue. The server worker sends the email asynchronously.
      void recordVisitorEvent({ event_name: 'booking_confirmed', page_path: '/booking', event_data: { tour_slug: currentTour?.slug || 'unknown' } });
      showToast('Reservation submitted successfully!', 'success');
      onBookingSuccess(newBooking);
    } catch (err: any) {
      console.error('Failed to save booking:', err);
      showToast(err.message || 'An error occurred while confirming your reservation. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#FAF8F5] min-h-screen">
      {/* Top Stepper Navigation */}
      <div className="bg-white border-b border-[#E8E3DA] sticky top-16 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          
          {/* Desktop Stepper */}
          <div className="hidden md:flex items-center justify-between">
            {STEPS.map((s, idx) => {
              const isCurrent = currentStep === s.id;
              const isCompleted = currentStep > s.id;
              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCompleted) setCurrentStep(s.id);
                    }}
                    className={`flex items-center space-x-2 text-xs font-semibold py-1.5 px-2 rounded transition-all text-left w-full ${
                      isCurrent
                        ? 'text-[#0A6C74] font-bold border-b-2 border-[#0A6C74]'
                        : isCompleted
                        ? 'text-stone-700 hover:text-stone-900 cursor-pointer'
                        : 'text-stone-400 cursor-not-allowed'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 transition-colors ${
                        isCurrent
                          ? 'bg-[#0A6C74] text-white'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.id}
                    </div>
                    <span className="truncate">{s.label}</span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-stone-300 mx-1 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile Step Progress Indicator */}
          <div className="md:hidden flex items-center space-x-2 pt-1">
            <div className="flex-1 bg-stone-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#0A6C74] h-full transition-all duration-300"
                style={{ width: `${(currentStep / 6) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold text-stone-800 shrink-0">
              {STEPS[currentStep - 1]?.label} ({currentStep}/6)
            </span>
          </div>

        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Header Title */}
        <div className="mb-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6C74]">
            Direct Vessel Reservation
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0E1B2A] tracking-tight">
            Reserve Your Excursion
          </h1>
        </div>
        {customerLocale !== language && <p role="status" aria-live="polite" className="mb-5 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          The booking form is currently in English. Your booking confirmation and customer emails will use your selected language ({customerLocale.toUpperCase()}).
        </p>}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Active Step Flow (7 cols on desktop) */}
          <div className="lg:col-span-7 xl:col-span-8 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="space-y-6"
              >
                {/* Step 1: Date & Guests */}
                {currentStep === 1 && (
                  <StepDateGuests
                    tour={currentTour}
                    date={date}
                    onDateChange={handleDateChange}
                    selectedDepartureId={selectedDepartureId}
                    onDepartureChange={handleDepartureChange}
                    tourLanguage={selectedTourLanguage}
                    onTourLanguageChange={setSelectedTourLanguage}
                    guests={guests}
                    onGuestsChange={setGuests}
                    currency={currency}
                    onNext={() => setCurrentStep(2)}
                  />
                )}

                {/* Step 2: Pickup Location */}
                {currentStep === 2 && (
                  <StepPickup
                    selectedPickupId={pickupLocationId}
                    onSelectPickup={(loc) => setPickupLocationId(loc.id)}
                    hotelName={hotelName}
                    onHotelNameChange={handleHotelNameChange}
                    currency={currency}
                    locations={pickupLocations}
                    pickupAvailable={currentTour?.pickupAvailable !== false}
                    loading={pickupLocationsLoading}
                    error={pickupLocationsError}
                    onNext={() => setCurrentStep(3)}
                    onBack={() => setCurrentStep(1)}
                  />
                )}

                {/* Step 3: Optional Extras */}
                {currentStep === 3 && (
                  <StepExtras
                    selectedExtraIds={selectedExtraIds}
                    onToggleExtra={handleToggleExtra}
                    currency={currency}
                    extras={availableExtras}
                    extraQuantities={extraQuantities}
                    onUpdateQuantity={handleUpdateQuantity}
                    onNext={() => setCurrentStep(4)}
                    onBack={() => setCurrentStep(2)}
                  />
                )}

                {/* Step 4: Lead Customer Contact */}
                {currentStep === 4 && (
                  <StepCustomerInfo
                    customer={customer}
                    onCustomerChange={handleCustomerChange}
                    onNext={() => setCurrentStep(5)}
                    onBack={() => setCurrentStep(3)}
                    onNavigateLogin={() => onNavigate('login')}
                  />
                )}

                {/* Step 5: Review Booking */}
                {currentStep === 5 && (
                  <StepReview
                    tour={currentTour}
                    date={date}
                    departureTime={selectedDepartureTime}
                    tourLanguage={selectedTourLanguage}
                    guests={guests}
                    pickupLocation={selectedPickup}
                    hotelName={hotelName}
                    selectedExtras={selectedExtras}
                    customer={customer}
                    pricing={pricing}
                    currency={currency}
                    onGoToStep={(step) => setCurrentStep(step)}
                    onNext={() => setCurrentStep(6)}
                    onBack={() => setCurrentStep(4)}
                  />
                )}

                {/* Step 6: Payment Method & Terms */}
                {currentStep === 6 && (
                  <StepPayment
                    pricing={pricing}
                    couponCode={couponCode}
                    onCouponCodeChange={setCouponCode}
                    currency={currency}
                    paymentMethod={paymentMethod}
                    onPaymentMethodChange={setPaymentMethod}
                    termsAccepted={termsAccepted}
                    onTermsAcceptedChange={setTermsAccepted}
                    isSubmitting={isSubmitting}
                    onSubmitBooking={handleConfirmBooking}
                    onBack={() => setCurrentStep(5)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Column: Sticky Booking Summary (5 cols on desktop) */}
          <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-36 space-y-4">
            <BookingSummary
              tour={currentTour}
              date={date}
              departureTime={selectedDepartureTime}
              tourLanguage={selectedTourLanguage}
              guests={guests}
              pickupLocation={selectedPickup}
              hotelName={hotelName}
              selectedExtras={selectedExtras}
              pricing={pricing}
              currency={currency}
            />

            {/* Direct Operator Security Box */}
            <div className="p-4 bg-white rounded-lg border border-[#E8E3DA] text-xs space-y-2">
              <div className="flex items-center text-emerald-700 font-bold">
                <ShieldCheck className="w-4 h-4 mr-1.5" />
                <span>Operator Direct Guarantee</span>
              </div>
              <p className="text-stone-600 text-[11px] leading-relaxed">
                Reservations are transmitted directly to the booking operations team. Free cancellation up to 24 hours prior.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
