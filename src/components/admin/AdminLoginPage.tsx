import React, { useState, useEffect, useMemo } from 'react';
import { Lock, Mail, Compass, AlertCircle, ArrowLeft, ShieldCheck, Eye, EyeOff, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { MfaChallenge } from '../auth/MfaChallenge';
import { SuperAdminMfaPanel } from './SuperAdminMfaPanel';
import { isUserAdmin } from '../../services/authService';
import { ClientRateLimiter, sanitizeString } from '../../lib/security';

interface AdminLoginPageProps {
  onSuccess: (redirectUrl?: string) => void;
  onBackToSite: () => void;
  redirectUrl?: string;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onSuccess,
  onBackToSite,
  redirectUrl,
}) => {
  const { user, isAdmin, signOut, signIn, pendingMfaFactorId, requiresMfaEnrollment } = useAuth();
  const [email, setEmail] = useState(() => user?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already authenticated with admin privileges, automatically enter CMS
  useEffect(() => {
    if (user && isAdmin) {
      onSuccess(redirectUrl);
    }
  }, [user, isAdmin, onSuccess, redirectUrl]);

  // Security: Brute-force rate limiter (max 5 failed attempts, 45 seconds cooldown)
  const rateLimiter = useMemo(() => new ClientRateLimiter('admin_login', 5, 45000), []);
  const [rateLimitState, setRateLimitState] = useState(rateLimiter.check());

  // Countdown timer when locked out
  useEffect(() => {
    if (!rateLimitState.isLocked) return;

    const interval = setInterval(() => {
      const state = rateLimiter.check();
      setRateLimitState(state);
      if (!state.isLocked) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitState.isLocked, rateLimiter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check rate limit status
    const currentLimit = rateLimiter.check();
    if (currentLimit.isLocked) {
      setErrorMsg(`Too many failed attempts. Security cooldown active: please wait ${currentLimit.remainingSeconds} seconds.`);
      return;
    }

    const cleanEmail = sanitizeString(email);
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const result = await signIn(cleanEmail, password);
    setLoading(false);

    if (result.requiresMfa || result.requiresMfaEnrollment) {
      rateLimiter.reset();
      setErrorMsg(null);
      return;
    }

    if (result.success) {
      const hasAdminPrivileges = isUserAdmin(result.user || null);

      if (hasAdminPrivileges) {
        rateLimiter.reset();
        onSuccess(redirectUrl);
      } else {
        setErrorMsg(
          'Your account does not have permission to access the administration area. Please contact your administrator.'
        );
      }
    } else {
      console.warn('Administrator sign-in failed:', result.error);
      const updatedLimit = rateLimiter.recordFailedAttempt();
      setRateLimitState(updatedLimit);

      if (updatedLimit.isLocked) {
        setErrorMsg(`Too many failed attempts. Sign-in is temporarily paused for security. Try again in ${updatedLimit.remainingSeconds}s.`);
      } else {
        const remaining = updatedLimit.maxAttempts - updatedLimit.attempts;
        setErrorMsg(
          `We could not sign you in. Check your details and try again. (${remaining} attempts remaining)`
        );
      }
    }
  };

  const handleSwitchAccount = async () => {
    await signOut();
    setEmail('');
    setPassword('');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#0A1118] flex flex-col justify-between text-[#0E1B2A] dark:text-[#F1F5F9] p-4 sm:p-6 antialiased selection:bg-[#0A6C74] selection:text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between max-w-5xl mx-auto w-full">
        <button
          type="button"
          onClick={onBackToSite}
          className="flex items-center space-x-1.5 text-xs text-stone-600 dark:text-stone-400 hover:text-[#0A6C74] dark:hover:text-white transition-colors cursor-pointer font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Public Website</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-stone-500 dark:text-stone-400 uppercase tracking-widest font-mono">
            Secure administrator sign-in
          </span>
        </div>
      </div>

      {/* Center Auth Card */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="bg-white dark:bg-[#111E2E] border border-[#E8E3DA] dark:border-[#1F3854] rounded-2xl p-8 shadow-lg space-y-6">
          {/* Brand & Title */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center mx-auto mb-3">
              <img 
                src="/logo.png" 
                alt="Kemet Spirit Logo" 
                className="h-16 w-auto object-contain drop-shadow-sm"
              />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#0A6C74] dark:text-[#2DD4BF]">
              Staff &amp; Operations Portal
            </span>
            <h1 className="text-2xl font-bold font-display text-[#0E1B2A] dark:text-white tracking-tight">
              Admin CMS Login
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Sign in with your verified administrator credentials to manage tours, itineraries, bookings, and operations.
            </p>
          </div>

          {/* Rate Limit Lockout Banner */}
          {rateLimitState.isLocked && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-700/80 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Security lockout active. Please wait {rateLimitState.remainingSeconds}s.</span>
            </div>
          )}

          {/* Currently Logged In as Non-Admin Notice */}
          {user && !isAdmin && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-700 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Currently signed in as:</span>
                  <span className="font-mono text-[11px] text-amber-700 dark:text-amber-300">{user.email} (Role: {user.role})</span>
                  <p className="text-[11px] text-amber-800 dark:text-amber-200/90 mt-1">
                    This account is not recognized as an administrator in Supabase. Please sign in with an admin account or promote this email in Supabase SQL Editor.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="w-full py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Sign Out to Switch Accounts
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && !rateLimitState.isLocked && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          {pendingMfaFactorId ? (
            <MfaChallenge factorId={pendingMfaFactorId} onCancel={handleSwitchAccount} />
          ) : requiresMfaEnrollment ? (
            <SuperAdminMfaPanel compact />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-stone-700 dark:text-stone-300 font-semibold block mb-1">
                Admin Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  disabled={rateLimitState.isLocked}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@awesomeadventure.tours"
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl text-[#0E1B2A] dark:text-white text-xs placeholder-stone-400 focus:outline-none focus:border-[#0A6C74] disabled:opacity-50"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-stone-700 dark:text-stone-300 font-semibold">
                  Password
                </label>
                <span className="text-[10px] text-stone-500">Your password is protected</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  disabled={rateLimitState.isLocked}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-9 py-2 bg-[#FAF8F5] dark:bg-[#0A1118] border border-[#E8E3DA] dark:border-[#1F3854] rounded-xl text-[#0E1B2A] dark:text-white text-xs placeholder-stone-400 focus:outline-none focus:border-[#0A6C74] disabled:opacity-50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || rateLimitState.isLocked}
              className="w-full py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : rateLimitState.isLocked ? (
                <span>Locked ({rateLimitState.remainingSeconds}s)</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Access CMS Dashboard</span>
                </>
              )}
            </button>
          </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-stone-500 dark:text-stone-400">
        Kemet Spirit CMS • Supabase Database &amp; Auth Protected
      </div>
    </div>
  );
};
