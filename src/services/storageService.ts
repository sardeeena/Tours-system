import { supabase, isSupabaseConfigured, formatSupabaseError } from './supabaseClient';
import { DbMediaAsset } from '../types/database';

export const MEDIA_BUCKET = 'tour-media';
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const LOCAL_MEDIA_ASSETS_KEY = 'rse_media_assets_cache';

export interface UploadResult {
  url: string;
  storagePath: string;
  assetId?: string;
  error?: string;
}

export interface StorageFileItem {
  id: string;
  name: string;
  url: string;
  storagePath: string;
  sizeBytes: number;
  createdAt: string;
  mimeType?: string;
  title?: string;
  altText?: string;
  tourId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MediaAssetAuditResult {
  orphanedInStorage: string[];
  missingFromStorage: string[];
  synchronizedCount: number;
  totalStorageFiles: number;
  totalDbRecords: number;
}

/**
 * Validates file size and MIME type before sending to Supabase Storage
 */
export function validateMediaFile(file: File, type: 'image' | 'video'): { valid: boolean; error?: string } {
  if (type === 'image') {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `Unsupported image format (${file.type}). Please upload JPG, PNG, WebP, or AVIF.`,
      };
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size exceeds the 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please compress before uploading.`,
      };
    }
  } else if (type === 'video') {
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `Unsupported video format (${file.type}). Please upload MP4 or WebM.`,
      };
    }
    if (file.size > 50 * 1024 * 1024) {
      return {
        valid: false,
        error: `Video size exceeds the 50MB limit. For large videos, please link via YouTube or Vimeo URL.`,
      };
    }
  }

  return { valid: true };
}


/**
 * Creates a smaller WebP copy before upload when the browser supports it.
 * The original File is retained as a safe fallback if decoding or encoding fails,
 * and the original is used whenever conversion would not meaningfully reduce size.
 */
async function optimizeImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap === 'undefined') return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxDimension = 1920;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.82);
    });
    if (!blob || blob.size >= file.size * 0.95) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: file.lastModified,
    });
  } catch {
    // Keep uploads reliable on browsers that cannot decode/encode a given format.
    return file;
  } finally {
    bitmap?.close();
  }
}

function getLocalAssets(): StorageFileItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_MEDIA_ASSETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAssets(items: StorageFileItem[]) {
  try {
    localStorage.setItem(LOCAL_MEDIA_ASSETS_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export const ALLOWED_STORAGE_FOLDERS = ['tours', 'destinations', 'vessels', 'guides', 'reviews', 'blog', 'extras'] as const;
export type AllowedStorageFolder = typeof ALLOWED_STORAGE_FOLDERS[number];

/**
 * Sanitizes folder names to strictly prevent directory traversal (e.g. '../', '/')
 * and enforces allowlist of authorized storage directories.
 */
export function sanitizeStorageFolder(folder: string): AllowedStorageFolder {
  const sanitized = folder
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .trim()
    .toLowerCase();
  
  if (ALLOWED_STORAGE_FOLDERS.includes(sanitized as AllowedStorageFolder)) {
    return sanitized as AllowedStorageFolder;
  }
  return 'tours';
}

/**
 * Sanitizes file names to remove paths, directory traversal, and dangerous characters
 */
export function sanitizeStorageFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'media';
  return base.replace(/[^a-zA-Z0-9.-]/g, '_').slice(-80);
}

/**
 * Uploads a tour media file to the 'tour-media' public bucket and records metadata in 'media_assets' table
 */
export async function uploadTourMedia(
  file: File,
  folder: string = 'tours',
  meta?: { title?: string; altText?: string; tourId?: string }
): Promise<UploadResult> {
  const safeFolder = sanitizeStorageFolder(folder);
  const isVideo = file.type.startsWith('video/');
  const validation = validateMediaFile(file, isVideo ? 'video' : 'image');
  if (!validation.valid) return { url: '', storagePath: '', error: validation.error };

  const uploadFile = isVideo ? file : await optimizeImageForUpload(file);
  const cleanFileName = sanitizeStorageFileName(uploadFile.name);
  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) {
      return { url: '', storagePath: '', error: 'Supabase Storage is not configured in production.' };
    }
    const objectUrl = URL.createObjectURL(file);
    const storagePath = `local/${Date.now()}-${cleanFileName}`;
    const localItem: StorageFileItem = {
      id: `local-${Date.now()}`,
      name: uploadFile.name,
      url: objectUrl,
      storagePath,
      sizeBytes: uploadFile.size,
      mimeType: uploadFile.type || 'image/jpeg',
      title: meta?.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      altText: meta?.altText || '',
      tourId: meta?.tourId || null,
      createdAt: new Date().toISOString(),
    };
    saveLocalAssets([localItem, ...getLocalAssets()]);
    return { url: objectUrl, storagePath, assetId: localItem.id };
  }

  const storagePath = `${safeFolder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${cleanFileName}`;
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, uploadFile, {
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) return { url: '', storagePath: '', error: formatSupabaseError(uploadError) };

  const { data: publicData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicData.publicUrl;
  const assetPayload = {
    storage_path: storagePath,
    bucket_name: MEDIA_BUCKET,
    public_url: publicUrl,
    file_name: uploadFile.name,
    file_size_bytes: uploadFile.size,
    mime_type: uploadFile.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
    title: meta?.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
    alt_text: meta?.altText || null,
    tour_id: meta?.tourId || null,
  };

  let insertedAsset: { id: string; created_at?: string } | null = null;
  let metadataError: unknown = null;
  try {
    const result = await supabase
      .from('media_assets')
      .insert(assetPayload)
      .select('id,created_at')
      .single();
    insertedAsset = result.data;
    metadataError = result.error;
  } catch (error) {
    metadataError = error;
  }

  if (metadataError || !insertedAsset?.id) {
    let rollbackError: unknown = null;
    try {
      const rollback = await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
      rollbackError = rollback.error;
    } catch (error) {
      rollbackError = error;
    }
    const reason = metadataError ? formatSupabaseError(metadataError) : 'No media metadata record was returned.';
    const rollback = rollbackError ? ` Storage rollback also failed: ${formatSupabaseError(rollbackError)}` : ' The uploaded object was rolled back.';
    return { url: '', storagePath: '', error: `Media metadata could not be saved: ${reason}.${rollback}` };
  }

  const localItem: StorageFileItem = {
    id: insertedAsset.id,
    name: uploadFile.name,
    url: publicUrl,
    storagePath,
    sizeBytes: uploadFile.size,
    mimeType: uploadFile.type,
    title: assetPayload.title,
    altText: assetPayload.alt_text || '',
    tourId: assetPayload.tour_id,
    createdAt: insertedAsset.created_at || new Date().toISOString(),
  };
  saveLocalAssets([localItem, ...getLocalAssets().filter((item) => item.storagePath !== storagePath)]);
  return { url: publicUrl, storagePath, assetId: insertedAsset.id };
}

/**
 * Removes an image or video from both the Supabase Storage bucket and the 'media_assets' metadata table.
 * Guaranteed to prevent orphaned files in storage!
 */
export async function deleteTourMedia(storagePath: string): Promise<{ success: boolean; error?: string }> {
  if (!storagePath) return { success: true };

  if (storagePath.startsWith('local/')) {
    if (!import.meta.env.DEV) return { success: false, error: 'Local-only media cannot be deleted from the production media library.' };
    saveLocalAssets(getLocalAssets().filter((item) => item.storagePath !== storagePath));
    return { success: true };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase Storage is not configured; the production media file was not changed.' };
  }

  // Remove the metadata row first. If object deletion fails, the orphan audit can safely find the storage object.
  const { error: metadataError } = await supabase.from('media_assets').delete().eq('storage_path', storagePath);
  if (metadataError) return { success: false, error: formatSupabaseError(metadataError) };

  const { error: storageError } = await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
  if (storageError) {
    return { success: false, error: `Media metadata was removed, but the storage object could not be deleted: ${formatSupabaseError(storageError)}` };
  }

  saveLocalAssets(getLocalAssets().filter((item) => item.storagePath !== storagePath));
  return { success: true };
}

/**
 * Safely replaces an existing media file in Supabase Storage, updates 'media_assets' metadata,
 * and deletes the old storage asset to avoid orphaned files in the bucket.
 */
export async function replaceTourMedia(
  oldStoragePath: string,
  newFile: File,
  folder: string = 'tours',
  meta?: { title?: string; altText?: string; tourId?: string }
): Promise<UploadResult> {
  // 1. Upload new asset
  const uploadRes = await uploadTourMedia(newFile, folder, meta);
  if (uploadRes.error) {
    return uploadRes;
  }

  // 2. Safely purge old asset from Storage bucket and media_assets if paths differ
  if (oldStoragePath && oldStoragePath !== uploadRes.storagePath) {
    await deleteTourMedia(oldStoragePath);
  }

  return uploadRes;
}

/**
 * Updates title, alt text, or tour association for a media asset in the 'media_assets' table
 */
export async function updateMediaAssetMetadata(
  storagePath: string,
  updates: { title?: string; altText?: string; tourId?: string | null }
): Promise<void> {
  if (storagePath.startsWith('local/')) {
    if (!import.meta.env.DEV) throw new Error('Local-only media metadata cannot be changed in production.');
    const local = getLocalAssets();
    saveLocalAssets(local.map((item) => item.storagePath === storagePath
      ? {
          ...item,
          title: updates.title !== undefined ? updates.title : item.title,
          altText: updates.altText !== undefined ? updates.altText : item.altText,
          tourId: updates.tourId !== undefined ? updates.tourId : item.tourId,
        }
      : item));
    return;
  }

  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured; media metadata cannot be updated in production.');

  const dbPayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) dbPayload.title = updates.title;
  if (updates.altText !== undefined) dbPayload.alt_text = updates.altText;
  if (updates.tourId !== undefined) dbPayload.tour_id = updates.tourId;

  const { data, error } = await supabase
    .from('media_assets')
    .update(dbPayload)
    .eq('storage_path', storagePath)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(formatSupabaseError(error));
  if (!data) throw new Error('The media metadata was not updated because the asset record was not found or is not accessible.');

  const local = getLocalAssets();
  saveLocalAssets(local.map((item) => item.storagePath === storagePath
    ? {
        ...item,
        title: updates.title !== undefined ? updates.title : item.title,
        altText: updates.altText !== undefined ? updates.altText : item.altText,
        tourId: updates.tourId !== undefined ? updates.tourId : item.tourId,
      }
    : item));
}

/**
 * Lists media files: queries 'media_assets' table, falling back to direct storage listing if table not yet seeded.
 */
export async function listStorageMedia(folder: string = 'tours'): Promise<StorageFileItem[]> {
  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) throw new Error('Supabase Storage is not configured; production media cannot be loaded.');
    return getLocalAssets();
  }

  const { data: dbAssets, error: dbError } = await supabase
    .from('media_assets')
    .select('*')
    .order('created_at', { ascending: false });
  if (dbError) throw new Error(formatSupabaseError(dbError));

  if (dbAssets && dbAssets.length > 0) {
    return dbAssets.map((asset: DbMediaAsset) => ({
      id: asset.id,
      name: asset.file_name,
      url: asset.public_url,
      storagePath: asset.storage_path,
      sizeBytes: Number(asset.file_size_bytes) || 0,
      mimeType: asset.mime_type,
      title: asset.title || asset.file_name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      altText: asset.alt_text || '',
      tourId: asset.tour_id,
      createdAt: asset.created_at,
    }));
  }

  // The storage bucket remains authoritative for files uploaded before metadata indexing was enabled.
  const { data: storageList, error: storageError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list(folder, { limit: 150, sortBy: { column: 'created_at', order: 'desc' } });
  if (storageError) throw new Error(formatSupabaseError(storageError));
  if (!storageList) throw new Error('Storage returned no media listing.');

  return storageList
    .filter((item) => item.name !== '.emptyFolderPlaceholder')
    .map((item) => {
      const storagePath = `${folder}/${item.name}`;
      const { data: publicData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
      return {
        id: item.id || storagePath,
        name: item.name,
        url: publicData.publicUrl,
        storagePath,
        sizeBytes: Number((item.metadata as any)?.size) || 0,
        mimeType: (item.metadata as any)?.mimetype || 'image/jpeg',
        title: item.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        altText: '',
        tourId: null,
        createdAt: item.created_at || new Date().toISOString(),
        metadata: item.metadata as Record<string, unknown> | undefined,
      };
    });
}

/**
 * Audits Supabase Storage bucket vs 'media_assets' database table to detect any orphaned files
 */
export async function auditOrphanedStorageFiles(folder: string = 'tours'): Promise<MediaAssetAuditResult> {
  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) throw new Error('Supabase Storage is not configured; media audit cannot run in production.');
    return { orphanedInStorage: [], missingFromStorage: [], synchronizedCount: 0, totalStorageFiles: 0, totalDbRecords: 0 };
  }

  const [storageRes, dbRes] = await Promise.all([
    supabase.storage.from(MEDIA_BUCKET).list(folder, { limit: 200 }),
    supabase.from('media_assets').select('id, storage_path'),
  ]);
  if (storageRes.error) throw new Error(formatSupabaseError(storageRes.error));
  if (dbRes.error) throw new Error(formatSupabaseError(dbRes.error));

  const storagePaths = new Set((storageRes.data || [])
    .filter((file) => file.name !== '.emptyFolderPlaceholder')
    .map((file) => `${folder}/${file.name}`));
  const dbPaths = new Set((dbRes.data || []).map((row: any) => row.storage_path));
  const orphanedInStorage = [...storagePaths].filter((path) => !dbPaths.has(path));
  const missingFromStorage = [...dbPaths].filter((path) => !storagePaths.has(path));

  return {
    orphanedInStorage,
    missingFromStorage,
    synchronizedCount: [...storagePaths].filter((path) => dbPaths.has(path)).length,
    totalStorageFiles: storagePaths.size,
    totalDbRecords: dbPaths.size,
  };
}

/**
 * Automatically cleans and purges orphaned files from the Supabase Storage bucket.
 * Requires authenticated administrator privileges.
 */
export async function cleanOrphanedStorageFiles(orphanedPaths: string[]): Promise<number> {
  if (!orphanedPaths || orphanedPaths.length === 0) return 0;
  if (!isSupabaseConfigured()) {
    if (!import.meta.env.DEV) throw new Error('Supabase Storage is not configured; orphan cleanup cannot run in production.');
    return 0;
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(formatSupabaseError(authError));
  if (!user) throw new Error('Unauthorized: Authentication required to clean storage files.');

  const { data: assignedRoles, error: roleError } = await supabase
    .from('user_roles')
    .select('access_roles(slug)')
    .eq('user_id', user.id);
  if (roleError) throw new Error(formatSupabaseError(roleError));
  const roleNames = (assignedRoles || []).flatMap((row: any) => {
    const roles = Array.isArray(row.access_roles) ? row.access_roles : [row.access_roles];
    return roles.filter(Boolean).map((role: any) => role.slug);
  });
  if (!roleNames.some((role) => role === 'admin' || role === 'super_admin')) {
    throw new Error('Forbidden: Administrative privileges required to delete storage files.');
  }

  const safePaths = orphanedPaths.filter((path) => {
    if (typeof path !== 'string' || path.includes('..') || path.startsWith('/') || path.startsWith('\\\\')) return false;
    const folder = path.split('/')[0];
    return ALLOWED_STORAGE_FOLDERS.includes(folder as AllowedStorageFolder);
  });
  if (safePaths.length === 0) return 0;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(safePaths);
  if (error) throw new Error(formatSupabaseError(error));
  return safePaths.length;
}

/**
 * Generates an optimized image URL using Supabase Storage image transformation when available
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  options?: { width?: number; height?: number; quality?: number }
): string {
  if (!originalUrl) return '';

  if (originalUrl.includes('images.unsplash.com')) {
    const url = new URL(originalUrl);
    if (options?.width) url.searchParams.set('w', options.width.toString());
    if (options?.height) url.searchParams.set('h', options.height.toString());
    if (options?.quality) url.searchParams.set('q', options.quality.toString());
    return url.toString();
  }

  // Supabase public object URLs do not apply width/quality query parameters.
  // Return the stable original URL instead of creating ineffective cache variants.
  return originalUrl;
}
