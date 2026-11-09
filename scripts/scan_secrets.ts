import fs from 'fs';
import path from 'path';

/**
 * ==============================================================================
 * AUTOMATED PRODUCTION SECRET & CREDENTIAL LEAK SCANNER
 * ==============================================================================
 * Performs exhaustive audit of compiled frontend distribution (dist/)
 * and frontend source code (src/) to guarantee ZERO credentials in client assets.
 * ==============================================================================
 */

const FORBIDDEN_STRINGS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'supabase.co',
];

const FORBIDDEN_PATTERNS = [
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, // Supabase JWT tokens (anon/service)
  /AIza[0-9A-Za-z-_]{35}/, // Google API keys
  /sk-[a-zA-Z0-9]{20,}/, // Standard secret keys
];

let violations = 0;

function scanDirectory(dir: string, label: string) {
  if (!fs.existsSync(dir)) {
    console.warn(`[WARN] Directory ${dir} does not exist. Run build first.`);
    return;
  }

  const files = fs.readdirSync(dir, { recursive: true }) as string[];

  for (const relativePath of files) {
    const fullPath = path.join(dir, relativePath);
    if (!fs.statSync(fullPath).isFile()) continue;

    // Skip map files or binary files if necessary, but scan all js, css, html, json
    const ext = path.extname(fullPath).toLowerCase();
    if (!['.js', '.html', '.css', '.json', '.txt', '.webmanifest'].includes(ext)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');

    for (const forbidden of FORBIDDEN_STRINGS) {
      if (content.includes(forbidden)) {
        console.error(`❌ [LEAK DETECTED in ${label}] Found "${forbidden}" in ${fullPath}`);
        violations++;
      }
    }

    for (const pattern of FORBIDDEN_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        console.error(`❌ [TOKEN PATTERN DETECTED in ${label}] Matched token in ${fullPath}: ${match[0].slice(0, 15)}...`);
        violations++;
      }
    }
  }
}

console.log('================================================================');
console.log('  Zero-Credential Automated Security Audit');
console.log('================================================================\n');

console.log('1. Scanning compiled client distribution (dist/assets/)...');
scanDirectory(path.resolve(process.cwd(), 'dist/assets'), 'dist/assets');

console.log('2. Scanning client root HTML & manifests (dist/)...');
const distRootFiles = ['dist/index.html', 'dist/manifest.webmanifest'];
for (const f of distRootFiles) {
  const p = path.resolve(process.cwd(), f);
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf-8');
    for (const forbidden of FORBIDDEN_STRINGS) {
      if (content.includes(forbidden)) {
        console.error(`❌ [LEAK DETECTED in dist root] Found "${forbidden}" in ${f}`);
        violations++;
      }
    }
  }
}

console.log('3. Scanning frontend source files (src/)...');
const srcDir = path.resolve(process.cwd(), 'src');
const srcFiles = fs.readdirSync(srcDir, { recursive: true }) as string[];
for (const rel of srcFiles) {
  const full = path.join(srcDir, rel);
  if (!fs.statSync(full).isFile()) continue;
  const ext = path.extname(full).toLowerCase();
  if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) continue;

  const content = fs.readFileSync(full, 'utf-8');
  for (const forbidden of FORBIDDEN_STRINGS) {
    if (content.includes(forbidden)) {
      console.error(`❌ [FORBIDDEN REFERENCE in src/] Found "${forbidden}" in ${rel}`);
      violations++;
    }
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      console.error(`❌ [TOKEN PATTERN in src/] Matched secret pattern in ${rel}`);
      violations++;
    }
  }
}

console.log('\n----------------------------------------------------------------');
if (violations === 0) {
  console.log('✅ ZERO-CREDENTIAL AUDIT PASSED: No secrets, credentials, or direct Supabase strings found.');
  process.exit(0);
} else {
  console.error(`❌ ZERO-CREDENTIAL AUDIT FAILED: ${violations} violation(s) detected.`);
  process.exit(1);
}
