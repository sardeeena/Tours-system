import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  LogIn,
  UserPlus,
  LogOut,
  CalendarCheck,
  Heart,
  ChevronDown,
  LayoutDashboard,
  Shield,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWishlist } from '../../contexts/WishlistContext';

interface UserMenuProps {
  onNavigateProfile?: () => void;
  onNavigateMyBooking?: () => void;
  onNavigateAdmin?: () => void;
  onOpenWishlist?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  onNavigateProfile,
  onNavigateMyBooking,
  onNavigateAdmin,
  onOpenWishlist,
}) => {
  const { user, isAdmin, isStaff, openAuthModal, signOut } = useAuth();
  const { wishlistCount } = useWishlist();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Not logged in: Show "Sign In" and "Register" buttons
  if (!user) {
    return (
      <div className="flex items-center space-x-1.5">
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:text-[#0A6C74] bg-stone-100/80 hover:bg-stone-200/80 rounded-sm border border-stone-200 transition-colors cursor-pointer"
        >
          <LogIn className="w-3.5 h-3.5 mr-1 text-[#0A6C74]" />
          <span>Sign In</span>
        </button>
        <button
          type="button"
          onClick={() => openAuthModal('register')}
          className="hidden sm:inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-[#0A6C74] hover:text-white bg-[#0A6C74]/10 hover:bg-[#0A6C74] rounded-sm border border-[#0A6C74]/30 transition-all cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5 mr-1" />
          <span>Register</span>
        </button>
      </div>
    );
  }

  // User is logged in: Show Avatar + Dropdown menu
  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center space-x-2 p-1 pl-1.5 pr-2.5 rounded-full bg-white hover:bg-stone-100 border border-stone-300 shadow-2xs transition-colors cursor-pointer"
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
      >
        <div className="w-6 h-6 rounded-full bg-[#0A6C74] text-white flex items-center justify-center text-[11px] font-bold overflow-hidden">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
          ) : (
            user.fullName.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-xs font-semibold text-stone-800 max-w-[90px] sm:max-w-[120px] truncate">
          {user.fullName.split(' ')[0]}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-stone-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-stone-200 py-1.5 z-50 overflow-hidden text-xs"
          >
            {/* User Info Header */}
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
              <div className="font-semibold text-stone-900 truncate">{user.fullName}</div>
              <div className="text-[11px] text-stone-500 truncate">{user.email}</div>
              <div className="mt-1.5 flex items-center space-x-1.5">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                    isAdmin || isStaff
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <Shield className="w-2.5 h-2.5 mr-1" />
                  {user.role}
                </span>
              </div>
            </div>

            {/* Links */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  if (onNavigateProfile) onNavigateProfile();
                }}
                className="w-full px-4 py-2 text-left text-stone-700 hover:bg-[#E8F3F4] hover:text-[#0A6C74] flex items-center space-x-2.5 transition-colors cursor-pointer"
              >
                <User className="w-4 h-4 text-stone-400" />
                <span>My Profile & Settings</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  if (onNavigateMyBooking) onNavigateMyBooking();
                }}
                className="w-full px-4 py-2 text-left text-stone-700 hover:bg-[#E8F3F4] hover:text-[#0A6C74] flex items-center space-x-2.5 transition-colors cursor-pointer"
              >
                <CalendarCheck className="w-4 h-4 text-stone-400" />
                <span>My Bookings & Vouchers</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  if (onOpenWishlist) onOpenWishlist();
                }}
                className="w-full px-4 py-2 text-left text-stone-700 hover:bg-[#E8F3F4] hover:text-[#0A6C74] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2.5">
                  <Heart className="w-4 h-4 text-stone-400" />
                  <span>Saved Excursions</span>
                </div>
                {wishlistCount > 0 && (
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">
                    {wishlistCount}
                  </span>
                )}
              </button>

              {/* Admin Portal link if privileged */}
              {(isAdmin || isStaff) && onNavigateAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    onNavigateAdmin();
                  }}
                  className="w-full px-4 py-2 text-left text-amber-900 bg-amber-50/70 hover:bg-amber-100 flex items-center space-x-2.5 transition-colors cursor-pointer font-medium"
                >
                  <LayoutDashboard className="w-4 h-4 text-amber-700" />
                  <span>CMS Admin Portal</span>
                </button>
              )}
            </div>

            {/* Sign Out */}
            <div className="border-t border-stone-100 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  signOut();
                }}
                className="w-full px-4 py-2 text-left text-rose-700 hover:bg-rose-50 flex items-center space-x-2.5 transition-colors cursor-pointer font-medium"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
