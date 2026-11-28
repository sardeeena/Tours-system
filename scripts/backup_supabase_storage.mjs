import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

const PAGE_SIZE = 1000;
const MAX_FOLDER_DEPTH = 32;
const MAX_RETRIES = 5;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeSegment(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value === '.' || value === '..' || value.includes('/') || value.includes('\\') || value.includes('\0')) {
    throw new Error('Unsafe Storage ' + label + ' encountered; refusing to write outside the backup directory.');
  }
  return value;
}

function resolveObjectDestination(storageRoot, bucketName, objectPath) {
  safeSegment(bucketName, 'bucket name');
  if (typeof objectPath !== 'string' || objectPath.length === 0 || objectPath.startsWith('/') || objectPath.includes('\\') || objectPath.includes('\0')) {
    throw new Error('Unsafe Storage object path encountered; refusing to write outside the backup directory.');
  }
  const segments = objectPath.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new Error('Unsafe Storage object path encountered; refusing to write outside the backup directory.');
  }
  const bucketRoot = path.resolve(storageRoot, bucketName);
  const destination = path.resolve(bucketRoot, ...segments);
  if (!destination.startsWith(bucketRoot + path.sep)) {
    throw new Error('Unsafe Storage object path encountered; refusing to write outside the backup directory.');
  }
  return destination;
}

async function callWithRetry(label, operation) {
  let lastStatus;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const result = await operation();
      if (!result?.error) {
        if (result?.data === undefined) throw new Error(label + ' returned no data.');
        return result.data;
      }
      lastStatus = Number(result.error.status || result.error.statusCode || 0);
      const retryable = lastStatus === 429 || lastStatus >= 500 || lastStatus === 0;
      if (!retryable || attempt === MAX_RETRIES - 1) {
        throw new Error(label + ' failed' + (lastStatus ? ' (HTTP ' + lastStatus + ')' : '') + '.');
      }
    } catch (error) {
      if (error?.message?.startsWith(label + ' failed') || error?.message === label + ' returned no data.') throw error;
      if (attempt === MAX_RETRIES - 1) {
        throw new Error(label + ' failed after retries; inspect the Storage service and credentials.');
      }
    }
    await delay(Math.min(1000 * (2 ** attempt), 15000));
  }
  throw new Error(label + ' failed' + (lastStatus ? ' (HTTP ' + lastStatus + ')' : '') + '.');
}

async function collectBucketObjects(storage, bucketName, prefix, objects, visited, depth, pageSize) {
  if (depth > MAX_FOLDER_DEPTH) {
    throw new Error('Storage folder nesting exceeds the safe backup limit.');
  }
  const visitKey = bucketName + '\0' + prefix;
  if (visited.has(visitKey)) {
    throw new Error('Storage listing returned a repeated folder; refusing an incomplete backup.');
  }
  visited.add(visitKey);

  let offset = 0;
  while (true) {
    const entries = await callWithRetry('Storage object listing', () =>
      storage.from(bucketName).list(prefix, {
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    );
    if (!Array.isArray(entries)) {
      throw new Error('Storage object listing returned an unexpected response.');
    }

    for (const entry of entries) {
      if (!entry || typeof entry.name !== 'string') {
        throw new Error('Storage object listing returned an invalid entry.');
      }
      const objectPath = prefix ? prefix + '/' + entry.name : entry.name;
      resolveObjectDestination(path.resolve('storage-backup-root'), bucketName, objectPath);
      if (entry.id == null && entry.metadata == null) {
        await collectBucketObjects(storage, bucketName, objectPath, objects, visited, depth + 1, pageSize);
      } else {
        objects.push({ bucket: bucketName, path: objectPath, metadata: entry });
      }
    }

    if (entries.length < pageSize) break;
    offset += entries.length;
  }
}

async function downloadObject(storage, storageRoot, object) {
  const destination = resolveObjectDestination(storageRoot, object.bucket, object.path);
  await mkdir(path.dirname(destination), { recursive: true });

  const blob = await callWithRetry('Storage object download', () =>
    storage.from(object.bucket).download(object.path),
  );
  if (!blob || typeof blob.stream !== 'function') {
    throw new Error('Storage object download returned an invalid file body.');
  }

  const hash = createHash('sha256');
  let bytes = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  await pipeline(
    Readable.fromWeb(blob.stream()),
    meter,
    createWriteStream(destination, { flags: 'wx', mode: 0o600 }),
  );

  const sizeValue = object.metadata?.metadata?.size;
  const expectedSize = sizeValue === undefined || sizeValue === null ? null : Number(sizeValue);
  if (expectedSize !== null && Number.isFinite(expectedSize) && expectedSize >= 0 && expectedSize !== bytes) {
    throw new Error('Storage object size verification failed; refusing to publish an incomplete backup.');
  }

  return {
    bucket: object.bucket,
    path: object.path,
    size: bytes,
    sha256: hash.digest('hex'),
    created_at: object.metadata?.created_at ?? null,
    updated_at: object.metadata?.updated_at ?? null,
    last_accessed_at: object.metadata?.last_accessed_at ?? null,
    id: object.metadata?.id ?? null,
    owner: object.metadata?.owner ?? null,
    owner_id: object.metadata?.owner_id ?? null,
    metadata: object.metadata?.metadata ?? null,
    user_metadata: object.metadata?.user_metadata ?? null,
  };
}

async function mapWithConcurrency(items, concurrency, operation) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), Math.max(1, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        results[index] = await operation(items[index]);
      }
    }),
  );
  return results;
}

