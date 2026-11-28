import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { backupSupabaseStorage } from './backup_supabase_storage.mjs';

function createFakeClient({ entries, files, buckets = [{ id: 'tour-media', name: 'tour-media', public: true }] }) {
  const downloads = [];
  return {
    downloads,
    storage: {
      async listBuckets() {
        return { data: buckets, error: null };
      },
      from(bucketName) {
        return {
          async list(prefix, options) {
            const all = entries[bucketName + ':' + prefix] || [];
            return { data: all.slice(options.offset, options.offset + options.limit), error: null };
          },
          async download(objectPath) {
            downloads.push(bucketName + '/' + objectPath);
            const body = files[bucketName + '/' + objectPath];
            if (!body) return { data: null, error: { status: 404 } };
            return { data: new Blob([body]), error: null };
          },
        };
      },
    },
  };
}

test('exports nested Storage objects, bucket configuration and SHA-256 manifest', async (t) => {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'supabase-storage-backup-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));

  const entries = {
    'tour-media:': [
      { name: 'cover.jpg', id: 'object-1', metadata: { size: 4, mimetype: 'image/jpeg' }, created_at: '2026-11-28T00:00:00Z' },
      { name: 'nested', id: null, metadata: null },
    ],
    'tour-media:nested': [
      { name: 'voucher.bin', id: 'object-2', metadata: { size: 3, mimetype: 'application/octet-stream' } },
    ],
  };
  const files = {
    'tour-media/cover.jpg': Buffer.from('test'),
    'tour-media/nested/voucher.bin': Buffer.from('xyz'),
  };
  const client = createFakeClient({ entries, files });

  const manifest = await backupSupabaseStorage({ client, outputDir, pageSize: 1, concurrency: 2 });

  assert.equal(manifest.bucket_count, 1);
  assert.equal(manifest.object_count, 2);
  assert.equal(manifest.total_bytes, 7);
  assert.equal(manifest.buckets[0].name, 'tour-media');
  assert.equal(manifest.objects[0].path, 'cover.jpg');
  assert.equal(manifest.objects[0].sha256, createHash('sha256').update('test').digest('hex'));
  assert.equal(manifest.objects[1].path, 'nested/voucher.bin');
  assert.equal(manifest.objects[1].sha256, createHash('sha256').update('xyz').digest('hex'));

  assert.equal((await readFile(path.join(outputDir, 'storage', 'tour-media', 'cover.jpg'))).toString(), 'test');
  assert.equal((await readFile(path.join(outputDir, 'storage', 'tour-media', 'nested', 'voucher.bin'))).toString(), 'xyz');
  assert.equal(JSON.parse(await readFile(path.join(outputDir, 'storage-manifest.json'), 'utf8')).object_count, 2);
  assert.equal(JSON.parse(await readFile(path.join(outputDir, 'storage-buckets.json'), 'utf8'))[0].public, true);
  assert.deepEqual(client.downloads.sort(), ['tour-media/cover.jpg', 'tour-media/nested/voucher.bin']);
});

test('rejects unsafe object paths before downloading', async (t) => {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'supabase-storage-backup-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));

  const client = createFakeClient({
    entries: { 'tour-media:': [{ name: '../escape.txt', id: 'object-1', metadata: { size: 1 } }] },
    files: { 'tour-media/../escape.txt': Buffer.from('x') },
  });

  await assert.rejects(
    () => backupSupabaseStorage({ client, outputDir }),
    /Unsafe Storage object path/,
  );
  assert.equal(client.downloads.length, 0);
});

test('refuses to create an empty backup when bucket listing is empty', async (t) => {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'supabase-storage-backup-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  const client = createFakeClient({ entries: {}, files: {}, buckets: [] });
  await assert.rejects(() => backupSupabaseStorage({ client, outputDir }), /No Storage buckets/);
});


test('off-site backup workflow encrypts the archive and verifies the remote upload', () => {
  const workflow = readFileSync(new URL('../.github/workflows/backup-supabase.yml', import.meta.url), 'utf8');
  const encryptionIndex = workflow.indexOf('age -r "$BACKUP_AGE_RECIPIENT"');
  const uploadIndex = workflow.indexOf('aws s3 cp "$ENCRYPTED"');
  const verificationIndex = workflow.indexOf('aws s3api head-object');
  assert.ok(encryptionIndex >= 0, 'Backup must be encrypted with age');
  assert.ok(uploadIndex > encryptionIndex, 'Only the encrypted archive may be uploaded');
  assert.ok(verificationIndex > uploadIndex, 'Remote object size must be verified after upload');
  assert.match(workflow, /storage-policies\.sql/);
  assert.match(workflow, /BACKUP_STORAGE_DIR=/);
  assert.match(workflow, /DB_OBJECT_COUNT/);
  assert.match(workflow, /DB_OBJECT_BYTES/);
  assert.match(workflow, /REMOTE_SHA256/);
  assert.match(workflow, /DOWNLOADED_SHA256/);
  assert.match(workflow, /verify-awesome-adventure-/);
  assert.match(workflow, /--metadata "sha256=\$LOCAL_SHA256"/);
  assert.doesNotMatch(workflow, /actions\/upload-artifact/);
});
