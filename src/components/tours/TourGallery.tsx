import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface TourGalleryProps {
  primaryImage: string;
  galleryImages: string[];
  tourTitle: string;
}

export const TourGallery: React.FC<TourGalleryProps> = ({
  primaryImage,
  galleryImages,
  tourTitle,
}) => {
  const allImages = Array.from(new Set([primaryImage, ...galleryImages].filter(Boolean)));
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleOpenLightbox = (index: number) => {
    if (allImages.length === 0) return;
    setActivePhotoIndex(index);
    setLightboxOpen(true);
  };

  const nextPhoto = () => {
    if (allImages.length < 2) return;
    setActivePhotoIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevPhoto = () => {
    if (allImages.length < 2) return;
    setActivePhotoIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  useEffect(() => {
    if (!lightboxOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setLightboxOpen(false);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextPhoto();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prevPhoto();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = closeButtonRef.current?.closest('[role="dialog"]');
      if (!(dialog instanceof HTMLElement)) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [lightboxOpen, allImages.length]);

  return (
    <>
      <div className="relative rounded-sm overflow-hidden bg-stone-100 border border-[#E8E3DA]">
        {allImages.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-1 sm:gap-2 h-[320px] sm:h-[420px]">
              <button
                type="button"
                aria-label={`Open ${tourTitle} photo gallery`}
                onClick={() => handleOpenLightbox(0)}
                className="md:col-span-3 h-full w-full relative cursor-pointer group overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0A6C74]"
              >
                <img
                  src={allImages[0]}
                  alt={`${tourTitle} primary`}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
              </button>

              <div className="hidden md:flex flex-col gap-1 sm:gap-2 h-full">
                {allImages.slice(1, 4).map((img, idx) => (
                  <button
                    key={img}
                    type="button"
                    aria-label={`View photo ${idx + 2} of ${tourTitle}`}
                    className="relative min-h-0 flex-1 cursor-pointer group overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0A6C74]"
                    onClick={() => handleOpenLightbox(idx + 1)}
                  >
                    <img
                      src={img}
                      alt={`${tourTitle} preview ${idx + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/15 group-hover:bg-transparent transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenLightbox(0)}
              className="absolute bottom-3 right-3 min-h-11 bg-white/95 hover:bg-white text-stone-900 text-xs font-semibold px-3 py-2 rounded-lg shadow-md border border-stone-200 flex items-center space-x-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6C74] focus-visible:ring-offset-2"
            >
              <Camera className="w-4 h-4 text-[#0A6C74]" />
              <span>View all {allImages.length} photos</span>
            </button>
          </>
        ) : (
          <div className="flex h-[240px] sm:h-[320px] items-center justify-center gap-2 bg-stone-100 text-stone-500" role="img" aria-label={`No photos available for ${tourTitle}`}>
            <Camera className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm">Photos coming soon</span>
          </div>
        )}
      </div>

      {lightboxOpen && allImages.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${tourTitle} photo gallery`}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close photo gallery"
            className="absolute top-4 right-4 min-h-11 min-w-11 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-6 h-6" />
          </button>

          {allImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevPhoto}
                aria-label="Previous photo"
                className="absolute left-4 min-h-11 min-w-11 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={nextPhoto}
                aria-label="Next photo"
                className="absolute right-4 min-h-11 min-w-11 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center">
            <img
              src={allImages[activePhotoIndex]}
              alt={`Photo ${activePhotoIndex + 1} of ${tourTitle}`}
              loading="eager"
              decoding="async"
              className="max-h-[75vh] w-auto object-contain rounded-sm shadow-2xl"
            />
            <span className="text-xs text-white/70 mt-3 font-medium" aria-live="polite">
              {activePhotoIndex + 1} of {allImages.length} • {tourTitle}
            </span>
          </div>
        </div>
      )}
    </>
  );
};
