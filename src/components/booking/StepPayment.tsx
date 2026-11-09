import React, { useState } from 'react';
import { 
  CreditCard, 
  Banknote, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  ExternalLink,
  Info,
  Clock
} from 'lucide-react';
import { CurrencyConfig } from '../../types';
import { BookingPricing, PaymentMethod } from '../../types/booking';
import { APP_CONFIG } from '../../config/appConfig';
import { BOOKING_LEGAL_TERMS } from '../../data/bookingData';

interface StepPaymentProps {
  pricing: BookingPricing;
  currency: CurrencyConfig;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  termsAccepted: boolean;
  onTermsAcceptedChange: (accepted: boolean) => void;
  isSubmitting: boolean;
  onSubmitBooking: () => void;
  onBack: () => void;
}

export const StepPayment: React.FC<StepPaymentProps> = ({
  pricing,
  currency,
  paymentMethod,
  onPaymentMethodChange,
  termsAccepted,
  onTermsAcceptedChange,
  isSubmitting,
  onSubmitBooking,
  onBack,
}) => {
  const [showTermsModal, setShowTermsModal] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-5 space-y-4">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-[#0E1B2A] flex items-center">
            <Lock className="w-4 h-4 mr-2 text-[#0A6C74]" />
            Payment Method
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            Choose how you want to pay. You do not need to pay anything today.
          </p>
        </div>

        {/* Payment Options Grid */}
        <div className="grid grid-cols-1 gap-3.5 pt-1">
          
          {/* Pay on Hotel Pickup (Active Option) */}
          <div
            onClick={() => onPaymentMethodChange('pay_at_pickup')}
            className={`p-4 rounded-sm border cursor-pointer transition-all ${
              paymentMethod === 'pay_at_pickup'
                ? 'border-[#0A6C74] bg-[#E8F3F4]/50 ring-1 ring-[#0A6C74]'
                : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50 bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-sm bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-stone-900 text-sm">
                      Pay on Hotel Pickup
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    Pay in cash (EUR, USD, GBP, or EGP) or by card when we pick you up at your hotel. No deposit needed now.
                  </p>
                </div>
              </div>

              <div className="shrink-0 ml-3">
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    paymentMethod === 'pay_at_pickup'
                      ? 'border-[#0A6C74] bg-[#0A6C74]'
                      : 'border-stone-300 bg-white'
                  }`}
                >
                  {paymentMethod === 'pay_at_pickup' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-stone-200/70 flex items-center text-[11px] text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600 shrink-0" />
              <span>Instant booking confirmation. Free cancellation up to 24 hours before pickup.</span>
            </div>
          </div>

          {/* Pay Online (Gateway Coming Soon) */}
          <div className="p-4 rounded-sm border border-stone-200 bg-stone-50/80 opacity-85">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-sm bg-stone-200 text-stone-500 flex items-center justify-center shrink-0 mt-0.5">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-stone-700 text-sm">
                      Pay Online via Credit / Debit Card
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 bg-stone-200 px-1.5 py-0.5 rounded">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    {APP_CONFIG.PAYMENT_SETTINGS.ONLINE_PAYMENT_NOTICE}
                  </p>
                </div>
              </div>

              <div className="shrink-0 ml-3">
                <div className="w-5 h-5 rounded-full border border-stone-300 bg-stone-100 cursor-not-allowed" />
              </div>
            </div>
          </div>

        </div>

        {/* Free cancellation recap */}
        <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-sm text-xs text-emerald-900 flex items-start space-x-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">Free 24-hour cancellation</span>
            <p className="text-[11px] text-emerald-800 leading-normal">
              Plans change? Cancel or change your date up to 24 hours before pickup at no cost.
            </p>
          </div>
        </div>

        {/* Terms and Conditions Checkbox */}
        <div className="pt-3 border-t border-stone-200 space-y-3">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={termsAccepted}
              onChange={(e) => onTermsAcceptedChange(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-[#0A6C74] focus:ring-[#0A6C74] border-stone-300 cursor-pointer"
            />
            <span className="text-xs text-stone-700 leading-relaxed">
              I agree to the{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowTermsModal(true);
                }}
                className="text-[#0A6C74] font-semibold underline hover:text-[#08565C]"
              >
                Terms & Conditions
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowTermsModal(true);
                }}
                className="text-[#0A6C74] font-semibold underline hover:text-[#08565C]"
              >
                Cancellation Policy
              </button>
              . I understand that payment will be collected in cash or card upon hotel pickup.
            </span>
          </label>
        </div>

      </div>

      {/* Navigation & Submit CTA */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onBack}
          className="px-5 py-2.5 border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs sm:text-sm font-semibold rounded-sm transition-colors flex items-center space-x-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          disabled={!termsAccepted || isSubmitting}
          onClick={onSubmitBooking}
          className="px-8 py-3.5 bg-[#0A6C74] hover:bg-[#08565C] disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-sm transition-all shadow-md flex items-center justify-center space-x-2"
        >
          {isSubmitting ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Confirming your booking...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span>Confirm Booking ({pricing.formattedTotal})</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
        </button>
      </div>

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-sm border border-[#E8E3DA] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-stone-200 bg-[#FAF8F5] flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-[#0E1B2A]">
                {BOOKING_LEGAL_TERMS.title}
              </h3>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="text-stone-400 hover:text-stone-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-stone-600">
              <p className="text-[11px] text-stone-400">Last updated: {BOOKING_LEGAL_TERMS.lastUpdated}</p>
              {BOOKING_LEGAL_TERMS.sections.map((sec, idx) => (
                <div key={idx} className="space-y-1">
                  <h4 className="font-bold text-stone-800 text-xs">{sec.heading}</h4>
                  <p className="leading-relaxed">{sec.text}</p>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onTermsAcceptedChange(true);
                  setShowTermsModal(false);
                }}
                className="px-5 py-2 bg-[#0A6C74] text-white text-xs font-semibold rounded-sm hover:bg-[#08565C]"
              >
                I Understand & Accept
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
