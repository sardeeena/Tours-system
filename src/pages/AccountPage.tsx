import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Globe, 
  CalendarCheck, 
  Heart, 
  LogOut, 
  ShieldCheck, 
  Calendar, 
  MapPin, 
  Clock, 
  Printer, 
  CheckCircle2, 
  ArrowRight, 
  KeyRound, 
  Compass,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { bookingRepository } from '../services/bookingRepository';
import { Booking } from '../types/booking';
import { CurrencyConfig } from '../types';
import { downloadCalendarEvent, triggerPrintVoucher } from '../services/exportService';

interface AccountPageProps {
  currency: CurrencyConfig;
  onNavigate: (page: string, param?: string) => void;
  onOpenWishlist?: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  currency,
  onNavigate,
  onOpenWishlist,
}) => {
  const { user, signOut, updatePassword, updateProfile, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'bookings' | 'profile' | 'security'>('bookings');
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState<boolean>(true);

  // Password update form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.fullName || '');
  const [profilePhone, setProfilePhone] = useState(user?.phoneNumber || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');

  useEffect(() => {
    if (!user?.email) return;

    setIsLoadingBookings(true);
    bookingRepository
      .getBookingsByEmail(user.email)
      .then((res) => {
        setUserBookings(res);
      })
      .catch((err) => {
        console.warn('Error loading user bookings:', err);
      })
      .finally(() => {
        setIsLoadingBookings(false);
      });
  }, [user?.email]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true); setProfileError(''); setProfileNotice('');
    try {
      const result = await updateProfile({ fullName: profileName.trim(), phone: profilePhone.trim() || undefined });
      if (!result.success) throw new Error(result.error || 'Profile details could not be saved.');
      setIsEditingProfile(false);
      setProfileNotice('Your profile details have been updated.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Profile details could not be saved.');
    } finally { setIsSavingProfile(false); }
  };

  const handleSignOut = async () => {
    await signOut();
    showToast('You have been signed out.', 'info');
    onNavigate('home');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await updatePassword(newPassword);
      if (res.success) {
        setPasswordSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
        showToast('Password updated successfully.', 'success');
      } else {
        setPasswordError(res.error || 'Failed to update password.');
      }
    } catch {
      setPasswordError('An unexpected error occurred.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="flex items-center justify-center mb-4">
          <img 
            src="/logo.png" 
            alt="Awesome Adventure Tours Logo" 
            className="h-20 w-auto object-contain drop-shadow-sm"
          />
        </div>
        <h2 className="font-display text-xl font-bold text-stone-900 mb-2">Sign In Required</h2>
        <p className="text-xs text-stone-600 mb-4 max-w-sm">
          Please sign in to view your profile and manage all past and upcoming excursion bookings.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="px-6 py-2.5 bg-[#0A6C74] text-white text-xs font-semibold rounded-lg hover:bg-[#08565C] transition-colors"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* User Profile Card */}
        <div className="bg-white dark:bg-slate-900 border border-[#E8E3DA] dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-5 text-center sm:text-left">
            <div className="w-20 h-20 rounded-full bg-[#0A6C74] text-white flex items-center justify-center text-2xl font-bold border-2 border-[#0A6C74] shadow-sm overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
              ) : (
                <span>{user.fullName.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-[#0E1B2A]">
                  {user.fullName}
                </h1>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  isAdmin 
                    ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {isAdmin ? 'Staff / Admin' : 'Voyager Member'}
                </span>
              </div>
              <p className="text-xs text-stone-500 flex items-center justify-center sm:justify-start space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-stone-400" />
                <span>{user.email}</span>
              </p>
              {user.phoneNumber && (
                <p className="text-xs text-stone-500 flex items-center justify-center sm:justify-start space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  <span>{user.countryCode} {user.phoneNumber}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('booking')}
              className="px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white font-semibold text-xs rounded-lg transition-colors shadow-2xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Book Excursion</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-amber-300 font-semibold text-xs rounded-lg border border-stone-200 dark:border-stone-700 transition-colors shadow-2xs flex items-center space-x-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#0A6C74] dark:text-amber-400" />
                <span>Admin CMS</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="px-3.5 py-2 border border-stone-300 hover:bg-stone-100 text-stone-700 font-semibold text-xs rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-stone-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-sm text-xs sm:text-sm font-semibold text-stone-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-3 border-2 border-transparent flex items-center whitespace-nowrap space-x-2 transition-colors cursor-pointer ${
              activeTab === 'bookings'
                ? 'border-[#0A6C74] text-[#0A6C74] font-bold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>My Bookings ({userBookings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-1 border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#0A6C74] text-[#0A6C74] font-bold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-3 px-1 border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'border-[#0A6C74] text-[#0A6C74] font-bold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Password & Security</span>
          </button>
        </div>

        {/* Tab 1: Bookings List */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            {isLoadingBookings ? (
              <div className="p-12 text-center text-stone-500">
                <div className="w-6 h-6 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs">Loading your reservations...</p>
              </div>
            ) : userBookings.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-[#E8E3DA] dark:border-slate-700 rounded-2xl p-10 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-stone-100 text-[#0A6C74] flex items-center justify-center mx-auto">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <h3 className="font-display text-base font-bold text-stone-900">No Reservations Found</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  You haven't made any excursion reservations under this email yet. Explore our fleet of boat cruises, diving excursions, and desert safaris.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('excursions')}
                    className="px-5 py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Explore Excursions
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('my-booking')}
                    className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Lookup by Reference Code
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {userBookings.map((b) => (
                  <div
                    key={b.bookingReference}
                    className="bg-white dark:bg-slate-900 border border-[#E8E3DA] dark:border-slate-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start space-x-4">
                      {b.tourImage && (
                        <img
                          src={b.tourImage}
                          alt={b.tourTitle}
                          className="w-20 h-20 rounded-lg object-cover border border-stone-200 shrink-0"
                        />
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] font-mono font-bold text-[#0A6C74] bg-[#E8F3F4] px-2 py-0.5 rounded">
                            {b.bookingReference}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            b.status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.status === 'cancellation_requested'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}>
                            {b.status}
                          </span>
                        </div>

                        <h4 className="font-display text-sm font-bold text-stone-900">
                          {b.tourTitle}
                        </h4>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 pt-1">
                          <span className="flex items-center">
                            <Calendar className="w-3.5 h-3.5 mr-1 text-[#0A6C74]" />
                            {b.date}
                          </span>
                          <span className="flex items-center">
                            <MapPin className="w-3.5 h-3.5 mr-1 text-stone-400" />
                            {b.pickup.locationName || b.tourDestination}
                          </span>
                          <span className="font-semibold text-stone-800">
                            Total: €{b.pricing.totalEur}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-stone-100">
                      <button
                        type="button"
                        onClick={() => onNavigate('confirmation', b.bookingReference)}
                        className="px-3.5 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>View Voucher</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadCalendarEvent(b)}
                        className="p-2 border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg text-xs"
                        title="Add to Calendar (.ics)"
                      >
                        <Calendar className="w-4 h-4 text-stone-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Profile Details */}
        {activeTab === 'profile' && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
            <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-[11px] font-bold uppercase tracking-wider text-[#0A6C74] dark:text-teal-300">Personal information</p><h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Profile details</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Keep your contact information up to date for faster reservations.</p></div>
                {!isEditingProfile && <button type="button" onClick={() => { setProfileName(user.fullName); setProfilePhone(user.phoneNumber || ''); setIsEditingProfile(true); setProfileError(''); }} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">Edit profile</button>}
              </div>
              {profileNotice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-sm text-emerald-800 dark:text-emerald-200">{profileNotice}</p>}
              {profileError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-3 text-sm text-rose-800 dark:text-rose-200">{profileError}</p>}
              {isEditingProfile ? (
                <form onSubmit={handleProfileSave} className="mt-6 space-y-4">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Full name<input required minLength={2} value={profileName} onChange={(e) => setProfileName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A6C74]" /></label>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Mobile / WhatsApp<input type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="Your phone number" className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A6C74]" /></label>
                  <div className="flex flex-wrap gap-2"><button type="submit" disabled={isSavingProfile} className="rounded-xl bg-[#0A6C74] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{isSavingProfile ? 'Saving…' : 'Save changes'}</button><button type="button" onClick={() => setIsEditingProfile(false)} className="rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200">Cancel</button></div>
                </form>
              ) : (
                <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4"><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Full name</dt><dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{user.fullName}</dd></div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4"><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Email address</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{user.email}</dd></div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4"><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mobile / WhatsApp</dt><dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{user.phoneNumber ? (user.countryCode || '+20') + ' ' + user.phoneNumber : 'Not provided'}</dd></div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4"><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Country of residence</dt><dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{user.country || 'Not provided'}</dd></div>
                </dl>
              )}
            </section>
            <aside className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F3F4] text-[#0A6C74] dark:bg-teal-950/50 dark:text-teal-300"><ShieldCheck className="h-5 w-5" /></div>
              <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">Account status</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your account is ready to use for reservations and trip updates.</p>
              <div className="mt-5 border-t border-slate-100 dark:border-slate-700 pt-4"><p className="text-xs text-slate-500 dark:text-slate-400">Account email</p><p className="mt-1 break-all text-sm font-semibold text-slate-900 dark:text-slate-100">{user.email}</p></div>
              <div className="mt-4"><p className="text-xs text-slate-500 dark:text-slate-400">Membership</p><p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{isAdmin ? 'Team account' : 'Awesome Adventure member'}</p></div>
            </aside>
          </div>
        )}

        {/* Tab 3: Password & Security */}
        {activeTab === 'security' && (
          <div className="bg-white border border-[#E8E3DA] rounded-xl p-6 sm:p-8 shadow-sm space-y-5 max-w-xl">
            <h3 className="font-display text-base font-bold text-[#0E1B2A]">
              Change Account Password
            </h3>
            <p className="text-xs text-stone-500">
              Ensure your account uses a secure password of at least 6 characters.
            </p>

            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Your password has been changed successfully.</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-xs sm:text-sm bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-xs sm:text-sm bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-[#0A6C74] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="py-2.5 px-5 bg-[#0A6C74] hover:bg-[#08565C] disabled:bg-stone-400 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                {isUpdatingPassword ? 'Saving Changes...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
