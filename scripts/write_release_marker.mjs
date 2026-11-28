import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const MARKER_PATTERN = /^# Hostinger-Release-Marker:\s*.*$/m;

export function resolveReleaseCommit(env = process.env, runGit = execFileSync) {
  for (const name of ['GITHUB_SHA', 'HOSTINGER_GIT_COMMIT', 'HOSTINGER_COMMIT_SHA', 'SOURCE_COMMIT', 'COMMIT_SHA']) {
    const candidate = String(env[name] || '').trim();
    if (SHA_PATTERN.test(candidate)) return candidate.toLowerCase();
  }

  try {
    const candidate = String(runGit('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })).trim();
    if (SHA_PATTERN.test(candidate)) return candidate.toLowerCase();
  } catch {
    // A missing Git checkout must never silently reuse a previous release marker.
  }

  return 'unknown';
}

export async function writeReleaseMarker({
  robotsPath = path.resolve('dist/robots.txt'),
  env = process.env,
  runGit = execFileSync,
} = {}) {
  const commit = resolveReleaseCommit(env, runGit);
  const current = await readFile(robotsPath, 'utf8');
  if (!MARKER_PATTERN.test(current)) {
    throw new Error('The built robots.txt is missing its Hostinger release-marker placeholder.');
  }

  const next = current.replace(MARKER_PATTERN, '# Hostinger-Release-Marker: ' + commit);
  await writeFile(robotsPath, next, 'utf8');

  if (commit === 'unknown') {
    process.stderr.write('Warning: build commit SHA unavailable; production release checks will remain blocked until a verifiable commit marker is deployed.\n');
  } else {
    process.stdout.write('Injected Hostinger release marker for commit ' + commit + '.\n');
  }
  return commit;
}

const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (scriptPath && import.meta.url === pathToFileURL(scriptPath).href) {
  writeReleaseMarker().catch((error) => {
    process.stderr.write('Unable to write Hostinger release marker: ' + (error?.message || 'unknown error') + '\n');
    process.exitCode = 1;
  });
}
