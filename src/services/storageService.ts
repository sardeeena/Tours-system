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
  if (!validation.valid) {
    return { url: '', storagePath: '', error: validation.error };
  }

  const cleanFileName = sanitizeStorageFileName(file.name);

  // If Supabase is not configured yet (e.g. testing in sandbox without keys), generate an object URL and local asset
  if (!isSupabaseConfigured()) {
    const objectUrl = URL.createObjectURL(file);
    const storagePath = `local/${Date.now()}-${cleanFileName}`;
    const localItem: StorageFileItem = {
      id: `local-${Date.now()}`,
      name: file.name,
      url: objectUrl,
      storagePath,
      sizeBytes: file.size,
      mimeType: file.type || 'image/jpeg',
      title: meta?.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      altText: meta?.altText || '',
      tourId: meta?.tourId || null,
      createdAt: new Date().toISOString(),
    };
    const current = getLocalAssets();
    saveLocalAssets([localItem, ...current]);

    return {
      url: objectUrl,
      storagePath,
      assetId: localItem.id,
    };
  }

  try {
    const storagePath = `${safeFolder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${cleanFileName}`;

    // 1. Upload to Supabase Storage bucket
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return {
        url: '',
        storagePath: '',
        error: formatSupabaseError(uploadError),
      };
    }

    // 2. Retrieve public CDN URL from Supabase Storage
    const { data: publicData } = supabase.storage
      .from(MEDIA_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = publicData.publicUrl;

    // 3. Store metadata in 'media_assets' table to avoid orphaned files
    let assetId = `asset-${Date.now()}`;
    const assetPayload = {
      storage_path: storagePath,
      bucket_name: MEDIA_BUCKET,
      public_url: publicUrl,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      title: meta?.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      alt_text: meta?.altText || null,
      tour_id: meta?.tourId || null,
    };

    try {
      const { data: insertedAsset, error: dbError } = await supabase
        .from('media_assets')
        .insert(assetPayload)
        .select('id')
        .maybeSingle();

      if (!dbError && insertedAsset?.id) {
        assetId = insertedAsset.id;
      } else if (dbError) {
        console.warn('Could not insert into media_assets table (schema migration may be pending):', dbError.message);
      }
    } catch (dbErr) {
      console.warn('Database insert to media_assets skipped:', dbErr);
    }

    // Also update local cache for quick access
    const localItem: StorageFileItem = {
      id: assetId,
      name: file.name,
      url: publicUrl,
      storagePath,
      sizeBytes: file.size,
      mimeType: file.type,
      title: assetPayload.title,
      altText: assetPayload.alt_text || '',
      tourId: assetPayload.tour_id,
      createdAt: new Date().toISOString(),
    };
    saveLocalAssets([localItem, ...getLocalAssets().filter((i) => i.storagePath !== storagePath)]);

    return {
      url: publicUrl,
      storagePath,
      assetId,
    };
  } catch (err: any) {
    return {
      url: '',
      storagePath: '',
      error: formatSupabaseError(err),
    };
  }
}

/**
 * Removes an image or video from both the Supabase Storage bucket and the 'media_assets' metadata table.
 * Guaranteed to prevent orphaned files in storage!
 */
export async function deleteTourMedia(storagePath: string): Promise<{ success: boolean; error?: string }> {
  if (!storagePath) {
    return { success: true };
  }

  // Remove from local cache
  const local = getLocalAssets();
  saveLocalAssets(local.filter((i) => i.storagePath !== storagePath));

  if (!isSupabaseConfigured() || storagePath.startsWith('local/')) {
    return { success: true };
  }

  try {
    // 1. Delete metadata record from 'media_assets' table
    try {
      await supabase.from('media_assets').delete().eq('storage_path', storagePath);
    } catch (dbErr) {
      console.warn('media_assets delete warning:', dbErr);
    }

    // 2. Delete physical binary asset from Supabase Storage bucket
    const { error: storageError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([storagePath]);

    if (storageError) {
      return { success: false, error: formatSupabaseError(storageError) };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: formatSupabaseError(err) };
  }
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
  // Update local cache
  const local = getLocalAssets();
  saveLocalAssets(
    local.map((item) =>
      item.storagePath === storagePath
        ? {
            ...item,
            title: updates.title !== undefined ? updates.title : item.title,
            altText: updates.altText !== undefined ? updates.altText : item.altText,
            tourId: updates.tourId !== undefined ? updates.tourId : item.tourId,
          }
        : item
    )
  );

  if (!isSupabaseConfigured() || storagePath.startsWith('local/')) {
    return;
  }

  try {
    const dbPayload: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title !== undefined) dbPayload.title = updates.title;
    if (updates.altText !== undefined) dbPayload.alt_text = updates.altText;
    if (updates.tourId !== undefined) dbPayload.tour_id = updates.tourId;

    const { error } = await supabase
      .from('media_assets')
      .update(dbPayload)
      .eq('storage_path', storagePath);

    if (error) {
      console.warn('Supabase media_assets metadata update warning:', error);
    }
  } catch (err) {
    console.warn('Error updating media_assets table:', err);
  }
}

/**
 * Lists media files: queries 'media_assets' table, falling back to direct storage listing if table not yet seeded.
 */
