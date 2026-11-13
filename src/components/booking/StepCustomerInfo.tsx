import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Globe, 
  Building, 
  MessageSquare, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle,
  Sparkles,
  CheckCircle2,
  LogIn
} from 'lucide-react';
import { CustomerInfo } from '../../types/booking';
import { COUNTRY_DIAL_CODES } from '../../data/bookingData';
import { CountrySelect } from '../common/CountrySelect';
import { isValidEmail, isValidPhoneNumber, sanitizeString, sanitizeTextPreservingWhitespace } from '../../lib/security';
import { useAuth } from '../../contexts/AuthContext';

interface StepCustomerInfoProps {
  customer: CustomerInfo;
  onCustomerChange: (customer: CustomerInfo) => void;
  onNext: () => void;
  onBack: () => void;
  onNavigateLogin?: () => void;
}

export const StepCustomerInfo: React.FC<StepCustomerInfoProps> = ({
  customer,
  onCustomerChange,
  onNext,
  onBack,
  onNavigateLogin,
}) => {
  const { user } = useAuth();
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Auto-populate from logged-in user profile if fields are blank
  useEffect(() => {
    if (user && !customer.email) {
      const parts = (user.fullName || '').trim().split(' ');
      const first = parts[0] || '';
      const last = parts.slice(1).join(' ') || '';
      onCustomerChange({
        ...customer,
        firstName: customer.firstName || first,
        lastName: customer.lastName || last,
        email: customer.email || user.email,
        phoneNumber: customer.phoneNumber || user.phoneNumber || '',
        countryCode: customer.countryCode || user.countryCode || '+20',
        country: customer.country || user.country || 'Germany',
      });
    }
  }, [user]);

  const errors = {
    firstName: !customer.firstName.trim() ? 'Please enter your first name.' : '',
    lastName: !customer.lastName.trim() ? 'Please enter your last name.' : '',
    email: !customer.email.trim()
      ? 'Please enter your email address.'
      : !isValidEmail(customer.email)
      ? 'Please enter a valid email address.'
      : '',
    phoneNumber: !customer.phoneNumber.trim()
      ? 'Please enter your phone number.'
      : !isValidPhoneNumber(customer.phoneNumber)
      ? 'Please enter a valid phone number with dial code.'
      : '',
    country: !customer.country.trim() ? 'Please select your country.' : '',
  };

  const isValid = !errors.firstName && !errors.lastName && !errors.email && !errors.phoneNumber && !errors.country;

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleChange = (field: keyof CustomerInfo, value: string) => {
    onCustomerChange({
      ...customer,
      [field]: field === 'specialRequests' ? sanitizeTextPreservingWhitespace(value) : sanitizeString(value),
    });
  };

  const handleCountryDialSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const found = COUNTRY_DIAL_CODES.find((c) => c.dial === e.target.value);
    onCustomerChange({
      ...customer,
      countryCode: e.target.value,
      country: found ? found.country : customer.country,
    });
  };

  const handleSubmitAttempt = () => {
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      country: true,
    });

    if (isValid) {
      onNext();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Guest vs Logged-In User Banner */}
      {user ? (
        <div className="bg-[#E8F3F4] border border-[#0A6C74]/30 rounded-sm p-4 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#0A6C74] shrink-0" />
            <div>
              <span className="font-bold text-[#0E1B2A]">Logged in as {user.fullName}</span>
              <span className="text-stone-600 block text-[11px]">
                This reservation will be automatically linked to your account ({user.email}).
              </span>
            </div>
          </div>
          <span className="text-[10px] text-stone-500 hidden sm:inline">
            You may adjust details below if reserving for someone else.
          </span>
        </div>
      ) : (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-sm p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-emerald-950">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold text-emerald-900">Booking as Guest (No Account Required)</span>
              <span className="text-emerald-800 block text-[11px]">
                You can complete your reservation directly below. Vouchers & driver alerts go to your email & WhatsApp.
              </span>
            </div>
          </div>
          {onNavigateLogin && (
            <button
              type="button"
              onClick={onNavigateLogin}
              className="px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded font-semibold text-[11px] shrink-0 flex items-center space-x-1 cursor-pointer"
            >
              <LogIn className="w-3 h-3 text-emerald-700" />
              <span>Sign In to Autofill</span>
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-[#E8E3DA] rounded-sm p-5 space-y-4">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-[#0E1B2A] flex items-center">
            <User className="w-4 h-4 mr-2 text-[#0A6C74]" />
            Your Contact Details
          </h2>
          <p className="text-xs text-stone-600 mt-1">
            We will send your booking confirmation and pickup details to this email and phone number.
          </p>
        </div>

        {/* First & Last Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="first-name" className="block text-xs font-bold text-stone-800 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              id="first-name"
              type="text"
              required
              value={customer.firstName}
              onBlur={() => handleBlur('firstName')}
              onChange={(e) => handleChange('firstName', e.target.value)}
              placeholder="e.g. Marcus"
              className={`w-full px-3.5 py-2.5 rounded border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6C74] ${
                touched.firstName && errors.firstName
                  ? 'border-red-400 bg-red-50/40'
                  : 'border-stone-300 bg-stone-50/50'
              }`}
            />
            {touched.firstName && errors.firstName && (
              <span className="text-[11px] text-red-600 mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
                {errors.firstName}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="last-name" className="block text-xs font-bold text-stone-800 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              id="last-name"
              type="text"
              required
              value={customer.lastName}
              onBlur={() => handleBlur('lastName')}
              onChange={(e) => handleChange('lastName', e.target.value)}
              placeholder="e.g. Weber"
              className={`w-full px-3.5 py-2.5 rounded border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6C74] ${
                touched.lastName && errors.lastName
                  ? 'border-red-400 bg-red-50/40'
                  : 'border-stone-300 bg-stone-50/50'
              }`}
            />
            {touched.lastName && errors.lastName && (
              <span className="text-[11px] text-red-600 mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
                {errors.lastName}
              </span>
            )}
          </div>
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-xs font-bold text-stone-800 mb-1 flex items-center">
              <Mail className="w-3.5 h-3.5 mr-1 text-[#0A6C74]" />
              Email Address <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={customer.email}
              onBlur={() => handleBlur('email')}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="e.g. markus.weber@example.com"
              className={`w-full px-3.5 py-2.5 rounded border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6C74] ${
                touched.email && errors.email
                  ? 'border-red-400 bg-red-50/40'
                  : 'border-stone-300 bg-stone-50/50'
              }`}
            />
            {touched.email && errors.email ? (
              <span className="text-[11px] text-red-600 mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
                {errors.email}
              </span>
            ) : (
              <span className="text-[10px] text-stone-500 mt-1 block">
                Your PDF confirmation voucher is dispatched here.
              </span>
            )}
          </div>

          {/* WhatsApp / Phone with Dial Selector */}
          <div>
            <label htmlFor="phone-number" className="block text-xs font-bold text-stone-800 mb-1 flex items-center">
              <Phone className="w-3.5 h-3.5 mr-1 text-[#0A6C74]" />
              WhatsApp / Mobile Phone <span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="flex space-x-2">
              <select
                aria-label="Country dial code"
                value={customer.countryCode || '+20'}
                onChange={handleCountryDialSelect}
                className="w-28 px-2 py-2.5 rounded border border-stone-300 text-xs bg-stone-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#0A6C74]"
              >
                {COUNTRY_DIAL_CODES.map((c) => (
                  <option key={c.code} value={c.dial}>
                    {c.flag} {c.dial} ({c.code})
                  </option>
                ))}
              </select>

              <input
                id="phone-number"
                type="tel"
                required
                value={customer.phoneNumber}
                onBlur={() => handleBlur('phoneNumber')}
                onChange={(e) => handleChange('phoneNumber', e.target.value)}
                placeholder="170 1234567"
                className={`flex-1 px-3.5 py-2.5 rounded border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0A6C74] ${
                  touched.phoneNumber && errors.phoneNumber
                    ? 'border-red-400 bg-red-50/40'
                    : 'border-stone-300 bg-stone-50/50'
                }`}
              />
            </div>
            {touched.phoneNumber && errors.phoneNumber ? (
              <span className="text-[11px] text-red-600 mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
                {errors.phoneNumber}
              </span>
            ) : (
              <span className="text-[10px] text-stone-500 mt-1 block">
                Pier drivers use WhatsApp for live lobby arrival alerts.
              </span>
            )}
          </div>

        </div>

        {/* Hotel / Accommodation Name for Lobby Pickup */}
        <div>
          <label htmlFor="customer-hotel-name" className="block text-xs font-bold text-stone-800 mb-1 flex items-center">
            <Building className="w-3.5 h-3.5 mr-1 text-[#0A6C74]" />
            Hotel / Accommodation Name
          </label>
          <input
            id="customer-hotel-name"
            type="text"
            value={customer.hotelName || ''}
            onChange={(e) => handleChange('hotelName', e.target.value)}
            placeholder="e.g. Steigenberger ALDAU Beach Hotel, Desert Rose Resort, etc."
            className="w-full px-3.5 py-2.5 rounded border border-stone-300 text-xs sm:text-sm bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-[#0A6C74]"
          />
          <span className="text-[10px] text-stone-500 mt-1 block">
            Our private/group transfer driver meets you directly in your hotel reception lobby.
          </span>
        </div>

        {/* Country of Residence & Room Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="country" className="block text-xs font-bold text-stone-800 mb-1 flex items-center">
              <Globe className="w-3.5 h-3.5 mr-1 text-[#0A6C74]" />
              Country of Residence <span className="text-red-500 ml-0.5">*</span>
            </label>
            <CountrySelect
              id="country"
              value={customer.country}
              required
              onChange={(value) => { handleChange('country', value); handleBlur('country'); }}
              placeholder="Select your country of residence"
              className={`w-full px-3.5 py-2.5 rounded border text-xs sm:text-sm bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-[#0A6C74] ${
                touched.country && errors.country ? 'border-red-400 bg-red-50/40' : 'border-stone-300'
              }`}
            />
            {touched.country && errors.country && (
              <span className="text-[11px] text-red-600 mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
                {errors.country}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="room-number" className="block text-xs font-bold text-stone-800 mb-1 flex items-center">
              <Building className="w-3.5 h-3.5 mr-1 text-stone-400" />
              Room Number (Optional)
            </label>
            <input
              id="room-number"
              type="text"
              value={customer.roomNumber || ''}
              onChange={(e) => handleChange('roomNumber', e.target.value)}
              placeholder="e.g. Room 412 (can provide later)"
              className="w-full px-3.5 py-2.5 rounded border border-stone-300 text-xs sm:text-sm bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-[#0A6C74]"
            />
            <span className="text-[10px] text-stone-500 mt-1 block">
              Helps hotel concierge page your room if you're not in the lobby.
            </span>
          </div>
        </div>

        {/* Special Requests */}
        <div className="pt-2 border-t border-stone-200">
          <label htmlFor="special-requests" className="block text-xs font-bold text-stone-800 mb-1 flex items-center">
            <MessageSquare className="w-3.5 h-3.5 mr-1 text-stone-400" />
            Special Requests & Dietary Requirements (Optional)
          </label>
          <textarea
            id="special-requests"
            rows={2}
            value={customer.specialRequests || ''}
            onChange={(e) => handleChange('specialRequests', e.target.value)}
            placeholder="e.g. Vegetarian meal on boat, celebrating honeymoon/birthday, non-swimmer in party..."
            className="w-full px-3.5 py-2 rounded border border-stone-300 text-xs bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-[#0A6C74]"
          />
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
          onClick={handleSubmitAttempt}
          className="px-7 py-3 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs sm:text-sm font-semibold rounded-sm transition-colors shadow-xs flex items-center space-x-2"
        >
          <span>Review Booking</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
