import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useToast } from './ToastContext';
import { recordVisitorEvent } from '../services/visitorAnalyticsService';

interface WishlistContextType {
  wishlistSlugs: string[];
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string, tourTitle?: string) => void;
  removeFromWishlist: (slug: string) => void;
  clearWishlist: () => void;
  wishlistCount: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const WISHLIST_STORAGE_KEY = 'redsea_saved_excursions';

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [wishlistSlugs, setWishlistSlugs] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistSlugs));
    } catch (err) {
      console.warn('Failed to save wishlist to localStorage:', err);
    }
  }, [wishlistSlugs]);

  const isFavorite = useCallback(
    (slug: string) => wishlistSlugs.includes(slug),
    [wishlistSlugs]
  );

  const toggleFavorite = useCallback((slug: string, tourTitle?: string) => {
    const exists = wishlistSlugs.includes(slug);
    setWishlistSlugs((prev) => exists ? prev.filter((s) => s !== slug) : [...prev, slug]);
    showToast(
      exists
        ? (tourTitle ? `Removed "${tourTitle}" from saved excursions` : 'Removed from saved excursions')
        : (tourTitle ? `Saved "${tourTitle}" to your wishlist!` : 'Saved to your wishlist!'),
      exists ? 'info' : 'success'
    );
    void recordVisitorEvent({ event_name: 'wishlist_updated', page_path: window.location.pathname, event_data: { tour_slug: slug, interaction: exists ? 'removed' : 'added' } });
  }, [showToast, wishlistSlugs]);

  const removeFromWishlist = useCallback((slug: string) => {
    if (!wishlistSlugs.includes(slug)) return;
    setWishlistSlugs((prev) => prev.filter((s) => s !== slug));
    void recordVisitorEvent({ event_name: 'wishlist_updated', page_path: window.location.pathname, event_data: { tour_slug: slug, interaction: 'removed' } });
  }, [wishlistSlugs]);

  const clearWishlist = useCallback(() => {
    if (!wishlistSlugs.length) return;
    setWishlistSlugs([]);
    showToast('Wishlist cleared', 'info');
    void recordVisitorEvent({ event_name: 'wishlist_updated', page_path: window.location.pathname, event_data: { interaction: 'cleared' } });
  }, [showToast, wishlistSlugs]);

  return (
    <WishlistContext.Provider
      value={{
        wishlistSlugs,
        isFavorite,
        toggleFavorite,
        removeFromWishlist,
        clearWishlist,
        wishlistCount: wishlistSlugs.length,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
