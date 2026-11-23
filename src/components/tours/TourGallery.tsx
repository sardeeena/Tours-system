import React, { useState } from 'react';
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

  const handleOpenLightbox = (index: number) => {
    setActivePhotoIndex(index);
    setLightboxOpen(true);
  };

  const nextPhoto = () => {
    setActivePhotoIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevPhoto = () => {
    setActivePhotoIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  return (
    <>
      <div className="relative rounded-sm overflow-hidden bg-stone-100 border border-[#E8E3DA]">
        {/* Desktop Grid Layout: Main large image on left, 3-4 smaller images on right */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-1 sm:gap-2 h-[320px] sm:h-[420px]">
          
          {/* Main Large Image */}
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

          {/* Right Thumbnails Column */}
          <div className="hidden md:flex flex-col gap-1 sm:gap-2 h-full">
            {allImages.slice(1, 4).map((img, idx) => (
              <button
                key={idx}
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

        {/* "View all photos" button */}
        <button
          type="button"
          onClick={() => handleOpenLightbox(0)}
          className="absolute bottom-3 right-3 min-h-11 bg-white/95 hover:bg-white text-stone-900 text-xs font-semibold px-3 py-2 rounded-lg shadow-md border border-stone-200 flex items-center space-x-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6C74] focus-visible:ring-offset-2"
        >
          <Camera className="w-4 h-4 text-[#0A6C74]" />
          <span>View all {allImages.length} photos</span>
        </button>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div role="dialog" aria-modal="true" aria-label={`${tourTitle} photo gallery`} className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close photo gallery"
            className="absolute top-4 right-4 min-h-11 min-w-11 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={prevPhoto}
            aria-label="Previous photo"
            className="absolute left-4 min-h-11 min-w-11 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center">
            <img
              src={allImages[activePhotoIndex]}
              alt={`Photo ${activePhotoIndex + 1}`}
              loading="eager"
              decoding="async"
              className="max-h-[75vh] w-auto object-contain rounded-sm shadow-2xl"
            />
            <span className="text-xs text-white/70 mt-3 font-medium">
              {activePhotoIndex + 1} of {allImages.length} • {tourTitle}
            </span>
          </div>

          <button
            type="button"
            onClick={nextPhoto}
            aria-label="Next photo"
            className="absolute right-4 min-h-11 min-w-11 p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </>
  );
};
