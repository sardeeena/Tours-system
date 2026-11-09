import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Film,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Compass,
  Edit2,
  FileCheck,
  Link,
  Sparkles,
  Info,
  ShieldCheck,
  HardDrive,
  Database,
  CheckCircle2,
} from 'lucide-react';
import {
  listStorageMedia,
  uploadTourMedia,
  replaceTourMedia,
  deleteTourMedia,
  updateMediaAssetMetadata,
  auditOrphanedStorageFiles,
  cleanOrphanedStorageFiles,
  StorageFileItem,
  MediaAssetAuditResult,
  MEDIA_BUCKET,
} from '../../services/storageService';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { adminListTours } from '../../services/tourService';
import { DbTour } from '../../types/database';
import { useToast } from '../../contexts/ToastContext';

export const AdminMediaLibrary: React.FC = () => {
  const { showToast } = useToast();
  const [mediaItems, setMediaItems] = useState<StorageFileItem[]>([]);
  const [tours, setTours] = useState<DbTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected item for Detail/Edit modal
  const [selectedMedia, setSelectedMedia] = useState<StorageFileItem | null>(null);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaAltText, setMetaAltText] = useState('');
  const [metaTourId, setMetaTourId] = useState('');
  const [attachingToTour, setAttachingToTour] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [replacingMedia, setReplacingMedia] = useState(false);

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<StorageFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Orphan Audit state
  const [auditResult, setAuditResult] = useState<MediaAssetAuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [cleaningOrphans, setCleaningOrphans] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = async () => {
    setLoading(true);
    setUploadError(null);
    try {
      const [items, loadedTours] = await Promise.all([
        listStorageMedia('tours'),
        adminListTours(),
      ]);
      setMediaItems(items);
      setTours(loadedTours);
    } catch (err: any) {
      console.warn('Failed to load media items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await uploadTourMedia(file, 'tours');
        if (res.error) {
          setUploadError(res.error);
          break;
        }
      }
      showToast('Media uploaded to Supabase Storage & registered in media_assets.', 'success');
      await fetchMedia();
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleOpenDetail = (item: StorageFileItem) => {
    setSelectedMedia(item);
    setMetaTitle(item.title || item.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    setMetaAltText(item.altText || '');
    setMetaTourId(item.tourId || '');
  };

  const handleSaveMetadata = async () => {
    if (!selectedMedia) return;
    setSavingMeta(true);
    try {
      await updateMediaAssetMetadata(selectedMedia.storagePath, {
        title: metaTitle,
        altText: metaAltText,
        tourId: metaTourId || null,
      });

      // Update in local state
      setMediaItems((prev) =>
        prev.map((item) =>
          item.storagePath === selectedMedia.storagePath
            ? {
                ...item,
                title: metaTitle,
                altText: metaAltText,
                tourId: metaTourId || null,
              }
            : item
        )
      );

      setSelectedMedia((prev) =>
        prev
          ? {
              ...prev,
              title: metaTitle,
              altText: metaAltText,
              tourId: metaTourId || null,
            }
          : null
      );

      showToast('Metadata updated in media_assets table.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update metadata', 'error');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleAttachToTour = async (asPrimary: boolean) => {
    if (!selectedMedia || !metaTourId) {
      showToast('Please select a tour to associate with this media.', 'info');
      return;
    }

    setAttachingToTour(true);
    try {
      // 1. Update in media_assets table
      await updateMediaAssetMetadata(selectedMedia.storagePath, {
        title: metaTitle,
        altText: metaAltText,
        tourId: metaTourId,
      });

      // 2. Also register in tour_images table for tour gallery compatibility
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('tour_images').insert({
          tour_id: metaTourId,
          image_url: selectedMedia.url,
          storage_path: selectedMedia.storagePath,
          alt_text: metaAltText || metaTitle,
          is_primary: asPrimary,
          sort_order: asPrimary ? 0 : 5,
        });

        if (error) {
          console.warn('tour_images table insert warning:', error);
        }
      }

      const matched = tours.find((t) => t.id === metaTourId);
      showToast(
        `Associated with "${matched?.title || 'Tour'}" as ${asPrimary ? 'primary cover' : 'gallery photo'}.`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to attach image to tour', 'error');
    } finally {
      setAttachingToTour(false);
    }
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMedia) return;

    setReplacingMedia(true);
    try {
      const res = await replaceTourMedia(selectedMedia.storagePath, file, 'tours', {
        title: metaTitle,
        altText: metaAltText,
        tourId: metaTourId,
      });

      if (res.error) {
        showToast(res.error, 'error');
        return;
      }

      showToast('Asset replaced in Supabase Storage and media_assets without orphaned files.', 'success');
      setSelectedMedia(null);
      await fetchMedia();
    } catch (err: any) {
      showToast(err.message || 'Failed to replace media', 'error');
    } finally {
      setReplacingMedia(false);
      if (replaceInputRef.current) {
        replaceInputRef.current.value = '';
      }
    }
  };

  const handleDelete = (item: StorageFileItem) => {
    setItemToDelete(item);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    const res = await deleteTourMedia(itemToDelete.storagePath);
    if (res.success) {
      setMediaItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      if (selectedMedia?.id === itemToDelete.id) {
        setSelectedMedia(null);
      }
      showToast(
        `Media "${itemToDelete.name}" purged from storage bucket and media_assets table.`,
        'success'
      );
    } else {
      showToast(`Failed to delete: ${res.error || 'Unknown storage error'}`, 'error');
    }
    setItemToDelete(null);
    setIsDeleting(false);
  };

  const handleRunOrphanAudit = async () => {
    setAuditing(true);
    try {
      const result = await auditOrphanedStorageFiles('tours');
      setAuditResult(result);
      setShowAuditPanel(true);
      if (result.orphanedInStorage.length === 0) {
        showToast('Storage audit passed: 0 orphaned files found!', 'success');
      } else {
        showToast(`Audit detected ${result.orphanedInStorage.length} orphaned files in bucket.`, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Audit failed', 'error');
    } finally {
      setAuditing(false);
    }
  };

  const handleCleanOrphans = async () => {
    if (!auditResult || auditResult.orphanedInStorage.length === 0) return;
    setCleaningOrphans(true);
    try {
      const purged = await cleanOrphanedStorageFiles(auditResult.orphanedInStorage);
      showToast(`Successfully purged ${purged} orphaned file(s) from Supabase Storage.`, 'success');
      await handleRunOrphanAudit();
      await fetchMedia();
    } catch (err: any) {
      showToast(err.message || 'Cleanup error', 'error');
    } finally {
      setCleaningOrphans(false);
    }
  };

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('Public CDN URL copied to clipboard!', 'info');
  };

  const getFileType = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg'].includes(ext || '')) return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'avif') return 'image/avif';
    if (ext === 'mp4') return 'video/mp4';
    if (ext === 'webm') return 'video/webm';
    return `file/${ext || 'unknown'}`;
  };

  const filteredItems = mediaItems.filter((item) => {
    const isVideo =
      item.name.endsWith('.mp4') || item.name.endsWith('.webm') || item.name.endsWith('.mov');
    if (filterType === 'image' && isVideo) return false;
    if (filterType === 'video' && !isVideo) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.altText && item.altText.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center space-x-2">
            <ImageIcon className="w-6 h-6 text-[#2dd4bf]" />
            <span>Supabase Media Library & Asset Registry</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Connected to bucket <code className="text-[#2dd4bf] font-mono">{MEDIA_BUCKET}</code> and synchronized with the <code className="text-[#2dd4bf] font-mono">media_assets</code> metadata table to guarantee zero orphaned files.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRunOrphanAudit}
            disabled={auditing || !isSupabaseConfigured()}
            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer disabled:opacity-40"
            title="Scan for orphaned storage files"
          >
            <ShieldCheck className={`w-3.5 h-3.5 text-emerald-400 ${auditing ? 'animate-spin' : ''}`} />
            <span>{auditing ? 'Auditing...' : 'Orphan Audit'}</span>
          </button>

          <button
            type="button"
            onClick={fetchMedia}
            disabled={loading}
            className="p-2 bg-stone-900 border border-stone-800 text-stone-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
            title="Refresh library"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-xs font-semibold shadow transition-colors cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Uploading...' : 'Upload Media'}</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files)}
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
            className="hidden"
          />
        </div>
      </div>

      {/* Orphan Audit Results Banner */}
      {showAuditPanel && auditResult && (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-stone-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold">Storage Integrity Audit Results</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAuditPanel(false)}
              className="text-stone-500 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-stone-300">
            <div className="p-2 bg-stone-900/60 rounded border border-stone-800">
              <span className="text-[10px] text-stone-500 uppercase block font-bold">Bucket Files</span>
              <span className="font-mono text-sm font-semibold text-white">{auditResult.totalStorageFiles}</span>
            </div>
            <div className="p-2 bg-stone-900/60 rounded border border-stone-800">
              <span className="text-[10px] text-stone-500 uppercase block font-bold">media_assets Rows</span>
              <span className="font-mono text-sm font-semibold text-white">{auditResult.totalDbRecords}</span>
            </div>
            <div className="p-2 bg-stone-900/60 rounded border border-stone-800">
              <span className="text-[10px] text-stone-500 uppercase block font-bold">Synchronized</span>
              <span className="font-mono text-sm font-semibold text-emerald-400">{auditResult.synchronizedCount}</span>
            </div>
            <div className="p-2 bg-stone-900/60 rounded border border-stone-800">
              <span className="text-[10px] text-stone-500 uppercase block font-bold">Orphaned Files</span>
              <span className={`font-mono text-sm font-semibold ${auditResult.orphanedInStorage.length > 0 ? 'text-amber-400' : 'text-stone-400'}`}>
                {auditResult.orphanedInStorage.length}
              </span>
            </div>
          </div>

          {auditResult.orphanedInStorage.length > 0 ? (
            <div className="flex items-center justify-between pt-2 border-t border-stone-800">
              <span className="text-amber-400 text-[11px]">
                {auditResult.orphanedInStorage.length} file(s) in storage have no database reference.
              </span>
              <button
                type="button"
                onClick={handleCleanOrphans}
                disabled={cleaningOrphans}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-semibold cursor-pointer disabled:opacity-50"
              >
                {cleaningOrphans ? 'Purging...' : 'Purge Orphaned Files'}
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-emerald-400 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Zero orphaned files detected. All bucket assets are cleanly indexed in media_assets.</span>
            </div>
          )}
        </div>
      )}

      {/* Error alert */}
      {uploadError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-950 border border-stone-800 rounded-lg p-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search filename, title, or alt text..."
            className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-[#0A6C74]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-stone-400 text-xs hidden sm:inline">Filter:</span>
          <div className="inline-flex rounded border border-stone-800 bg-stone-900 p-0.5">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-[#0A6C74] text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              All ({mediaItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('image')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filterType === 'image'
                  ? 'bg-[#0A6C74] text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Images
            </button>
            <button
              type="button"
              onClick={() => setFilterType('video')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filterType === 'video'
                  ? 'bg-[#0A6C74] text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Videos
            </button>
          </div>
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="p-12 text-center text-stone-400">
          <div className="w-8 h-8 border-2 border-[#0A6C74] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Connecting to Supabase Storage & media_assets table...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-12 text-center text-stone-400 space-y-2">
          <ImageIcon className="w-8 h-8 text-stone-600 mx-auto" />
          <p className="text-sm font-semibold text-stone-300">
            {mediaItems.length === 0
              ? 'No files uploaded yet in the "tour-media" bucket'
              : 'No media matches your search'}
          </p>
          <p className="text-xs text-stone-500">
            {mediaItems.length === 0
              ? 'Upload your first high-resolution excursion photo or video above.'
              : 'Try clearing your search query or filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredItems.map((item) => {
            const isVideo =
              item.name.endsWith('.mp4') || item.name.endsWith('.webm') || item.name.endsWith('.mov');

            return (
              <div
                key={item.id}
                className="bg-stone-950 border border-stone-800 hover:border-stone-700 rounded-lg overflow-hidden group transition-all flex flex-col justify-between"
              >
                {/* Thumbnail */}
                <div
                  onClick={() => handleOpenDetail(item)}
                  className="aspect-square bg-stone-900 relative overflow-hidden flex items-center justify-center cursor-pointer"
                >
                  {isVideo ? (
                    <div className="text-center p-3">
                      <Film className="w-8 h-8 text-[#2dd4bf] mx-auto mb-1" />
                      <span className="text-[10px] text-stone-400 font-mono block">Video File</span>
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={item.altText || item.title || item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyUrl(item.url, item.id);
                      }}
                      className="p-1.5 bg-stone-800 hover:bg-stone-700 text-white rounded text-xs transition-colors cursor-pointer"
                      title="Copy Public CDN URL"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(item);
                      }}
                      className="p-1.5 bg-stone-800 hover:bg-stone-700 text-white rounded text-xs transition-colors cursor-pointer"
                      title="Inspect & Edit Metadata"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item);
                      }}
                      className="p-1.5 bg-red-950 hover:bg-red-800 text-red-200 rounded text-xs transition-colors cursor-pointer"
                      title="Delete from bucket and media_assets"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Metadata */}
                <div
                  onClick={() => handleOpenDetail(item)}
                  className="p-2.5 text-xs space-y-1 cursor-pointer"
                >
                  <p className="text-stone-200 font-medium truncate text-[11px]" title={item.title || item.name}>
                    {item.title || item.name}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono">
                    <span>{formatBytes(item.sizeBytes)}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Media Detail & Tour Association Drawer / Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-[#2dd4bf]" />
                <span>Media Asset Details & media_assets Registry</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedMedia(null)}
                className="text-stone-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Media Preview Box */}
              <div className="space-y-3">
                <div className="aspect-video bg-stone-950 rounded-lg overflow-hidden border border-stone-800 flex items-center justify-center">
                  {selectedMedia.name.endsWith('.mp4') || selectedMedia.name.endsWith('.webm') ? (
                    <video
                      src={selectedMedia.url}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src={selectedMedia.url}
                      alt={metaAltText || selectedMedia.name}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => replaceInputRef.current?.click()}
                    disabled={replacingMedia}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{replacingMedia ? 'Replacing...' : 'Replace File'}</span>
                  </button>
                  <input
                    type="file"
                    ref={replaceInputRef}
                    onChange={handleReplaceFile}
                    accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => copyUrl(selectedMedia.url, selectedMedia.id)}
                    className="inline-flex items-center space-x-1 py-1.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </button>

                  <a
                    href={selectedMedia.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded transition-colors"
                    title="Open original CDN file"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="p-3 bg-stone-950 rounded border border-stone-800 space-y-1.5 font-mono text-[10px] text-stone-400">
                  <div className="flex justify-between">
                    <span>Path:</span>
                    <span className="text-stone-200 truncate max-w-[180px]">
                      {selectedMedia.storagePath}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>MIME Type:</span>
                    <span className="text-stone-200">{getFileType(selectedMedia.name)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>File Size:</span>
                    <span className="text-stone-200">{formatBytes(selectedMedia.sizeBytes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="text-stone-200">
                      {new Date(selectedMedia.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Editable Metadata & Association */}
              <div className="space-y-4">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Asset Title</label>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    placeholder="e.g. Orange Bay Island White Sandbar"
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">
                    Alt Text (Accessibility & SEO)
                  </label>
                  <textarea
                    rows={2}
                    value={metaAltText}
                    onChange={(e) => setMetaAltText(e.target.value)}
                    placeholder="Describe image for screen readers and search engines..."
                    className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded text-white focus:outline-none focus:border-[#0A6C74]"
                  />
                </div>

                <div className="p-3 bg-stone-950 rounded border border-stone-800 space-y-3">
                  <label className="block text-stone-300 font-semibold text-xs flex items-center space-x-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#2dd4bf]" />
                    <span>Associate Media with Excursion</span>
                  </label>

                  <select
                    value={metaTourId}
                    onChange={(e) => setMetaTourId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-stone-900 border border-stone-800 rounded text-white text-xs focus:outline-none focus:border-[#0A6C74]"
                  >
                    <option value="">-- Select an excursion --</option>
                    {tours.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({(t as any).destination || 'Red Sea'})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleAttachToTour(false)}
                      disabled={attachingToTour || !metaTourId}
                      className="flex-1 py-1.5 px-2 bg-stone-900 hover:bg-stone-800 text-stone-200 rounded border border-stone-700 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Attach to Gallery
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAttachToTour(true)}
                      disabled={attachingToTour || !metaTourId}
                      className="flex-1 py-1.5 px-2 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded text-[11px] font-semibold shadow transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Set as Primary Cover
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedMedia)}
                    className="inline-flex items-center space-x-1 text-red-400 hover:text-red-300 text-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete File</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveMetadata}
                    disabled={savingMeta}
                    className="px-4 py-1.5 bg-[#0A6C74] hover:bg-[#08565C] text-white rounded font-semibold text-xs shadow transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {savingMeta ? 'Saving...' : 'Save Details'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center space-x-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Delete Media File</h3>
            </div>
            <p className="text-stone-300 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white break-all">"{itemToDelete.name}"</strong>?
              <br />
              This will remove the file from Supabase Storage bucket{' '}
              <code className="text-[#2dd4bf] font-mono">{MEDIA_BUCKET}</code> and delete its metadata record from <code className="text-[#2dd4bf] font-mono">media_assets</code>.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteItem}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
