import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  UserCheck, 
  ShieldCheck, 
  ArrowLeft,
  RefreshCw,
  MailCheck,
  KeyRound,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { sanitizeString, isValidEmail, sanitizeRedirectUrl, authRateLimiter } from '../lib/security';

interface LoginPageProps {
  redirectUrl?: string;
  onNavigate: (page: string, param?: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ redirectUrl, onNavigate }) => {
  const { user, signIn, resendConfirmation, confirmEmail } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [confirmedNotice, setConfirmedNotice] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isCheckingConfirmation, setIsCheckingConfirmation] = useState(false);

  // Direct OTP verification code state
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // If user is already authenticated (e.g. from Supabase email link session), redirect smoothly
  useEffect(() => {
    if (user) {
      const safeUrl = sanitizeRedirectUrl(redirectUrl, '/');
      if (safeUrl !== '/login') {
        onNavigate(safeUrl);
      } else {
        onNavigate('/');
      }
    }
  }, [user, redirectUrl, onNavigate]);

  // Check URL parameters for confirmation flags, PKCE codes, OTP tokens, or prefilled email
  useEffect(() => {
    const handleUrlConfirmation = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash;
        const code = params.get('code');
        const tokenHash = params.get('token_hash');
        const otpType = params.get('type') || 'signup';
        const isConfirmedParam = params.get('confirmed') === 'true' || params.get('confirm') === 'true';
        const emailParam = params.get('email');
        const tokenParam = params.get('token');
        const errorDesc = params.get('error_description') || params.get('error');

        if (emailParam) {
          setEmail(emailParam);
        }

        // Handle error param if token was already used or expired
        if (errorDesc) {
          const decoded = decodeURIComponent(errorDesc.replace(/\+/g, ' '));
          const lower = decoded.toLowerCase();
          if (lower.includes('already confirmed') || lower.includes('already verified')) {
            setConfirmedNotice(true);
            setRequiresConfirmation(false);
            setErrorMessage(null);
            if (emailParam) {
              await confirmEmail(emailParam);
            }
            return;
          }
          setErrorMessage(decoded);
          return;
        }

        // 1. Handle PKCE code exchange if present
        if (code && isSupabaseConfigured()) {
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error && data?.user) {
              const authedEmail = data.user.email || emailParam || '';
              if (authedEmail) {
                setEmail(authedEmail);
                await confirmEmail(authedEmail);
              }
              setConfirmedNotice(true);
              setRequiresConfirmation(false);
              setErrorMessage(null);
              showToast('Email verified successfully! You are now signed in.', 'success');

              // Clean URL query params to keep clean address bar
              const newUrl = window.location.pathname + (redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : '');
              window.history.replaceState({}, '', newUrl);
              return;
            }
          } catch (err) {
            console.warn('PKCE code exchange error:', err);
          }
        }

        // 2. Handle token_hash verification if present
        if (tokenHash && isSupabaseConfigured()) {
          try {
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: (otpType as any) || 'signup',
            });
            if (!error && data?.user) {
              const authedEmail = data.user.email || emailParam || '';
              if (authedEmail) {
                setEmail(authedEmail);
                await confirmEmail(authedEmail);
              }
              setConfirmedNotice(true);
              setRequiresConfirmation(false);
              setErrorMessage(null);
              showToast('Email verified successfully! You are now signed in.', 'success');

              const newUrl = window.location.pathname + (redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : '');
              window.history.replaceState({}, '', newUrl);
              return;
            }
          } catch (err) {
            console.warn('Verify OTP error:', err);
          }
        }

        // 3. Handle confirmed=true flag or direct token from email link
        if (isConfirmedParam || tokenParam) {
          const targetEmail = emailParam || email.trim();
          if (targetEmail) {
            await confirmEmail(targetEmail, tokenParam || undefined);
          }
          setConfirmedNotice(true);
          setRequiresConfirmation(false);
          setErrorMessage(null);
        }

        // 4. Handle implicit hash containing access_token
        if (hash && (hash.includes('access_token') || hash.includes('type=signup'))) {
          setConfirmedNotice(true);
          setRequiresConfirmation(false);
          setErrorMessage(null);
        }
      } catch (err) {
        console.warn('URL confirmation check error:', err);
      }
    };

    handleUrlConfirmation();
  }, [confirmEmail, email, redirectUrl, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setRequiresConfirmation(false);

    const limit = authRateLimiter.check();
    if (limit.isLocked) {
      setErrorMessage(`Too many sign-in attempts. Please wait ${limit.remainingSeconds} seconds before trying again.`);
      return;
    }

    const cleanEmail = sanitizeString(email).toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address format.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn(cleanEmail, password);
      if (result.success) {
        authRateLimiter.reset();
        showToast('Welcome back! You have successfully signed in.', 'success');
        const safeUrl = sanitizeRedirectUrl(redirectUrl, '/');
        if (safeUrl !== '/login') {
          onNavigate(safeUrl);
        } else {
          onNavigate('/');
        }
      } else {
        authRateLimiter.recordFailedAttempt();
        if (result.requiresEmailConfirmation) {
          setRequiresConfirmation(true);
          setUnconfirmedEmail(result.unconfirmedEmail || cleanEmail);
          setErrorMessage(result.error || 'Your account is pending email confirmation. Please check your inbox.');
        } else {
          setErrorMessage(result.error || 'Invalid email or password. Please verify your credentials.');
        }
      }
    } catch {
      authRateLimiter.recordFailedAttempt();
      setErrorMessage('A connection error occurred while signing in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    const targetEmail = unconfirmedEmail || email.trim();
    if (!targetEmail) return;
    setIsResending(true);
    try {
      const res = await resendConfirmation(targetEmail);
      if (res.success) {
        // If message notes that account is already confirmed
        if (res.message?.includes('already verified') || res.message?.includes('already confirmed')) {
          setConfirmedNotice(true);
          setRequiresConfirmation(false);
          setErrorMessage(null);
        }
        showToast(res.message || 'Confirmation email resent! Please check your inbox.', 'success');
      } else {
        showToast(res.error || 'Failed to resend confirmation email.', 'error');
      }
    } catch {
      showToast('Error resending confirmation email.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  // User confirmed in email and wants to refresh status & log in
  const handleManualConfirmCheck = async () => {
    const targetEmail = unconfirmedEmail || email.trim();
    if (!targetEmail) return;

    setIsCheckingConfirmation(true);
    try {
      await confirmEmail(targetEmail);
      setConfirmedNotice(true);
      setRequiresConfirmation(false);
      setErrorMessage(null);

      // If password was already typed, immediately attempt sign-in
      if (password) {
        const result = await signIn(targetEmail, password);
        if (result.success) {
          showToast('Account confirmed and logged in successfully!', 'success');
          if (redirectUrl && redirectUrl !== '/login') {
            onNavigate(redirectUrl);
          } else {
            onNavigate('/');
          }
          return;
        }
      }

      showToast('Account status updated to confirmed! Please enter your password to sign in.', 'success');
    } catch {
      showToast('Could not refresh status. Please try entering your password.', 'info');
    } finally {
      setIsCheckingConfirmation(false);
    }
  };

  // Direct 6-digit code verification
  const handleVerifyOtpCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = unconfirmedEmail || email.trim();
    if (!targetEmail || !otpCode.trim()) {
      showToast('Please enter your verification code.', 'error');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await confirmEmail(targetEmail, otpCode.trim());
      if (res.success) {
        setConfirmedNotice(true);
        setRequiresConfirmation(false);
        setErrorMessage(null);
        setShowOtpInput(false);
        showToast('Account verified successfully!', 'success');

        if (password) {
          const signinRes = await signIn(targetEmail, password);
          if (signinRes.success) {
            if (redirectUrl && redirectUrl !== '/login') {
              onNavigate(redirectUrl);
            } else {
              onNavigate('/');
            }
          }
        }
      } else {
        showToast(res.error || 'Invalid code. Please check your email.', 'error');
      }
    } catch {
      showToast('Failed to verify confirmation code.', 'error');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleQuickFill = (fillEmail: string, fillPass: string) => {
    setEmail(fillEmail);
    setPassword(fillPass);
    setErrorMessage(null);
    setRequiresConfirmation(false);
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#FAF8F5] py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto space-y-6">
        
        {/* Guest Booking Reassurance Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start space-x-3 text-emerald-900 shadow-2xs">
          <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-emerald-950">Booking an excursion today?</p>
            <p className="text-emerald-800 mt-0.5">
              Visitors can book directly with zero account setup. No registration is required.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('booking')}
              className="mt-2 inline-flex items-center text-xs font-bold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 cursor-pointer"
            >
              <span>Continue to Excursion Booking as Guest</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>

        {/* Confirmed Banner (if arriving from email link) */}
        {confirmedNotice && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-start space-x-3 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-950 text-sm">Email Confirmed Successfully!</p>
              <p className="text-emerald-800 mt-0.5">
                Your account is now confirmed and active. Please enter your password to sign in.
              </p>
            </div>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-white border border-[#E8E3DA] rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center mx-auto mb-2">
              <img 
                src="/logo.png" 
                alt="Awesome Adventure Tours Logo" 
                className="h-16 w-auto object-contain drop-shadow-sm"
              />
            </div>
            <h1 className="font-display text-2xl font-bold text-[#0E1B2A]">Sign in to Awesome Adventure Tours</h1>
            <p className="text-xs text-stone-500">
              Access your reservations, digital vouchers, and saved excursions
            </p>
          </div>

          {/* Pending Confirmation Notice */}
          {requiresConfirmation && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs space-y-3 shadow-xs">
              <div className="flex items-start space-x-2.5">
                <MailCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-950 block text-sm">Account Pending Email Confirmation</span>
                  <p className="text-amber-800 mt-1">
                    We sent a verification link to <strong>{unconfirmedEmail || email}</strong> from Supabase.
                    If you clicked the link in your email, click <strong>"I've Confirmed"</strong> below to refresh your status immediately.
                  </p>
                </div>
              </div>

              <div className="pt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleManualConfirmCheck}
                  disabled={isCheckingConfirmation}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isCheckingConfirmation ? 'animate-spin' : ''}`} />
                  <span>{isCheckingConfirmation ? 'Verifying...' : "I've Confirmed My Email"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="px-3 py-1.5 bg-amber-200/90 hover:bg-amber-300 text-amber-950 rounded font-semibold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                  <span>{isResending ? 'Resending...' : 'Resend Email'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowOtpInput(!showOtpInput)}
                  className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-900 rounded font-semibold text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3 text-amber-700" />
                  <span>{showOtpInput ? 'Hide Code Input' : 'Enter 6-digit Code'}</span>
                </button>
              </div>

              {/* Enter 6-digit code form */}
              {showOtpInput && (
                <div className="pt-2 border-t border-amber-200/60 mt-2 space-y-2">
                  <span className="text-[11px] font-semibold text-amber-950 block">
                    Received a 6-digit confirmation code from Supabase?
                  </span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      maxLength={8}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="e.g. 123456"
                      className="px-3 py-1.5 bg-white border border-amber-300 rounded text-xs font-mono text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#0A6C74] w-36"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtpCode}
                      disabled={isVerifyingOtp || !otpCode.trim()}
                      className="px-3 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {isVerifyingOtp ? 'Verifying...' : 'Activate Account'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Notice */}
          {errorMessage && !requiresConfirmation && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-bold text-stone-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. yourname@example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-stone-300 text-xs sm:text-sm bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="block text-xs font-bold text-stone-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => onNavigate('reset-password')}
                  className="text-[11px] text-[#0A6C74] hover:underline font-medium cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-stone-300 text-xs sm:text-sm bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-stone-300 text-[#0A6C74] focus:ring-[#0A6C74]"
                />
                <span>Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              <span>{isSubmitting ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="pt-2 text-center text-xs text-stone-600 space-y-2">
            <p>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => onNavigate('register', redirectUrl ? `?redirect=${redirectUrl}` : undefined)}
                className="text-[#0A6C74] font-bold hover:underline cursor-pointer"
              >
                Register Now
              </button>
            </p>
            <p className="text-[11px] text-stone-400">
              Just want to check an existing booking?{' '}
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
