import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  User,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  CalendarCheck,
  Heart,
  LogOut,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Compass,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWishlist } from '../contexts/WishlistContext';

interface CustomerProfilePageProps {
  onNavigateHome: () => void;
  onNavigateMyBooking: () => void;
  onNavigateExcursions: () => void;
  onOpenWishlist: () => void;
  onNavigateAdmin?: () => void;
}

export const CustomerProfilePage: React.FC<CustomerProfilePageProps> = ({
  onNavigateHome,
  onNavigateMyBooking,
  onNavigateExcursions,
  onOpenWishlist,
  onNavigateAdmin,
}) => {
  const { user, isAdmin, isStaff, updateProfile, updatePassword, signOut } = useAuth();
  const { wishlistCount } = useWishlist();

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Change State
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center py-20 px-4 bg-[#FAF8F5]">
        <div className="text-center max-w-md bg-white p-8 rounded-2xl shadow-sm border border-[#E8E3DA]">
          <Compass className="w-12 h-12 text-[#0A6C74] mx-auto mb-3" />
          <h2 className="font-display text-xl font-bold text-stone-900 mb-2">Please Sign In</h2>
          <p className="text-xs text-stone-600 mb-6">
            You need to be signed in to view and manage your explorer account profile.
          </p>
          <button
            type="button"
            onClick={onNavigateHome}
            className="px-5 py-2.5 bg-[#0A6C74] hover:bg-[#08565C] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Return to Homepage
          </button>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(false);

    const result = await updateProfile({
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
    });

    setProfileLoading(false);
    if (result.success) {
      setProfileSuccess(true);
      setIsEditing(false);
      setTimeout(() => setProfileSuccess(false), 4000);
    } else {
      setProfileError(result.error || 'Failed to update profile.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    const result = await updatePassword(newPassword);
    setPasswordLoading(false);

    if (result.success) {
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
      setTimeout(() => setPasswordSuccess(false), 5000);
    } else {
      setPasswordError(result.error || 'Failed to change password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E8E3DA] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0E1B2A] to-[#0A6C74] text-white flex items-center justify-center text-2xl font-bold font-display shadow-md">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                user.fullName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-display text-2xl font-bold text-stone-900">
                  {user.fullName}
                </h1>
                <span
                  className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full ${
                    isAdmin || isStaff
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1 flex items-center">
                <Mail className="w-3.5 h-3.5 mr-1 text-stone-400" />
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto">
            {isAdmin && onNavigateAdmin && (
              <button
                type="button"
                onClick={onNavigateAdmin}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-stone-800 dark:hover:bg-black dark:text-amber-300 text-xs font-semibold rounded-lg border border-stone-200 dark:border-stone-700 shadow-sm transition-all"
              >
                <span>CMS Admin Portal</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </button>
            )}

            <button
              type="button"
              onClick={signOut}
              className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5 text-stone-500" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Global Feedback Notifications */}
        {profileSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-800"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Profile details updated successfully!</span>
          </motion.div>
        )}

        {passwordSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-800"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Password successfully changed. Your account is secured.</span>
          </motion.div>
        )}

        {/* Grid of Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quick Action Tiles */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={onNavigateMyBooking}
              className="w-full p-5 bg-white hover:bg-stone-50 border border-[#E8E3DA] rounded-xl text-left transition-all group shadow-xs cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-[#E8F3F4] text-[#0A6C74] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-display text-sm font-bold text-stone-900">
                My Bookings & Vouchers
              </h3>
              <p className="text-[11px] text-stone-500 mt-1">
                Lookup booking confirmation, print Coast Guard vouchers & check pickup times.
              </p>
            </button>

            <button
              type="button"
              onClick={onOpenWishlist}
              className="w-full p-5 bg-white hover:bg-stone-50 border border-[#E8E3DA] rounded-xl text-left transition-all group shadow-xs cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Heart className="w-5 h-5 fill-rose-500" />
                </div>
                <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                  {wishlistCount} saved
                </span>
              </div>
              <h3 className="font-display text-sm font-bold text-stone-900">
                Saved Excursions
              </h3>
              <p className="text-[11px] text-stone-500 mt-1">
                Your bookmarked Red Sea yacht trips and desert adventures.
              </p>
            </button>

            <button
              type="button"
              onClick={onNavigateExcursions}
              className="w-full p-5 bg-white hover:bg-stone-50 border border-[#E8E3DA] rounded-xl text-left transition-all group shadow-xs cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Compass className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-display text-sm font-bold text-stone-900">
                Explore All Excursions
              </h3>
              <p className="text-[11px] text-stone-500 mt-1">
                Browse our fleet calendar, island trips, and diving safaris.
              </p>
            </button>
          </div>

          {/* Account Details & Security Column */}
          <div className="md:col-span-2 space-y-6">
            {/* Personal Details Box */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E8E3DA] p-6">
              <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-5">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-[#0A6C74]" />
                  <h2 className="font-display text-base font-bold text-stone-900">
                    Personal Information
                  </h2>
                </div>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setFullName(user.fullName);
                      setPhone(user.phone || '');
                      setIsEditing(true);
                    }}
                    className="text-xs text-[#0A6C74] font-semibold hover:underline cursor-pointer"
                  >
                    Edit Info
                  </button>
                )}
              </div>

              {profileError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{profileError}</span>
                </div>
              )}

              {isEditing ? (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6C74]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      WhatsApp / Mobile Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+20 100 123 4567"
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6C74]"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <button
                      type="submit"
                      disabled={profileLoading}
                      className="px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] disabled:bg-stone-400 text-white text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{profileLoading ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-stone-400 block mb-0.5">Full Name</span>
                    <span className="font-semibold text-stone-800">{user.fullName}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block mb-0.5">Email Address</span>
                    <span className="font-semibold text-stone-800">{user.email}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block mb-0.5">Mobile / WhatsApp</span>
                    <span className="font-semibold text-stone-800">
                      {user.phone || 'Not provided'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block mb-0.5">Account Status</span>
                    <span className="inline-flex items-center text-emerald-700 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Active & Verified
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Password & Security Box */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E8E3DA] p-6">
              <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-5">
                <div className="flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-[#0A6C74]" />
                  <h2 className="font-display text-base font-bold text-stone-900">
                    Security & Password
                  </h2>
                </div>
                {!showPasswordChange && (
                  <button
                    type="button"
                    onClick={() => setShowPasswordChange(true)}
                    className="text-xs text-[#0A6C74] font-semibold hover:underline cursor-pointer"
                  >
                    Change Password
                  </button>
                )}
              </div>

              {passwordError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{passwordError}</span>
                </div>
              )}

              {showPasswordChange ? (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      New Password (min. 6 characters)
                    </label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 pr-9 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6C74]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A6C74]"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] disabled:bg-stone-400 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"
                    >
                      {passwordLoading ? 'Updating...' : 'Update Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPasswordChange(false)}
                      className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>Password: ••••••••••••</span>
                  <span className="text-stone-400 text-[11px]">Protected by Supabase Auth</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
