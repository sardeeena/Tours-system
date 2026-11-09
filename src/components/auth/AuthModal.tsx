import React, { useState, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  Compass,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  RotateCw,
} from 'lucide-react';
import { useAuth, AuthModalView } from '../../contexts/AuthContext';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { sanitizeString, isValidEmail, validatePasswordStrength, authRateLimiter } from '../../lib/security';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: AuthModalView;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialView = 'login',
  onSuccess,
}) => {
  const {
    signIn,
    signUp,
    sendPasswordReset,
    resendVerification,
    authModalView,
    openAuthModal,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<AuthModalView>(initialView);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Post-registration verification state
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [needsVerificationNotice, setNeedsVerificationNotice] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  // Sync active tab with context if provided
  React.useEffect(() => {
    if (authModalView) {
      setActiveTab(authModalView);
    }
  }, [authModalView]);

  // Reset form errors on tab switch
  const switchTab = (tab: AuthModalView) => {
    setActiveTab(tab);
    openAuthModal(tab);
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsVerificationNotice(false);
  };

  // Password strength check
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-stone-200' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;

    switch (score) {
      case 1:
        return { score, label: 'Weak', color: 'bg-rose-500' };
      case 2:
        return { score, label: 'Fair', color: 'bg-amber-500' };
      case 3:
        return { score, label: 'Good', color: 'bg-blue-500' };
      case 4:
        return { score, label: 'Strong', color: 'bg-emerald-500' };
      default:
        return { score, label: 'Weak', color: 'bg-rose-500' };
    }
  };

  const passwordStrength = getPasswordStrength(password);

  // 1. Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = authRateLimiter.check();
    if (limit.isLocked) {
      setErrorMsg(`Too many attempts. Please wait ${limit.remainingSeconds} seconds before trying again.`);
      return;
    }

    const cleanEmail = sanitizeString(email).toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both your email and password.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid email address format.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const result = await signIn(cleanEmail, password);
    setLoading(false);

    if (result.success) {
      authRateLimiter.reset();
      onClose();
      if (onSuccess) onSuccess();
    } else {
      authRateLimiter.recordFailedAttempt();
      setErrorMsg(result.error || 'Unable to sign in. Please verify your credentials.');
    }
  };

  // 2. Handle Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = authRateLimiter.check();
    if (limit.isLocked) {
      setErrorMsg(`Too many registration attempts. Please wait ${limit.remainingSeconds} seconds.`);
      return;
    }

    const cleanEmail = sanitizeString(email).toLowerCase();
    const cleanName = sanitizeString(fullName);
    const cleanPhone = sanitizeString(phone);

    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Please enter your full legal name.');
      return;
    }

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid email address format.');
      return;
    }

    const strengthCheck = validatePasswordStrength(password);
    if (!strengthCheck.isValid) {
      setErrorMsg(strengthCheck.errors[0] || 'Password does not meet security requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    if (!termsAccepted) {
      setErrorMsg('Please agree to the Terms of Service & Privacy Policy.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const result = await signUp({
      email: cleanEmail,
      password,
      fullName: cleanName,
      phone: cleanPhone || undefined,
    });

    setLoading(false);

    if (result.success) {
      authRateLimiter.reset();
      if (result.needsEmailConfirmation) {
        setRegisteredEmail(cleanEmail);
        setNeedsVerificationNotice(true);
      } else {
        onClose();
        if (onSuccess) onSuccess();
      }
    } else {
      authRateLimiter.recordFailedAttempt();
      setErrorMsg(result.error || 'Registration failed. Please try again.');
    }
  };

  // 3. Handle Forgot Password
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = authRateLimiter.check();
    if (limit.isLocked) {
      setErrorMsg(`Too many requests. Please wait ${limit.remainingSeconds} seconds.`);
      return;
    }

    const cleanEmail = sanitizeString(email).toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const result = await sendPasswordReset(cleanEmail);
    setLoading(false);

    if (result.success) {
      authRateLimiter.reset();
      setSuccessMsg(`We have dispatched password reset instructions to ${cleanEmail}. Please check your inbox and click the recovery link.`);
    } else {
      authRateLimiter.recordFailedAttempt();
      setErrorMsg(result.error || 'Failed to send reset email. Please try again.');
    }
  };

  // 4. Handle Resend Verification
  const handleResend = async () => {
    if (!registeredEmail) return;
    setResendingVerification(true);
    const res = await resendVerification(registeredEmail);
    setResendingVerification(false);
    if (res.success) {
      setSuccessMsg('A new verification email has been dispatched. Please check your inbox.');
    } else {
      setErrorMsg(res.error || 'Could not resend verification email.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 dark:bg-stone-950/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-8"
      >
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-[#0A6C74] via-[#0E8A94] to-[#14A7B4] dark:from-[#0E1B2A] dark:via-[#16283D] dark:to-[#0A6C74] p-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-amber-400">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <span className="text-xs uppercase tracking-widest font-semibold text-stone-300">
              Red Sea Excursions
            </span>
          </div>

          <h2 className="font-display text-xl font-bold text-white">
            {activeTab === 'login' && 'Sign In to Your Account'}
            {activeTab === 'register' && 'Create Your Explorer Account'}
            {activeTab === 'forgot_password' && 'Reset Your Password'}
          </h2>
          <p className="text-xs text-stone-300 mt-1">
            {activeTab === 'login' && 'Access your bookings, saved marine excursions & itinerary passes.'}
            {activeTab === 'register' && 'Book faster, manage reservations & receive exclusive voyage rates.'}
            {activeTab === 'forgot_password' && 'Enter your email to receive a secure recovery link.'}
          </p>
        </div>

        {/* Tab Switcher (Login / Register) */}
        {activeTab !== 'forgot_password' && (
          <div className="flex border-b border-stone-200 bg-stone-50">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`flex-1 py-3 text-xs font-semibold text-center transition-all cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-white text-[#0A6C74] border-b-2 border-[#0A6C74]'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={`flex-1 py-3 text-xs font-semibold text-center transition-all cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-white text-[#0A6C74] border-b-2 border-[#0A6C74]'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Register New Account
            </button>
          </div>
        )}

        <div className="p-6">
          {/* Status Messages */}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start space-x-2 text-rose-800 text-xs leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start space-x-2 text-emerald-800 text-xs leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMsg}</span>
            </motion.div>
          )}

          {/* Verification Email Required Notice */}
          {needsVerificationNotice ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-stone-900">
                  Verify Your Email Address
                </h3>
                <p className="text-xs text-stone-600 mt-2 max-w-sm mx-auto leading-relaxed">
                  We've sent an activation link to <strong className="text-stone-900">{registeredEmail}</strong>.
                  Please check your inbox (and spam folder) and click the link to activate your account.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendingVerification}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium rounded-lg transition-colors flex items-center justify-center"
                >
                  <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${resendingVerification ? 'animate-spin' : ''}`} />
                  {resendingVerification ? 'Resending...' : 'Resend Email'}
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Proceed to Sign In
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ---------------- 1. SIGN IN FORM ---------------- */}
              {activeTab === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-stone-700">Password</label>
                      <button
                        type="button"
                        onClick={() => switchTab('forgot_password')}
                        className="text-[11px] text-[#0A6C74] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-9 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-[#0A6C74] hover:bg-[#08565C] disabled:bg-stone-400 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ---------------- 2. REGISTER FORM ---------------- */}
              {activeTab === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="sarah@example.com"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      WhatsApp / Mobile Phone (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+44 7911 123456"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full pl-9 pr-9 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password Strength Meter */}
                    {password && (
                      <div className="mt-1.5 flex items-center space-x-2">
                        <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden flex">
                          <div
                            className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                            style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-stone-500 font-medium">
                          {passwordStrength.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex items-start space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="terms-checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 rounded text-[#0A6C74] focus:ring-[#0A6C74] border-stone-300 cursor-pointer"
                    />
                    <label htmlFor="terms-checkbox" className="text-[11px] text-stone-600 leading-tight">
                      I agree to the <a href="#" className="text-[#0A6C74] underline">Terms of Service</a> and <a href="#" className="text-[#0A6C74] underline">Privacy Policy</a>.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-[#0A6C74] hover:bg-[#08565C] disabled:bg-stone-400 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Explorer Account</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ---------------- 3. FORGOT PASSWORD FORM ---------------- */}
              {activeTab === 'forgot_password' && (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Account Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-[#0A6C74] hover:bg-[#08565C] disabled:bg-stone-400 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                        <span>Sending Instructions...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5 mr-1" />
                        <span>Send Password Reset Email</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => switchTab('login')}
                      className="text-xs text-stone-600 hover:text-stone-900 font-medium"
                    >
                      ← Return to Sign In
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Footer note */}
          <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-center space-x-2 text-[11px] text-stone-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted with TLS 1.3 & Supabase Auth</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
