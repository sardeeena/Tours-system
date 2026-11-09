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
    unconfirmedEmail?: string 
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
  verifyAdmin: () => Promise<boolean>;
  checkAdminAccess: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 30 minutes of idle time before automatic session logout for terminal security
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authModalView, setAuthModalView] = useState<AuthModalView | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const permissions = getUserPermissions(user?.role);
  const hasPermission = useCallback((action: string): boolean => {
    return permissions.includes(action) || (user?.role === 'admin');
  }, [permissions, user?.role]);

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

  const refreshUser = useCallback(async () => {
    try {
      const current = await getCurrentAdminUser();
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Queries the 'profiles' table directly in Supabase for the user's current role.
   * Completely replaces cached local state with a live database verification.
   */
  const checkAdminAccess = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      const stored = localStorage.getItem(LOCAL_ACTIVE_USER_KEY);
      if (!stored) return false;
      try {
        const u = JSON.parse(stored) as AppUser;
        return u.role === 'admin' || u.role === 'manager' || u.role === 'staff';
      } catch {
        return false;
      }
    }

    try {
      const { data: { user: authUser }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !authUser) {
        setUser(null);
        localStorage.removeItem(LOCAL_ACTIVE_USER_KEY);
        return false;
      }

      // Query the 'profiles' table directly for the user's role in PostgreSQL
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, phone, country, avatar_url, is_confirmed')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profErr || !profile) {
        console.warn('Admin check: profile not found in profiles table', profErr);
        return false;
      }

      const role = profile.role as 'admin' | 'manager' | 'staff' | 'customer';
      const isAllowed = role === 'admin' || role === 'manager' || role === 'staff';

      if (isAllowed) {
        // Synchronize the in-memory user state with the live database profile
        const updatedUser: AppUser = {
          id: authUser.id,
          email: authUser.email || profile.email || '',
          fullName: profile.full_name || authUser.email?.split('@')[0] || 'Voyager',
          role,
          avatarUrl: profile.avatar_url,
          phoneNumber: profile.phone,
          country: profile.country,
          isConfirmed: Boolean(profile.is_confirmed),
        };
        setUser(updatedUser);
        localStorage.setItem(LOCAL_ACTIVE_USER_KEY, JSON.stringify(updatedUser));
        return true;
      } else {
        // Not an authorized admin: update role
        setUser((prev) => (prev ? { ...prev, role } : null));
        return false;
      }
    } catch (err) {
      console.error('Error querying profiles table for admin role:', err);
      return false;
    }
  }, []);

  const handleSignOut = useCallback(async (isAutoLogout = false) => {
    setLoading(true);
    await signOutAdmin();
    setUser(null);
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

    if (user && (user.role === 'admin' || user.role === 'manager')) {
      idleTimerRef.current = setTimeout(() => {
        handleSignOut(true);
      }, IDLE_TIMEOUT_MS);
    }
  }, [user, handleSignOut]);

  // Activity listeners for idle timeout
  useEffect(() => {
    if (!user || user.role === 'customer') return;

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
      // Exchange code or token_hash if landing directly from an email confirmation link
      // Do not compete with ResetPasswordPage which handles recovery tokens directly
      try {
        const isResetPath =
          typeof window !== 'undefined' &&
          (window.location.pathname === '/reset-password' || window.location.pathname === '/forgot-password');

        if (!isResetPath) {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          const tokenHash = params.get('token_hash');
          const otpType = params.get('type') || 'signup';

          if (code) {
            supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
              if (!error && data?.user) {
                refreshUser();
              }
            }).catch((err) => console.warn('Global PKCE exchange notice:', err));
          } else if (tokenHash) {
            supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: (otpType as any) || 'signup',
            }).then(({ data, error }) => {
              if (!error && data?.user) {
                refreshUser();
              }
            }).catch((err) => console.warn('Global verifyOtp notice:', err));
          }
        }
      } catch {
        // ignore
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
          await refreshUser();
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
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
    if (result.user) {
      // Re-verify the live profile immediately to guarantee role accuracy from DB
      const verified = await getCurrentAdminUser();
      setUser(verified || result.user);
    } else {
      setUser(null);
    }
    setLoading(false);
    return { 
      success: !result.error && !!result.user, 
      user: result.user,
      error: result.error,
      requiresEmailConfirmation: result.requiresEmailConfirmation,
      unconfirmedEmail: result.unconfirmedEmail,
    };
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
  const isCustomer = Boolean(user && user.role === 'customer');

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
