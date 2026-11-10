import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  CalendarCheck,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { isValidEmail } from '../lib/security';
import { supabase, isSupabaseConfigured, formatSupabaseError } from '../services/supabaseClient';

interface ResetPasswordPageProps {
  onNavigate: (page: string, param?: string) => void;
}

type ResetStep = 'loading' | 'request' | 'requested' | 'update' | 'completed' | 'invalid_link';

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onNavigate }) => {
  const { resetPassword, updatePassword } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<ResetStep>('loading');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize and inspect URL for recovery tokens / sessions
  useEffect(() => {
    let isMounted = true;
    let recoveryEventReceived = false;
    let recoveryTimeout: number | null = null;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const cleanup = () => {
      isMounted = false;
      if (recoveryTimeout !== null) window.clearTimeout(recoveryTimeout);
      authSubscription?.unsubscribe();
    };

    const searchParams = new URLSearchParams(window.location.search);
    const hashString = window.location.hash.startsWith('#')
      ? window.location.hash.substring(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hashString);

    const errorParam = searchParams.get('error') || hashParams.get('error');
    const errorDesc = searchParams.get('error_description') || hashParams.get('error_description');

    if (errorParam || errorDesc) {
      const rawMsg = errorDesc || errorParam || 'Password recovery link is invalid or has expired.';
      let cleanMsg = rawMsg.replace(/\\+/g, ' ');
      try {
        cleanMsg = decodeURIComponent(cleanMsg);
      } catch {
        // Keep the readable raw message if the provider returned malformed encoding.
      }
      setErrorMessage(cleanMsg);
      setStep('invalid_link');
      return cleanup;
    }

    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');
    const otpType = searchParams.get('type') || hashParams.get('type');
    const hasHashRecovery = hashParams.get('type') === 'recovery' || hashParams.has('access_token');

    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (!isMounted) return;
        if (event === 'PASSWORD_RECOVERY') {
          recoveryEventReceived = true;
          setStep('update');
          setErrorMessage(null);
        }
      });
      authSubscription = data.subscription;
    }

    if (code) {
      if (!isSupabaseConfigured()) {
        setErrorMessage('Password recovery is unavailable because Supabase is not configured.');
        setStep('invalid_link');
        return cleanup;
      }

      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error: exchangeErr }) => {
          if (!isMounted) return;
          if (exchangeErr) {
            setErrorMessage(formatSupabaseError(exchangeErr));
            setStep('invalid_link');
          } else if (data?.session) {
            setStep('update');
            setErrorMessage(null);
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            setStep('invalid_link');
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setErrorMessage(formatSupabaseError(err));
          setStep('invalid_link');
        });
      return cleanup;
    }

    if (tokenHash) {
      if (!isSupabaseConfigured()) {
        setErrorMessage('Password recovery is unavailable because Supabase is not configured.');
        setStep('invalid_link');
        return cleanup;
      }

      supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: (otpType as any) || 'recovery',
      })
        .then(({ data, error: otpErr }) => {
          if (!isMounted) return;
          if (otpErr) {
            setErrorMessage(formatSupabaseError(otpErr));
            setStep('invalid_link');
          } else if (data?.session) {
            setStep('update');
            setErrorMessage(null);
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            setStep('invalid_link');
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setErrorMessage(formatSupabaseError(err));
          setStep('invalid_link');
        });
      return cleanup;
    }

    if (hasHashRecovery) {
      if (!isSupabaseConfigured()) {
        setErrorMessage('Password recovery is unavailable because Supabase is not configured.');
        setStep('invalid_link');
        return cleanup;
      }

      supabase.auth.getSession()
        .then(({ data: { session }, error: sessErr }) => {
          if (!isMounted) return;
          if (session) {
            setStep('update');
            setErrorMessage(null);
          } else if (sessErr) {
            setErrorMessage(formatSupabaseError(sessErr));
            setStep('invalid_link');
          } else {
            recoveryTimeout = window.setTimeout(() => {
              if (isMounted && !recoveryEventReceived) {
                setStep('invalid_link');
              }
            }, 1500);
          }
        })
        .catch(() => {
          if (isMounted) setStep('invalid_link');
        });
      return cleanup;
    }

    setStep('request');
    return cleanup;
  }, []);

  // Request password reset email
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPassword(cleanEmail);
      if (res.success) {
        setStep('requested');
        showToast('Password recovery instructions sent! Please check your inbox.', 'info');
      } else {
        setErrorMessage(res.error || 'Could not send reset instructions. Please try again.');
      }
    } catch {
      setErrorMessage('A connection error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit new password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updatePassword(newPassword);
      if (res.success) {
        setStep('completed');
        showToast('Password successfully updated!', 'success');
      } else {
        setErrorMessage(res.error || 'Failed to update password. Please request a new reset link.');
      }
    } catch {
      setErrorMessage('An unexpected error occurred while updating your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#FAF8F5] py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto space-y-6">

        {/* Visitor Help Callout */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3 text-amber-900 shadow-2xs">
          <CalendarCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-amber-950">Looking for an existing reservation?</p>
            <p className="text-amber-800 mt-0.5">
              You don't need an account to view your excursion booking. All travelers can look up reservations instantly with their booking reference code.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('my-booking')}
              className="mt-2 inline-flex items-center text-xs font-bold text-amber-800 hover:text-amber-950 underline underline-offset-2 cursor-pointer"
            >
              <span>Go to Find My Booking Portal</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white border border-[#E8E3DA] rounded-xl shadow-sm p-6 sm:p-8 space-y-6">

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center mx-auto mb-2">
              <img
                src="/logo.png"
                alt="Awesome Adventure Tours Logo"
                className="h-16 w-auto object-contain drop-shadow-sm"
              />
            </div>

            <h1 className="font-display text-2xl font-bold text-[#0E1B2A]">
              {step === 'loading' && 'Verifying Recovery Link...'}
              {step === 'request' && 'Reset Your Password'}
              {step === 'requested' && 'Check Your Email'}
              {step === 'update' && 'Set New Password'}
              {step === 'completed' && 'Password Updated'}
              {step === 'invalid_link' && 'Invalid or Expired Link'}
            </h1>

            <p className="text-xs text-stone-500">
              {step === 'loading' && 'Validating your secure password recovery session...'}
              {step === 'request' && 'Enter your account email address and we will send you a secure password reset link.'}
              {step === 'requested' && `If an account exists for ${email}, a recovery link has been dispatched.`}
              {step === 'update' && 'Choose a new secure password for your account (minimum 6 characters).'}
              {step === 'completed' && 'Your password has been changed. You can now sign in with your new credentials.'}
              {step === 'invalid_link' && 'This password reset link is invalid, has expired, or was already used.'}
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step: Loading */}
          {step === 'loading' && (
            <div className="py-8 flex flex-col items-center justify-center space-y-3 text-stone-500">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0A6C74]" />
              <p className="text-xs">Verifying recovery token...</p>
            </div>
          )}

          {/* Step 1: Request email */}
          {step === 'request' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-xs font-bold text-stone-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. yourname@example.com"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-stone-300 text-xs sm:text-sm bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-[#0A6C74] hover:bg-[#08565C] disabled:bg-stone-400 text-white font-semibold text-xs sm:text-sm rounded-lg transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending instructions...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Instructions</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 2: Requested confirmation message */}
          {step === 'requested' && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 bg-[#0A6C74]/10 text-[#0A6C74] rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-3.5 text-xs text-stone-700 text-left space-y-1.5">
                <p className="font-semibold text-stone-900">What happens next?</p>
                <ul className="list-disc list-inside space-y-1 text-stone-600">
                  <li>Check your inbox for an email from <strong>Supabase / Red Sea Voyages</strong>.</li>
                  <li>Click the <strong>recovery link</strong> inside the email to set your new password.</li>
                  <li>If you do not see it within a couple minutes, please check your spam folder.</li>
                </ul>
              </div>
              <div className="flex flex-col space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setStep('request');
                  }}
                  className="w-full py-2 px-3 text-xs font-semibold text-stone-600 hover:text-stone-900 border border-stone-300 rounded-lg transition-colors cursor-pointer"
                >
                  Didn't receive email? Try another address
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Set New Password (Valid Recovery Session) */}
          {step === 'update' && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-start space-x-2">
                <KeyRound className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>Recovery session validated. Please choose your new password.</span>
              </div>

              <div>
                <label htmlFor="new-password" className="block text-xs font-bold text-stone-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-stone-300 text-xs sm:text-sm bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-new-password" className="block text-xs font-bold text-stone-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    id="confirm-new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-stone-300 text-xs sm:text-sm bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-[#0A6C74] hover:bg-[#08565C] disabled:bg-stone-400 text-white font-semibold text-xs sm:text-sm rounded-lg transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Save New Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 4: Invalid Link Error State */}
          {step === 'invalid_link' && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs text-stone-600">
                Recovery links can only be used once and expire after 1 hour. Please request a new recovery link.
              </p>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setStep('request');
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                className="w-full py-2.5 px-4 bg-[#0A6C74] hover:bg-[#08565C] text-white font-semibold text-xs sm:text-sm rounded-lg transition-all cursor-pointer"
              >
                Request New Password Reset Link
              </button>
            </div>
          )}

          {/* Step 5: Completed */}
          {step === 'completed' && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-xs text-stone-600">
                You can now sign in securely using your new credentials.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="w-full py-2.5 px-4 bg-[#0A6C74] hover:bg-[#08565C] text-white font-semibold text-xs sm:text-sm rounded-lg transition-all cursor-pointer"
              >
                Sign In With New Password
              </button>
            </div>
          )}

          {/* Back to sign in */}
          <div className="text-center pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="text-xs font-semibold text-[#0A6C74] hover:text-[#08565C] inline-flex items-center space-x-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>

        </div>

        {/* Back Link */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center text-xs text-stone-500 hover:text-stone-800 font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>Return to Homepage</span>
          </button>
        </div>

      </div>
    </div>
  );
};
