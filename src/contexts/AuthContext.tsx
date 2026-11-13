import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  AppUser,
  signInUser,
  signUpUser,
  resendConfirmationEmail,
  confirmUserEmail,
  resetPasswordRequest,
  updateUserPassword,
  updateUserProfile,
  getUserPermissions,
  validatePasswordStrength,
  signOutAdmin,
  getCurrentAdminUser,
  isUserAdmin,
  verifyAdminAccess,
  LOCAL_ACTIVE_USER_KEY,
} from '../services/authService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useToast } from './ToastContext';
import { recordVisitorEvent } from '../services/visitorAnalyticsService';

export type AuthModalView = 'login' | 'register' | 'forgot' | 'forgot_password' | 'verify' | 'staff';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isCustomer: boolean;
  permissions: string[];
  hasPermission: (action: string) => boolean;
  authModalView: AuthModalView | null;
  openAuthModal: (view?: AuthModalView) => void;
  closeAuthModal: () => void;
  signIn: (email: string, pass: string) => Promise<{ 
    success: boolean; 
    user?: AppUser | null;
    error?: string; 
    requiresEmailConfirmation?: boolean;
    unconfirmedEmail?: string;
    requiresMfa?: boolean;
    requiresMfaEnrollment?: boolean;
    mfaFactorId?: string;
  }>;
  signUp: (data: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber?: string;
    phone?: string;
    countryCode?: string;
    country?: string;
  }) => Promise<{ 
    success: boolean; 
    error?: string; 
    requiresEmailConfirmation?: boolean; 
    needsEmailConfirmation?: boolean;
    email?: string;
    confirmationToken?: string;
  }>;
  resendConfirmation: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  confirmEmail: (email: string, token?: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  updatePassword: (newPassword: string, email?: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: Partial<AppUser>) => Promise<{ success: boolean; error?: string }>;
  validatePassword: (password: string) => { isValid: boolean; score: number; feedback: string[] };
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  pendingMfaFactorId: string | null;
  requiresMfaEnrollment: boolean;
  verifyMfa: (factorId: string, code: string) => Promise<{ success: boolean; error?: string }>;
  verifyAdmin: () => Promise<boolean>;
  checkAdminAccess: () => Promise<boolean>;
}

