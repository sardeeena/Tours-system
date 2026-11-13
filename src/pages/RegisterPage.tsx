import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Phone, 
  Globe, 
  CheckCircle2, 
  ArrowRight, 
  AlertCircle, 
  ShieldCheck, 
  Sparkles, 
  ArrowLeft,
  MailCheck,
  Send,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { COUNTRY_DIAL_CODES } from '../data/bookingData';
import { CountrySelect } from '../components/common/CountrySelect';
import { isValidEmail, validatePasswordStrength, sanitizeString, authRateLimiter, sanitizeRedirectUrl } from '../lib/security';

interface RegisterPageProps {
  redirectUrl?: string;
  onNavigate: (page: string, param?: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ redirectUrl, onNavigate }) => {
  const { signUp, resendConfirmation, confirmEmail } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+20');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState('Egypt');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Email confirmation pending state
  const [isPendingConfirmation, setIsPendingConfirmation] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [testToken, setTestToken] = useState<string | undefined>(undefined);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [isConfirmingDev, setIsConfirmingDev] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const limit = authRateLimiter.check();
    if (limit.isLocked) {
      setErrorMessage(`Too many registration attempts. Please wait ${limit.remainingSeconds} seconds.`);
      return;
    }

    const cleanName = sanitizeString(fullName);
    const cleanEmail = sanitizeString(email).toLowerCase();
    const cleanPhone = sanitizeString(phoneNumber);

    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('Please enter your full legal name.');
      return;
    }

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const strength = validatePasswordStrength(password);
    if (!strength.isValid) {
      setErrorMessage(strength.errors[0] || 'Password does not meet security requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUp({
        fullName: cleanName,
        email: cleanEmail,
        password,
        countryCode,
        phoneNumber: cleanPhone,
        country: country.trim(),
      });

      if (result.success) {
        authRateLimiter.reset();
        setIsPendingConfirmation(true);
        setConfirmedEmail(cleanEmail);
        setTestToken(result.confirmationToken);
        showToast('Confirmation email sent. Please check your inbox.', 'info', 6000);
      } else {
        authRateLimiter.recordFailedAttempt();
        console.warn('Registration failed:', result.error);
        setErrorMessage('We could not complete your registration. Please check your details and try again.');
      }
    } catch {
      authRateLimiter.recordFailedAttempt();
      setErrorMessage('An unexpected error occurred during registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      const res = await resendConfirmation(confirmedEmail);
      if (res.success) {
        showToast('Confirmation email sent. Please check your inbox.', 'success');
        setResendCooldown(45);
      } else {
        showToast('We could not resend the confirmation email. Please try again.', 'error');
      }
    } catch {
      showToast('Error resending email. Please try again later.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  const handleDevConfirm = async () => {
    setIsConfirmingDev(true);
    try {
      const res = await confirmEmail(confirmedEmail, testToken);
      if (res.success) {
        showToast('Email verified successfully! You can now sign in.', 'success');
        onNavigate('login', `?confirmed=true&email=${encodeURIComponent(confirmedEmail)}`);
      } else {
        showToast('We could not verify your email. Please open the latest confirmation link and try again.', 'error');
      }
    } catch {
      showToast('Failed to verify token.', 'error');
    } finally {
      setIsConfirmingDev(false);
    }
  };

  // =========================================================================
  // VIEW: PENDING EMAIL CONFIRMATION SCREEN
  // =========================================================================
  if (isPendingConfirmation) {
    return (
      <div className="min-h-[calc(100vh-160px)] bg-[#FAF8F5] py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
        <div className="max-w-md w-full mx-auto space-y-6">
          
          <div className="bg-white border border-[#E8E3DA] rounded-2xl shadow-sm p-6 sm:p-8 text-center space-y-5">
            {/* Animated Email Icon */}
            <div className="w-16 h-16 rounded-2xl bg-[#E8F3F4] text-[#0A6C74] flex items-center justify-center mx-auto border border-[#0A6C74]/30 shadow-xs">
              <MailCheck className="w-8 h-8 text-[#0A6C74]" />
            </div>

            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold uppercase tracking-wider">
                Confirmation Required
              </span>
              <h1 className="font-display text-2xl font-bold text-[#0E1B2A]">
                Check Your Email
              </h1>
              <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
                We've sent a verification link to{' '}
                <span className="font-bold text-[#0E1B2A] break-all">{confirmedEmail}</span>.
              </p>
            </div>

            {/* Instruction Callout */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-left space-y-2.5 text-xs text-stone-700">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Account Activation:</strong> Your account will only be confirmed and activated after you click the confirmation link in the email.
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Spam Folder:</strong> If you do not see the email in your main inbox within 2 minutes, please inspect your spam or junk folder.
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Guest Access:</strong> You can still book any excursion directly as a guest at any time without waiting for confirmation.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isResending}
                className="w-full py-2.5 px-4 border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                <span>
                  {resendCooldown > 0 
                    ? `Resend Email in ${resendCooldown}s` 
                    : isResending 
                      ? 'Sending...' 
                      : 'Resend Confirmation Email'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('login', `?email=${encodeURIComponent(confirmedEmail)}`)}
                className="w-full py-2.5 px-4 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center space-x-1 shadow-xs cursor-pointer"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Assistance note */}
            <div className="pt-3 border-t border-stone-100 text-center">
              <p className="text-[11px] text-stone-500">
                Did not receive the verification email? Make sure to inspect your spam or junk folder, or click <strong>Resend Confirmation Email</strong> above.
              </p>
            </div>

          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => onNavigate('booking')}
              className="text-xs text-stone-500 hover:text-stone-800 underline underline-offset-2 cursor-pointer"
            >
              Continue to Excursion Booking as Guest
            </button>
          </div>

        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: REGISTRATION FORM SCREEN
  // =========================================================================
  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#FAF8F5] py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-2xl w-full mx-auto space-y-6">
        
        {/* Prominent Visitor Booking Reassurance Callout */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:p-5 flex items-start space-x-3.5 shadow-2xs">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 text-xs">
            <h3 className="font-bold text-emerald-950 text-sm">Visitors do NOT need to create an account to book!</h3>
            <p className="text-emerald-800 mt-1">
              You can make a direct excursion reservation in under 2 minutes with no password or registration needed.
              We send your vouchers and pickup timing directly to your email and WhatsApp.
            </p>
            <div className="mt-3 flex items-center space-x-4">
              <button
                type="button"
                onClick={() => onNavigate('booking')}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded text-xs transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <span>Continue as Guest to Book</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('excursions')}
                className="text-emerald-900 hover:underline font-semibold text-xs cursor-pointer"
              >
                Browse Excursion Fleet
              </button>
            </div>
          </div>
        </div>

        {/* Registration Card */}
        <div className="bg-white border border-[#E8E3DA] rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
          
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center mx-auto mb-2">
              <img 
                src="/logo.png" 
                alt="Awesome Adventure Tours Logo" 
                className="h-16 w-auto object-contain drop-shadow-sm"
              />
            </div>
            <h1 className="font-display text-2xl font-bold text-[#0E1B2A]">Create Voyager Account</h1>
            <p className="text-xs text-stone-500">
              Join Awesome Adventure Tours for quick booking autofill, voucher downloads, and excursion archives
            </p>
            <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium">
              <Mail className="w-3 h-3 text-[#0A6C74]" />
              <span>Email confirmation link sent upon submission</span>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Full Name */}
            <div>
              <label htmlFor="reg-fullname" className="block text-xs font-bold text-stone-700 mb-1">
                Full Name (Passport / Travel Document) *
              </label>
              <div className="relative">
                <input
                  id="reg-fullname"
                  type="text"
                  required
                  placeholder="e.g. Captain Marcus Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0A6C74] focus:border-[#0A6C74] bg-stone-50/50"
                />
                <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="reg-email" className="block text-xs font-bold text-stone-700 mb-1">
                Email Address (Confirmation link will be sent here) *
              </label>
              <div className="relative">
                <input
                  id="reg-email"
                  type="email"
                  required
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0A6C74] focus:border-[#0A6C74] bg-stone-50/50"
                />
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                We'll send you a confirmation email. Your account will be ready after you verify your address.
              </p>
            </div>

            {/* Phone & Dial Code */}
            <div>
              <label htmlFor="reg-phone" className="block text-xs font-bold text-stone-700 mb-1">
                Mobile / WhatsApp Number (For Pier & Driver Alerts)
              </label>
              <div className="flex space-x-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-36 py-2 px-2 text-xs border border-stone-300 rounded-lg bg-stone-50/50 focus:outline-none focus:ring-1 focus:ring-[#0A6C74]"
                >
                  {COUNTRY_DIAL_CODES.map((c) => (
                    <option key={c.code} value={c.dial}>
                      {c.country} ({c.dial})
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <input
                    id="reg-phone"
                    type="tel"
                    placeholder="151 5212741"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0A6C74] focus:border-[#0A6C74] bg-stone-50/50"
                  />
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                </div>
              </div>
            </div>

            {/* Country of Residence */}
            <div>
              <label htmlFor="reg-country" className="block text-xs font-bold text-stone-700 mb-1">
                Country of Residence
              </label>
              <CountrySelect
                id="reg-country"
                value={country}
                onChange={setCountry}
                placeholder="Select your country of residence"
                className="w-full py-2 px-3 text-xs border border-stone-300 rounded-lg bg-stone-50/50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:border-[#0A6C74]"
              />
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label htmlFor="reg-password" className="block text-xs font-bold text-stone-700 mb-1">
                  Create Password (Min 6 chars) *
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0A6C74] focus:border-[#0A6C74] bg-stone-50/50"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reg-confirm" className="block text-xs font-bold text-stone-700 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    id="reg-confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0A6C74] focus:border-[#0A6C74] bg-stone-50/50"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                </div>
              </div>
            </div>

            {/* Terms and Privacy */}
            <div className="pt-2">
              <label className="flex items-start space-x-2 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="rounded border-stone-300 text-[#0A6C74] focus:ring-[#0A6C74] mt-0.5"
                />
                <span>
                  I agree to the{' '}
                  <span className="text-[#0A6C74] font-semibold hover:underline">Terms of Service</span>,{' '}
                  <span className="text-[#0A6C74] font-semibold hover:underline">Privacy Policy</span>, and receiving booking status alerts via email and WhatsApp.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <span>{isSubmitting ? 'Sending Confirmation Email...' : 'Create Account & Send Verification Email'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </form>

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-stone-200 text-center text-xs text-stone-600 space-y-2">
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate('login', redirectUrl ? `?redirect=${redirectUrl}` : undefined)}
                className="text-[#0A6C74] font-bold hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
            <p className="text-[11px] text-stone-400">
              Need to check an existing guest booking?{' '}
              <button
                type="button"
                onClick={() => onNavigate('my-booking')}
                className="text-stone-600 hover:text-stone-900 underline cursor-pointer"
              >
                Find My Booking Voucher
              </button>
            </p>
          </div>

        </div>

        {/* Back Link */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center text-xs text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>Back to Red Sea Home</span>
          </button>
        </div>

      </div>
    </div>
  );
};