export async function backupSupabaseStorage({
  client,
  outputDir,
  pageSize = PAGE_SIZE,
  concurrency = 3,
}) {
  if (!client?.storage || typeof client.storage.listBuckets !== 'function') {
    throw new Error('A Supabase client with Storage access is required.');
  }
  if (typeof outputDir !== 'string' || outputDir.length === 0) {
    throw new Error('A Storage backup output directory is required.');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > PAGE_SIZE) {
    throw new Error('Storage page size must be between 1 and 1000.');
  }

  const buckets = await callWithRetry('Storage bucket listing', () => client.storage.listBuckets());
  if (!Array.isArray(buckets) || buckets.length === 0) {
    throw new Error('No Storage buckets were returned; refusing to create an empty backup.');
  }

  const storageRoot = path.resolve(outputDir, 'storage');
  await mkdir(storageRoot, { recursive: true });
  const bucketConfigs = buckets.map((bucket) => ({
    id: bucket.id ?? bucket.name,
    name: safeSegment(bucket.name, 'bucket name'),
    public: Boolean(bucket.public),
    file_size_limit: bucket.file_size_limit ?? null,
    allowed_mime_types: bucket.allowed_mime_types ?? null,
    created_at: bucket.created_at ?? null,
    updated_at: bucket.updated_at ?? null,
  }));

  const objects = [];
  for (const bucket of bucketConfigs) {
    await collectBucketObjects(client.storage, bucket.name, '', objects, new Set(), 0, pageSize);
  }

  const downloaded = await mapWithConcurrency(objects, concurrency, (object) =>
    downloadObject(client.storage, storageRoot, object),
  );
  downloaded.sort((a, b) => (a.bucket + '/' + a.path).localeCompare(b.bucket + '/' + b.path));

  const totalBytes = downloaded.reduce((sum, object) => sum + object.size, 0);
  const manifest = {
    format_version: 1,
    created_at: new Date().toISOString(),
    bucket_count: bucketConfigs.length,
    object_count: downloaded.length,
    total_bytes: totalBytes,
    buckets: bucketConfigs,
    objects: downloaded,
  };

  await writeFile(path.join(outputDir, 'storage-buckets.json'), JSON.stringify(bucketConfigs, null, 2) + '\n', { mode: 0o600 });
  await writeFile(path.join(outputDir, 'storage-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });

  return manifest;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
  const outputDir = process.env.BACKUP_STORAGE_DIR;

  if (!supabaseUrl || !serviceRoleKey || !outputDir) {
    throw new Error('SUPABASE_URL, SUPABASE_SECRET_KEY and BACKUP_STORAGE_DIR are required.');
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const manifest = await backupSupabaseStorage({ client, outputDir });
  const mib = (manifest.total_bytes / (1024 * 1024)).toFixed(2);
  process.stdout.write(
    'Storage export complete: ' + manifest.bucket_count + ' buckets, ' +
    manifest.object_count + ' objects, ' + mib + ' MiB. Object names are intentionally not logged.\n',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write('Storage backup failed: ' + (error?.message || 'unknown error') + '\n');
    process.exitCode = 1;
  });
}
