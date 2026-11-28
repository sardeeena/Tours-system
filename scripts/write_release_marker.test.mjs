import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { resolveReleaseCommit, writeReleaseMarker } from './write_release_marker.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';

test('uses the GitHub commit SHA when available', () => {
  assert.equal(resolveReleaseCommit({ GITHUB_SHA: SHA }), SHA);
});

test('falls back to the checked-out Git commit when CI environment variables are absent', () => {
  const runGit = (_command, args) => {
    assert.deepEqual(args, ['rev-parse', 'HEAD']);
    return SHA + '\n';
  };
  assert.equal(resolveReleaseCommit({}, runGit), SHA);
});

test('returns unknown instead of reusing a stale marker when no commit can be resolved', () => {
  assert.equal(resolveReleaseCommit({}, () => { throw new Error('no git checkout'); }), 'unknown');
});

test('writes the exact build commit into dist robots.txt and preserves other crawler rules', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'release-marker-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const robotsPath = path.join(dir, 'robots.txt');
  await writeFile(robotsPath, '# Hostinger-Release-Marker: BUILD_COMMIT\nUser-agent: *\nAllow: /\n', 'utf8');

  const commit = await writeReleaseMarker({ robotsPath, env: { GITHUB_SHA: SHA } });
  const result = await readFile(robotsPath, 'utf8');

  assert.equal(commit, SHA);
  assert.match(result, new RegExp('^# Hostinger-Release-Marker: ' + SHA + '$', 'm'));
  assert.match(result, /User-agent: \*/);
  assert.match(result, /Allow: \//);
});

test('fails closed if the built robots.txt has no release-marker placeholder', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'release-marker-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const robotsPath = path.join(dir, 'robots.txt');
  await writeFile(robotsPath, 'User-agent: *\nAllow: /\n', 'utf8');
  await assert.rejects(
    () => writeReleaseMarker({ robotsPath, env: { GITHUB_SHA: SHA } }),
    /missing its Hostinger release-marker placeholder/,
  );
});
