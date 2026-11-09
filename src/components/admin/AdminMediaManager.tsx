import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Star,
  Check,
  Video,
  ExternalLink,
  MoveUp,
  MoveDown,
  AlertCircle,
  FileText,
  Plus,
  FolderOpen,
  FolderPlus,
  Search,
  RefreshCw,
  X,
  CheckSquare,
  Square,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { uploadTourMedia, listStorageMedia, StorageFileItem } from '../../services/storageService';
import { DbTourImage, DbTourVideo } from '../../types/database';

interface AdminMediaManagerProps {
  images: Array<Partial<DbTourImage>>;
  videos: Array<Partial<DbTourVideo>>;
  onImagesChange: (images: Array<Partial<DbTourImage>>) => void;
  onVideosChange: (videos: Array<Partial<DbTourVideo>>) => void;
}

export const AdminMediaManager: React.FC<AdminMediaManagerProps> = ({
  images,
  videos,
  onImagesChange,
  onVideosChange,
}) => {
  // Upload and drag-and-drop state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Video state
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoProvider, setNewVideoProvider] = useState<'youtube' | 'vimeo' | 'storage' | 'direct'>('youtube');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Media Library Selection Modal State
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState<StorageFileItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'not_in_tour' | 'in_tour'>('all');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [replaceTargetIndex, setReplaceTargetIndex] = useState<number | null>(null);

  // Load available media from Media & Storage library
  const fetchLibraryItems = async () => {
    setIsLoadingLibrary(true);
    try {
      const items = await listStorageMedia('tours');
      // Filter image items only for photography gallery
      const imageItems = items.filter(
        (item) => !item.mimeType?.startsWith('video/') && !item.name.match(/\.(mp4|webm|mov|avi)$/i)
      );
      setLibraryItems(imageItems);
    } catch (err) {
      console.warn('Failed to load media library items:', err);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  useEffect(() => {
    fetchLibraryItems();

    const handleMediaUpdated = () => {
      fetchLibraryItems();
    };
    window.addEventListener('rse_media_updated', handleMediaUpdated);
    return () => window.removeEventListener('rse_media_updated', handleMediaUpdated);
  }, []);

  // Open modal in fresh state
  const openLibraryModal = (replaceIdx?: number) => {
    setReplaceTargetIndex(replaceIdx ?? null);
    setSelectedPaths(new Set());
    setLibrarySearch('');
    setLibraryFilter('all');
    setIsLibraryModalOpen(true);
    fetchLibraryItems();
  };

  const closeLibraryModal = () => {
    setIsLibraryModalOpen(false);
    setReplaceTargetIndex(null);
    setSelectedPaths(new Set());
  };

  // Toggle selection for library item
  const toggleSelectLibraryItem = (storagePath: string) => {
    if (replaceTargetIndex !== null) {
      // Single selection mode for replacement
      setSelectedPaths(new Set([storagePath]));
      return;
    }

    const next = new Set(selectedPaths);
    if (next.has(storagePath)) {
      next.delete(storagePath);
    } else {
      next.add(storagePath);
    }
    setSelectedPaths(next);
  };

  const handleSelectAll = (itemsToSelect: StorageFileItem[]) => {
    if (replaceTargetIndex !== null) return;
    const next = new Set(selectedPaths);
    itemsToSelect.forEach((item) => next.add(item.storagePath));
    setSelectedPaths(next);
  };

  const handleDeselectAll = () => {
    setSelectedPaths(new Set());
  };

  // Confirm selection from Media Library
  const handleAddSelectedFromLibrary = () => {
    if (selectedPaths.size === 0) return;

    const selectedMediaList = libraryItems.filter((item) => selectedPaths.has(item.storagePath));
    if (selectedMediaList.length === 0) return;

    if (replaceTargetIndex !== null && replaceTargetIndex >= 0 && replaceTargetIndex < images.length) {
      // Replace specific image
      const chosen = selectedMediaList[0];
      const updated = [...images];
      updated[replaceTargetIndex] = {
        ...updated[replaceTargetIndex],
        image_url: chosen.url,
        storage_path: chosen.storagePath,
        alt_text: chosen.altText || chosen.title || updated[replaceTargetIndex].alt_text,
      };
      onImagesChange(updated);
      setFeedbackNotice(`Photo replaced with "${chosen.name}" from Media Library.`);
    } else {
      // Add selected photos to tour gallery
      const newImagesToAdd: Array<Partial<DbTourImage>> = selectedMediaList.map((item, idx) => ({
        id: `img-lib-${Date.now()}-${idx}`,
        image_url: item.url,
        storage_path: item.storagePath,
        alt_text: item.altText || item.title || item.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        caption: item.title || '',
        is_primary: images.length === 0 && idx === 0,
        sort_order: images.length + idx + 1,
      }));

      onImagesChange([...images, ...newImagesToAdd]);
      setFeedbackNotice(`Added ${newImagesToAdd.length} photo(s) from Media Library to this tour.`);
    }

    closeLibraryModal();
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // Quick Action: Set directly as Primary Cover
  const handleQuickSetCoverFromLibrary = (item: StorageFileItem) => {
    const existingIdx = images.findIndex((img) => img.storage_path === item.storagePath || img.image_url === item.url);

    if (existingIdx >= 0) {
      // If already in tour, make it primary
      setPrimaryImage(existingIdx);
    } else {
      // Add to tour as primary cover
      const newCoverImage: Partial<DbTourImage> = {
        id: `img-lib-cover-${Date.now()}`,
        image_url: item.url,
        storage_path: item.storagePath,
        alt_text: item.altText || item.title || item.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        caption: item.title || '',
        is_primary: true,
        sort_order: 1,
      };
      // Demote other images from primary
      const updatedExisting = images.map((img) => ({ ...img, is_primary: false }));
      onImagesChange([newCoverImage, ...updatedExisting]);
    }

    setFeedbackNotice(`Set "${item.name}" as Primary Cover image.`);
    closeLibraryModal();
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // File upload from device handler
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);

    const uploadedList: Array<Partial<DbTourImage>> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await uploadTourMedia(file, 'tours');
      if (result.error) {
        setUploadError(result.error);
        break;
      }

      uploadedList.push({
        id: `img-${Date.now()}-${i}`,
        image_url: result.url,
        storage_path: result.storagePath,
        alt_text: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        caption: '',
        is_primary: images.length === 0 && i === 0,
        sort_order: images.length + i + 1,
      });
    }

    if (uploadedList.length > 0) {
      onImagesChange([...images, ...uploadedList]);
      fetchLibraryItems(); // refresh library count
      setFeedbackNotice(`Successfully uploaded and added ${uploadedList.length} photo(s).`);
      setTimeout(() => setFeedbackNotice(null), 4000);
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const setPrimaryImage = (index: number) => {
    const updated = images.map((img, idx) => ({
      ...img,
      is_primary: idx === index,
    }));
    onImagesChange(updated);
  };

  const removeImage = (index: number) => {
    // Only remove from tour gallery, DO NOT delete master from storage library
    const updated = images.filter((_, idx) => idx !== index);
    if (updated.length > 0 && !updated.some((i) => i.is_primary)) {
      updated[0].is_primary = true;
    }
    onImagesChange(updated);
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= images.length) return;
    const copy = [...images];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    onImagesChange(copy);
  };

  const updateImageField = (index: number, field: 'alt_text' | 'caption', val: string) => {
    const updated = [...images];
    updated[index] = { ...updated[index], [field]: val };
    onImagesChange(updated);
  };

  // Video Management
  const addVideo = () => {
    if (!newVideoUrl.trim()) return;
    const newVid: Partial<DbTourVideo> = {
      id: `vid-${Date.now()}`,
      video_url: newVideoUrl.trim(),
      title: newVideoTitle.trim() || 'Tour Experience Video',
      provider: newVideoProvider,
      is_primary: videos.length === 0,
      sort_order: videos.length + 1,
    };
    onVideosChange([...videos, newVid]);
    setNewVideoUrl('');
    setNewVideoTitle('');
  };

  const removeVideo = (index: number) => {
    onVideosChange(videos.filter((_, i) => i !== index));
  };

  // Filtered library items for modal
  const existingStoragePaths = new Set(images.map((img) => img.storage_path).filter(Boolean));
  const existingUrls = new Set(images.map((img) => img.image_url).filter(Boolean));

  const filteredLibraryItems = libraryItems.filter((item) => {
    // Search query filter
    if (librarySearch.trim()) {
      const q = librarySearch.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchAlt = (item.altText || '').toLowerCase().includes(q);
      if (!matchName && !matchTitle && !matchAlt) return false;
    }

    // Status filter
    const isAlreadyInTour = existingStoragePaths.has(item.storagePath) || existingUrls.has(item.url);
    if (libraryFilter === 'not_in_tour' && isAlreadyInTour) return false;
    if (libraryFilter === 'in_tour' && !isAlreadyInTour) return false;

    return true;
  });

  return (
    <div className="space-y-8">
      {/* Feedback banner */}
      {feedbackNotice && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-stone-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* IMAGES SECTION */}
      <div className="space-y-4">
        {/* Gallery Header with Prominent Choose from Media Library button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <ImageIcon className="w-4 h-4 text-[#2dd4bf]" />
              <span>Tour Photography Gallery ({images.length})</span>
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Select existing pictures from your Media Library or upload new photos. The image marked "Primary Cover" is the hero banner.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Primary Action: Choose from Media Library */}
            <button
              type="button"
              onClick={() => openLibraryModal()}
              className="flex items-center space-x-2 px-3.5 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
              title="Pick pictures previously uploaded in Media & Storage"
            >
              <FolderOpen className="w-4 h-4 text-[#2dd4bf]" />
              <span>Choose from Media Library</span>
              {libraryItems.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/40 text-[#2dd4bf] font-bold">
                  {libraryItems.length}
                </span>
              )}
            </button>

            {/* Secondary Action: Upload from Computer */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-3 py-2 bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white rounded-lg text-xs font-medium border border-stone-700 transition-colors cursor-pointer"
              title="Upload new photos from local disk"
            >
              <Upload className="w-4 h-4" />
              <span>Upload New</span>
            </button>
          </div>
        </div>

        {/* Drag and Drop Zone with Dual Actions */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFileUpload(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-[#2dd4bf] bg-[#0A6C74]/10'
              : 'border-stone-700 hover:border-stone-500 bg-stone-950/60'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files)}
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-2.5">
            <div className="w-10 h-10 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-300">
              <Upload className="w-5 h-5 text-[#2dd4bf]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                {isUploading ? 'Uploading to Supabase Storage...' : 'Click to browse device or drag photos here'}
              </p>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Recommended: 1600x1060px • JPG/WebP/PNG • Max 10MB per image
              </p>
            </div>

            {/* Quick button to open Media Library inside the drop zone */}
            <div className="pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openLibraryModal();
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#0A6C74]/20 hover:bg-[#0A6C74]/30 text-[#2dd4bf] border border-[#0A6C74]/40 rounded-md text-xs font-semibold transition-colors cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Or select from Media Library ({libraryItems.length} photos available)</span>
              </button>
            </div>
          </div>
        </div>

        {uploadError && (
          <div className="p-3 bg-red-950/60 border border-red-800 rounded text-xs text-red-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Empty state when no images added yet */}
        {images.length === 0 && (
          <div className="p-8 text-center bg-stone-900/40 border border-stone-800 rounded-lg space-y-3">
            <ImageIcon className="w-10 h-10 text-stone-600 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-stone-300">No photos added to this tour yet</p>
              <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                Add compelling tour photography to attract travelers. You can choose photos you previously uploaded to your Media Library or upload new ones.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openLibraryModal()}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded-lg text-xs font-semibold shadow transition-colors cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 text-[#2dd4bf]" />
              <span>Browse Media Library</span>
            </button>
          </div>
        )}

        {/* Image Grid with Reordering, Replace & Meta Editor */}
        {images.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {images.map((img, idx) => (
              <div
                key={img.id || idx}
                className={`bg-stone-950 border rounded-lg overflow-hidden flex flex-col justify-between transition-all ${
                  img.is_primary ? 'border-[#0A6C74] ring-1 ring-[#0A6C74]' : 'border-stone-800'
                }`}
              >
                {/* Image Preview & Primary Badge */}
                <div className="relative aspect-video bg-stone-900 group">
                  <img
                    src={img.image_url}
                    alt={img.alt_text || 'Tour preview'}
                    className="w-full h-full object-cover"
                  />

                  {img.is_primary ? (
                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#0A6C74] text-white text-[10px] font-bold rounded shadow flex items-center space-x-1">
                      <Star className="w-3 h-3 fill-current text-amber-300" />
                      <span>Primary Cover</span>
                    </span>
                  ) : (
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 text-stone-300 text-[10px] font-medium rounded">
                      #{idx + 1}
                    </span>
                  )}

                  {/* Ordering, replace & delete overlay */}
                  <div className="absolute top-2 right-2 flex items-center space-x-1 bg-black/70 backdrop-blur-xs p-1 rounded-md">
                    {/* Replace from Media Library */}
                    <button
                      type="button"
                      onClick={() => openLibraryModal(idx)}
                      className="p-1 hover:text-[#2dd4bf] text-stone-300 transition-colors cursor-pointer"
                      title="Replace with another photo from Media Library"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => moveImage(idx, 'up')}
                        className="p-1 hover:text-white text-stone-300 transition-colors cursor-pointer"
                        title="Move Left / Up"
                      >
                        <MoveUp className="w-3.5 h-3.5 rotate-[-90deg]" />
                      </button>
                    )}
                    {idx < images.length - 1 && (
                      <button
                        type="button"
                        onClick={() => moveImage(idx, 'down')}
                        className="p-1 hover:text-white text-stone-300 transition-colors cursor-pointer"
                        title="Move Right / Down"
                      >
                        <MoveDown className="w-3.5 h-3.5 rotate-[-90deg]" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="p-1 hover:text-red-400 text-stone-400 transition-colors cursor-pointer"
                      title="Remove from tour gallery"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Metadata inputs */}
                <div className="p-3 space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-stone-400 block mb-0.5">
                      Alt Text (SEO & Accessibility)
                    </label>
                    <input
                      type="text"
                      value={img.alt_text || ''}
                      onChange={(e) => updateImageField(idx, 'alt_text', e.target.value)}
                      placeholder="e.g. Snorkelers over coral reef at Giftun"
                      className="w-full px-2 py-1 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#0A6C74] text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-semibold text-stone-400 block mb-0.5">
                      Caption (Optional)
                    </label>
                    <input
                      type="text"
                      value={img.caption || ''}
                      onChange={(e) => updateImageField(idx, 'caption', e.target.value)}
                      placeholder="e.g. Shallow turquoise lagoon at Orange Bay"
                      className="w-full px-2 py-1 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-600 focus:outline-none focus:border-[#0A6C74] text-xs"
                    />
                  </div>

                  {!img.is_primary && (
                    <button
                      type="button"
                      onClick={() => setPrimaryImage(idx)}
                      className="w-full mt-2 py-1 px-2 bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white rounded text-[11px] font-medium transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Star className="w-3 h-3 text-amber-400" />
                      <span>Set as Primary Cover</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VIDEOS SECTION */}
      <div className="pt-6 border-t border-stone-800 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Video className="w-4 h-4 text-sky-400" />
            <span>Tour Video Experiences</span>
          </h3>
          <p className="text-xs text-stone-400">
            Add YouTube or Vimeo URLs, or link direct video recordings stored in Supabase Storage.
          </p>
        </div>

        {/* Video Add Row */}
        <div className="bg-stone-950 p-4 rounded-lg border border-stone-800 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="md:col-span-2">
            <label className="text-[10px] font-semibold text-stone-400 uppercase block mb-1">
              Video URL (YouTube / Vimeo / Direct)
            </label>
            <input
              type="text"
              value={newVideoUrl}
              onChange={(e) => setNewVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-white text-xs focus:outline-none focus:border-[#0A6C74]"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-stone-400 uppercase block mb-1">
              Title / Description
            </label>
            <input
              type="text"
              value={newVideoTitle}
              onChange={(e) => setNewVideoTitle(e.target.value)}
              placeholder="e.g. 4K Drone Tour Reel"
              className="w-full px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-white text-xs focus:outline-none focus:border-[#0A6C74]"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={addVideo}
              className="w-full py-1.5 px-3 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold flex items-center justify-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Attach Video</span>
            </button>
          </div>
        </div>

        {/* Attached Videos List */}
        {videos.length > 0 && (
          <div className="space-y-2">
            {videos.map((vid, idx) => (
              <div
                key={vid.id || idx}
                className="p-3 bg-stone-950 border border-stone-800 rounded-md flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-3">
                  <Video className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-white block">{vid.title}</span>
                    <a
                      href={vid.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-stone-400 hover:text-white flex items-center space-x-1"
                    >
                      <span className="truncate max-w-sm">{vid.video_url}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeVideo(idx)}
                  className="p-1.5 text-stone-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CHOOSE FROM MEDIA LIBRARY MODAL                                           */}
      {/* ========================================================================= */}
      {isLibraryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-stone-950 border border-stone-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-stone-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-[#0A6C74]/20 border border-[#0A6C74]/40 flex items-center justify-center text-[#2dd4bf]">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>
                      {replaceTargetIndex !== null
                        ? `Replace Photo #${replaceTargetIndex + 1} from Media Library`
                        : 'Choose Photos from Media Library'}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-800 text-stone-300">
                      {libraryItems.length} Available
                    </span>
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    {replaceTargetIndex !== null
                      ? 'Select an existing photo from your library to replace the current image.'
                      : 'Pick pictures previously uploaded in Media & Storage to attach to this tour.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeLibraryModal}
                className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search & Filter Toolbar */}
            <div className="p-4 border-b border-stone-800/80 bg-stone-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Search bar */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search photos by filename, title, or alt text..."
                  className="w-full pl-9 pr-8 py-1.5 bg-stone-900 border border-stone-800 rounded-lg text-white text-xs placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
                />
                {librarySearch && (
                  <button
                    type="button"
                    onClick={() => setLibrarySearch('')}
                    className="absolute right-2.5 top-2.5 text-stone-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center space-x-1 bg-stone-900 p-1 rounded-lg border border-stone-800">
                <button
                  type="button"
                  onClick={() => setLibraryFilter('all')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    libraryFilter === 'all'
                      ? 'bg-[#0A6C74] text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  All ({libraryItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLibraryFilter('not_in_tour')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    libraryFilter === 'not_in_tour'
                      ? 'bg-[#0A6C74] text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Not in Tour
                </button>
                <button
                  type="button"
                  onClick={() => setLibraryFilter('in_tour')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    libraryFilter === 'in_tour'
                      ? 'bg-[#0A6C74] text-white shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Already in Tour ({images.length})
                </button>
              </div>

              {/* Selection & Refresh Controls */}
              <div className="flex items-center space-x-2">
                {replaceTargetIndex === null && filteredLibraryItems.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(filteredLibraryItems)}
                      className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Select All
                    </button>
                    {selectedPaths.size > 0 && (
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="px-2.5 py-1 bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={fetchLibraryItems}
                  disabled={isLoadingLibrary}
                  className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded transition-colors cursor-pointer"
                  title="Refresh library"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLibrary ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Modal Body: Media Grid */}
            <div className="flex-1 overflow-y-auto p-4 max-h-[55vh] scrollbar-thin scrollbar-thumb-stone-800">
              {isLoadingLibrary ? (
                <div className="py-20 text-center text-xs text-stone-400 space-y-2">
                  <div className="w-7 h-7 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Loading your pictures from Media & Storage...</p>
                </div>
              ) : filteredLibraryItems.length === 0 ? (
                <div className="py-16 text-center text-xs text-stone-400 space-y-3">
                  <ImageIcon className="w-10 h-10 text-stone-600 mx-auto" />
                  <div>
                    <p className="font-semibold text-stone-300 text-sm">
                      {librarySearch ? 'No matching photos found' : 'No photos found in your Media Library'}
                    </p>
                    <p className="text-[11px] text-stone-500 max-w-sm mx-auto mt-1">
                      {librarySearch
                        ? `No pictures matched "${librarySearch}". Try another keyword or clear the search.`
                        : 'Upload photos using the drag-and-drop zone or visit the Media & Storage module to add pictures.'}
                    </p>
                  </div>
                  {librarySearch && (
                    <button
                      type="button"
                      onClick={() => setLibrarySearch('')}
                      className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-xs cursor-pointer"
                    >
                      Clear Search Filter
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredLibraryItems.map((item) => {
                    const isSelected = selectedPaths.has(item.storagePath);
                    const isAlreadyInTour = existingStoragePaths.has(item.storagePath) || existingUrls.has(item.url);

                    return (
                      <div
                        key={item.id || item.storagePath}
                        onClick={() => toggleSelectLibraryItem(item.storagePath)}
                        className={`group relative bg-stone-900 rounded-lg overflow-hidden border cursor-pointer select-none transition-all duration-150 flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#2dd4bf] ring-2 ring-[#0A6C74] shadow-md'
                            : isAlreadyInTour
                            ? 'border-stone-800 opacity-80 hover:opacity-100 hover:border-stone-700'
                            : 'border-stone-800 hover:border-stone-600 hover:shadow-sm'
                        }`}
                      >
                        {/* Photo Thumbnail */}
                        <div className="aspect-video relative bg-stone-950 overflow-hidden">
                          <img
                            src={item.url}
                            alt={item.altText || item.title || item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />

                          {/* Selection Checkbox Pill */}
                          <div className="absolute top-2 left-2 z-10">
                            {isSelected ? (
                              <div className="w-5 h-5 rounded bg-[#0A6C74] text-white flex items-center justify-center shadow">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded bg-black/60 border border-white/40 flex items-center justify-center opacity-80 group-hover:opacity-100">
                                <Square className="w-3 h-3 text-white/50" />
                              </div>
                            )}
                          </div>

                          {/* Already in Tour Badge */}
                          {isAlreadyInTour && (
                            <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded text-[9px] font-bold bg-stone-900/90 text-stone-300 border border-stone-700 shadow flex items-center space-x-1">
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                              <span>In Tour</span>
                            </div>
                          )}

                          {/* Hover action: Quick Set as Cover */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickSetCoverFromLibrary(item);
                              }}
                              className="px-2.5 py-1 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-[10px] font-bold shadow flex items-center space-x-1 cursor-pointer transition-colors"
                              title="Set this photo as primary cover hero"
                            >
                              <Star className="w-3 h-3 text-amber-300 fill-current" />
                              <span>Set as Cover</span>
                            </button>
                          </div>
                        </div>

                        {/* Card Info Footer */}
                        <div className="p-2.5 bg-stone-950 border-t border-stone-900 text-[11px] space-y-0.5">
                          <p className="font-medium text-stone-200 truncate" title={item.title || item.name}>
                            {item.title || item.name}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-stone-400">
                            <span>{(item.sizeBytes / 1024).toFixed(0)} KB</span>
                            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-stone-800 bg-stone-950 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2 text-stone-400">
                <Info className="w-4 h-4 text-stone-500 shrink-0" />
                <span>
                  {replaceTargetIndex !== null ? (
                    selectedPaths.size > 0 ? (
                      <strong className="text-white">1 photo selected for replacement</strong>
                    ) : (
                      'Click a photo above to select it as the replacement'
                    )
                  ) : selectedPaths.size > 0 ? (
                    <span className="text-stone-300">
                      <strong className="text-[#2dd4bf] font-bold">{selectedPaths.size}</strong> photo(s) selected
                    </span>
                  ) : (
                    'Click photos above to select one or multiple images'
                  )}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={closeLibraryModal}
                  className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white rounded-lg text-xs font-medium border border-stone-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleAddSelectedFromLibrary}
                  disabled={selectedPaths.size === 0}
                  className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow transition-all cursor-pointer ${
                    selectedPaths.size > 0
                      ? 'bg-[#0A6C74] hover:bg-[#08565C] text-white'
                      : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {replaceTargetIndex !== null
                      ? 'Replace Current Photo'
                      : `Add ${selectedPaths.size > 0 ? `(${selectedPaths.size}) ` : ''}to Tour`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