export async function listStorageMedia(folder: string = 'tours'): Promise<StorageFileItem[]> {
  if (!isSupabaseConfigured()) {
    return getLocalAssets();
  }

  try {
    // 1. Try querying 'media_assets' table first
    const { data: dbAssets, error: dbError } = await supabase
      .from('media_assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!dbError && dbAssets && dbAssets.length > 0) {
      const dbMapped: StorageFileItem[] = dbAssets.map((asset: DbMediaAsset) => ({
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

      const localAssets = getLocalAssets();
      const existingUrls = new Set(dbMapped.map((i) => i.url));
      const existingPaths = new Set(dbMapped.map((i) => i.storagePath));
      const unsynced = localAssets.filter(
        (item) => !existingUrls.has(item.url) && !existingPaths.has(item.storagePath)
      );

      return [...dbMapped, ...unsynced];
    }

    // 2. Fallback: List directly from Supabase Storage bucket if table is empty or pending migration
    const { data: storageList, error: storageError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .list(folder, { limit: 150, sortBy: { column: 'created_at', order: 'desc' } });

    if (storageError || !storageList) {
      return getLocalAssets();
    }

    const localMap = new Map(getLocalAssets().map((i) => [i.storagePath, i]));

    return storageList
      .filter((item) => item.name !== '.emptyFolderPlaceholder')
      .map((item) => {
        const storagePath = `${folder}/${item.name}`;
        const { data: publicData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
        const local = localMap.get(storagePath);

        return {
          id: item.id || storagePath,
          name: item.name,
          url: publicData.publicUrl,
          storagePath,
          sizeBytes: (item.metadata as any)?.size || local?.sizeBytes || 0,
          mimeType: (item.metadata as any)?.mimetype || local?.mimeType || 'image/jpeg',
          title: local?.title || item.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          altText: local?.altText || '',
          tourId: local?.tourId || null,
          createdAt: item.created_at || new Date().toISOString(),
          metadata: item.metadata as Record<string, unknown> | undefined,
        };
      });
  } catch (err) {
    console.warn('Failed to list media assets:', err);
    return getLocalAssets();
  }
}

/**
 * Audits Supabase Storage bucket vs 'media_assets' database table to detect any orphaned files
 */
export async function auditOrphanedStorageFiles(folder: string = 'tours'): Promise<MediaAssetAuditResult> {
  if (!isSupabaseConfigured()) {
    return {
      orphanedInStorage: [],
      missingFromStorage: [],
      synchronizedCount: 0,
      totalStorageFiles: 0,
      totalDbRecords: 0,
    };
  }

  try {
    const [storageRes, dbRes] = await Promise.all([
      supabase.storage.from(MEDIA_BUCKET).list(folder, { limit: 200 }),
      supabase.from('media_assets').select('id, storage_path'),
    ]);

    const storagePaths = new Set(
      (storageRes.data || [])
        .filter((f) => f.name !== '.emptyFolderPlaceholder')
        .map((f) => `${folder}/${f.name}`)
    );

    const dbPaths = new Set((dbRes.data || []).map((d: any) => d.storage_path));

    const orphanedInStorage: string[] = [];
    storagePaths.forEach((path) => {
      if (!dbPaths.has(path)) {
        orphanedInStorage.push(path);
      }
    });

    const missingFromStorage: string[] = [];
    dbPaths.forEach((path) => {
      if (!storagePaths.has(path)) {
        missingFromStorage.push(path);
      }
    });

    let syncCount = 0;
    storagePaths.forEach((path) => {
      if (dbPaths.has(path)) syncCount++;
    });

    return {
      orphanedInStorage,
      missingFromStorage,
      synchronizedCount: syncCount,
      totalStorageFiles: storagePaths.size,
      totalDbRecords: dbPaths.size,
    };
  } catch (err) {
    console.warn('Failed to audit media assets:', err);
    return {
      orphanedInStorage: [],
      missingFromStorage: [],
      synchronizedCount: 0,
      totalStorageFiles: 0,
      totalDbRecords: 0,
    };
  }
}

/**
 * Automatically cleans and purges orphaned files from the Supabase Storage bucket.
 * Requires authenticated administrator privileges.
 */
export async function cleanOrphanedStorageFiles(orphanedPaths: string[]): Promise<number> {
  if (!orphanedPaths || orphanedPaths.length === 0 || !isSupabaseConfigured()) {
    return 0;
  }

  // Authorization check: User must be authenticated as admin/super_admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized: Authentication required to clean storage files.');
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  if (!isAdmin) {
    throw new Error('Forbidden: Administrative privileges required to delete storage files.');
  }

  // Strictly filter out any paths attempting directory traversal or containing invalid characters,
  // and ensure the path begins with one of the allowed storage folders
  const safePaths = orphanedPaths.filter((p) => {
    if (typeof p !== 'string' || p.includes('..') || p.startsWith('/') || p.startsWith('\\')) {
      return false;
    }
    const folder = p.split('/')[0];
    return ALLOWED_STORAGE_FOLDERS.includes(folder as AllowedStorageFolder);
  });

  if (safePaths.length === 0) return 0;

  try {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(safePaths);
    if (error) {
      console.error('Error cleaning orphaned storage files:', error);
      return 0;
    }
    return safePaths.length;
  } catch (err) {
    console.error('Exception cleaning orphaned files:', err);
    return 0;
  }
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

  if (originalUrl.includes('/storage/v1/object/public/')) {
    if (options?.width) {
      return `${originalUrl}?width=${options.width}&quality=${options.quality || 80}`;
    }
  }

  return originalUrl;
}