const requiresAdministratorMfa = (candidate: AppUser | null): boolean =>
  Boolean(candidate && (
    candidate.role === 'admin' ||
    candidate.role === 'super_admin' ||
    candidate.roles?.some((role) => role === 'admin' || role === 'super_admin')
  ));

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 30 minutes of idle time before automatic session logout for terminal security
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authModalView, setAuthModalView] = useState<AuthModalView | null>(null);
  const [pendingMfaFactorId, setPendingMfaFactorId] = useState<string | null>(null);
  const [requiresMfaEnrollment, setRequiresMfaEnrollment] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const permissions = user?.permissions ?? getUserPermissions(user?.role);
  const hasPermission = useCallback((action: string): boolean => {
    const [module, requestedAction] = action.split('.');
    const fullAdmin = Boolean(user?.roles?.includes('admin') || user?.roles?.includes('super_admin') || user?.role === 'admin' || user?.role === 'super_admin');
    if (fullAdmin) return true;
    if (permissions.includes(action) || permissions.includes(`${module}.manage`)) return true;
    if (requestedAction === 'read') {
      return permissions.some((permission) => {
        const [permissionModule, permissionAction] = permission.split('.');
        return permissionModule === module && ['create', 'update', 'delete', 'approve', 'export'].includes(permissionAction);
      });
    }
    return false;
  }, [permissions, user?.roles, user?.role]);

  const openAuthModal = useCallback((view: AuthModalView = 'login') => {
    setAuthModalView(view);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalView(null);
  }, []);

  const updateProfile = async (data: Partial<AppUser>) => {
    if (!user) {
      return { success: false, error: 'No active user session' };
    }
    const result = await updateUserProfile(user.id, data);
    if (result.success && result.user) {
      setUser(result.user);
    } else if (result.success) {
      setUser((prev) => (prev ? { ...prev, ...data } : null));
    }
    return result;
  };

  const validatePassword = useCallback((password: string) => {
    return validatePasswordStrength(password);
  }, []);

    const getPrivilegedAdminMfaState = useCallback(async (candidate: AppUser | null) => {
    if (!requiresAdministratorMfa(candidate)) {
      return { factorId: null as string | null, requiresEnrollment: false };
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    const verifiedTotp = factors.totp.find((factor) => factor.status === 'verified');
    if (!verifiedTotp) {
      return { factorId: null as string | null, requiresEnrollment: true };
    }

    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;
    if (assurance.currentLevel !== 'aal2' && assurance.nextLevel === 'aal2') {
      return { factorId: verifiedTotp.id, requiresEnrollment: false };
    }

    return { factorId: null as string | null, requiresEnrollment: false };
  }, []);

  const refreshUser = useCallback(async (trackSignIn = false) => {
    try {
      const current = await getCurrentAdminUser();
      const mfaState = await getPrivilegedAdminMfaState(current);
      if (mfaState.requiresEnrollment) {
        setUser(null);
        setPendingMfaFactorId(null);
        setRequiresMfaEnrollment(true);
        return;
      }
      if (mfaState.factorId) {
        setUser(null);
        setPendingMfaFactorId(mfaState.factorId);
        setRequiresMfaEnrollment(false);
        return;
      }
      setPendingMfaFactorId(null);
      setRequiresMfaEnrollment(false);
      setUser(current);
      if (trackSignIn && current) {
        void recordVisitorEvent({ event_name: 'auth_sign_in', page_path: typeof window !== 'undefined' ? window.location.pathname : '/login', event_data: { auth_method: 'supabase' } });
      }
    } catch {
      setUser(null);
      setPendingMfaFactorId(null);
      setRequiresMfaEnrollment(false);
    } finally {
      setLoading(false);
    }
  }, [getPrivilegedAdminMfaState]);

  /**
   * Rebuilds the active user from the live profile and database-backed RBAC context.
   * Browser storage and user-editable metadata never authorize roles or permissions.
   */
  const checkAdminAccess = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      // Browser storage is user-editable and can never authorize staff access.
      localStorage.removeItem(LOCAL_ACTIVE_USER_KEY);
      setUser(null);
      setPendingMfaFactorId(null);
      setRequiresMfaEnrollment(false);
      return false;
    }
    const current = await getCurrentAdminUser();
    const mfaState = await getPrivilegedAdminMfaState(current);
    if (mfaState.requiresEnrollment) {
      setUser(null);
      setPendingMfaFactorId(null);
      setRequiresMfaEnrollment(true);
      return false;
    }
    if (mfaState.factorId) {
      setUser(null);
      setPendingMfaFactorId(mfaState.factorId);
      setRequiresMfaEnrollment(false);
      return false;
    }
    setPendingMfaFactorId(null);
    setRequiresMfaEnrollment(false);
    const allowed = isUserAdmin(current);
    setUser(current);
    if (!allowed) localStorage.removeItem(LOCAL_ACTIVE_USER_KEY);
    return allowed;
  }, [getPrivilegedAdminMfaState]);

  const handleSignOut = useCallback(async (isAutoLogout = false) => {
    setLoading(true);
    await signOutAdmin();
    setUser(null);
    setPendingMfaFactorId(null);
    setRequiresMfaEnrollment(false);
    setLoading(false);

    if (isAutoLogout) {
      showToast('Session expired due to inactivity. Please sign in again.', 'info', 5000);
    }
  }, [showToast]);

  // Reset idle timer on user activity if user is logged in
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    if (isUserAdmin(user)) {
      idleTimerRef.current = setTimeout(() => {
        handleSignOut(true);
      }, IDLE_TIMEOUT_MS);
    }
  }, [user, handleSignOut]);

  // Activity listeners for idle timeout
  useEffect(() => {
    if (!isUserAdmin(user)) return;

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetIdleTimer();

    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [user, resetIdleTimer]);

  useEffect(() => {
    refreshUser();

    if (isSupabaseConfigured()) {
      // LoginPage owns signup confirmation URL exchange; recovery pages own recovery tokens.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
          // Supabase advises against awaiting client calls inside this callback:
          // it runs while auth state is being processed and can deadlock the auth lock.
          window.setTimeout(() => {
            void refreshUser(event === 'SIGNED_IN');
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setPendingMfaFactorId(null);
          setRequiresMfaEnrollment(false);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [refreshUser]);

  const handleSignIn = async (email: string, pass: string) => {
    setLoading(true);
    const result = await signInUser(email, pass);
    let verifiedUser: AppUser | null = null;
    if (result.user) {
      // Re-verify the live profile before granting any role in client state.
      verifiedUser = await getCurrentAdminUser();
      if (!verifiedUser) {
        await signOutAdmin();
        setUser(null);
        setPendingMfaFactorId(null);
        setRequiresMfaEnrollment(false);
        setLoading(false);
        return {
          success: false,
          user: null,
          error: 'We could not verify your account permissions. Please sign in again.',
          requiresEmailConfirmation: result.requiresEmailConfirmation,
          unconfirmedEmail: result.unconfirmedEmail,
        };
      }
      let mfaState: { factorId: string | null; requiresEnrollment: boolean };
      try {
        mfaState = await getPrivilegedAdminMfaState(verifiedUser);
      } catch {
        await signOutAdmin();
        setUser(null);
        setPendingMfaFactorId(null);
        setRequiresMfaEnrollment(false);
        setLoading(false);
        return {
          success: false,
          user: null,
          error: 'We could not verify your multi-factor security status. Please try again.',
        };
      }
      if (mfaState.requiresEnrollment) {
        setUser(null);
        setPendingMfaFactorId(null);
        setRequiresMfaEnrollment(true);
        setLoading(false);
        return {
          success: false,
          user: null,
          requiresMfaEnrollment: true,
        };
      }
      if (mfaState.factorId) {
        setUser(null);
        setPendingMfaFactorId(mfaState.factorId);
        setRequiresMfaEnrollment(false);
        setLoading(false);
        return {
          success: false,
          user: null,
          requiresMfa: true,
          mfaFactorId: mfaState.factorId,
        };
      }
      setPendingMfaFactorId(null);
      setRequiresMfaEnrollment(false);
      setUser(verifiedUser);
    } else {
      setUser(null);
      setPendingMfaFactorId(null);
      setRequiresMfaEnrollment(false);
    }
    setLoading(false);
    return {
      success: !result.error && !!verifiedUser,
      user: verifiedUser,
      error: result.error,
      requiresEmailConfirmation: result.requiresEmailConfirmation,
      unconfirmedEmail: result.unconfirmedEmail,
    };
  };

  const handleVerifyMfa = async (factorId: string, code: string) => {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) return { success: false, error: challengeError.message };

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) return { success: false, error: verifyError.message };

    void recordVisitorEvent({ event_name: 'mfa_verified', page_path: '/login', event_data: { outcome: 'verified' } });
    void recordVisitorEvent({ event_name: 'auth_sign_in', page_path: '/login', event_data: { auth_method: 'mfa' } });
    setPendingMfaFactorId(null);
    setRequiresMfaEnrollment(false);
    await refreshUser();
    return { success: true };
  };

  const handleSignUp = async (data: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber?: string;
    phone?: string;
    countryCode?: string;
    country?: string;
  }) => {
    setLoading(true);
    const result = await signUpUser({
      ...data,
      phoneNumber: data.phoneNumber || data.phone,
    });
    // User is NOT set as active yet because email confirmation is required!
    setLoading(false);
    return { 
      success: !result.error, 
      error: result.error,
      requiresEmailConfirmation: result.requiresEmailConfirmation,
      needsEmailConfirmation: result.requiresEmailConfirmation,
      email: result.email,
      confirmationToken: result.confirmationToken,
    };
  };

  const handleResendConfirmation = async (email: string) => {
    return resendConfirmationEmail(email);
  };

  const handleConfirmEmail = async (email: string, token?: string) => {
    return confirmUserEmail(email, token);
  };

  const handleResetPassword = async (email: string) => {
    return resetPasswordRequest(email);
  };

  const handleUpdatePassword = async (newPassword: string, email?: string) => {
    return updateUserPassword(newPassword, email || user?.email);
  };

  const isAdmin = isUserAdmin(user);
  const isStaff = isAdmin;
  const isCustomer = Boolean(user && !user.roles?.some((role) => role !== 'customer') && user.role === 'customer');

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        isStaff,
        isCustomer,
        permissions,
        hasPermission,
        authModalView,
        openAuthModal,
        closeAuthModal,
        signIn: handleSignIn,
        signUp: handleSignUp,
        resendConfirmation: handleResendConfirmation,
        resendVerification: handleResendConfirmation,
        confirmEmail: handleConfirmEmail,
        resetPassword: handleResetPassword,
        sendPasswordReset: handleResetPassword,
        updatePassword: handleUpdatePassword,
        updateProfile,
        validatePassword,
        signOut: () => handleSignOut(false),
        refreshUser,
        pendingMfaFactorId,
        requiresMfaEnrollment,
        verifyMfa: handleVerifyMfa,
        verifyAdmin: verifyAdminAccess,
        checkAdminAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
