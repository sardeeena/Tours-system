import fs from 'fs';
import path from 'path';

/**
 * ==============================================================================
 * VERCEL SPA ROUTING & REWRITE VERIFICATION SUITE
 * ==============================================================================
 * Validates:
 * 1. vercel.json exists, is valid JSON, and contains proper rewrites structure.
 * 2. Static asset requests (/assets/*) are preserved and never rewritten to index.html.
 * 3. API requests (/api/*) are preserved and never rewritten to index.html.
 * 4. Application routes (/, /admin, /login, /excursions, etc.) are correctly routed.
 * 5. dist/ folder contains all required production bundle assets.
 * ==============================================================================
 */

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, message: string) {
  results.push({
    name,
    passed: condition,
    message: condition ? `PASSED: ${message}` : `FAILED: ${message}`,
  });
}

async function runRouteTests() {
  console.log('================================================================');
  console.log('  Vercel SPA Routing & Configuration Verification');
  console.log('================================================================\n');

  // 1. Verify vercel.json exists and is valid JSON
  console.log('Step 1: Inspecting vercel.json...');
  const vercelJsonPath = path.resolve('vercel.json');
  const exists = fs.existsSync(vercelJsonPath);
  assert('vercel.json exists', exists, 'Configuration file is present at project root');

  if (!exists) {
    console.error('Fatal: vercel.json not found');
    process.exit(1);
  }

  let config: any = {};
  try {
    const raw = fs.readFileSync(vercelJsonPath, 'utf8');
    config = JSON.parse(raw);
    assert('vercel.json is valid JSON', true, 'Parsed configuration without syntax errors');
  } catch (err: any) {
    assert('vercel.json is valid JSON', false, `JSON parse error: ${err.message}`);
    process.exit(1);
  }

  // 2. Validate rewrites array
  console.log('Step 2: Validating rewrite rules...');
  assert(
    'rewrites array present',
    Array.isArray(config.rewrites) && config.rewrites.length >= 2,
    `Found ${config.rewrites?.length || 0} rewrite rules`
  );

  const rules: Array<{ source: string; destination: string }> = config.rewrites || [];

  // Check rule ordering
  const apiRuleIndex = rules.findIndex((r) => r.source.includes('/api/'));
  const assetRuleIndex = rules.findIndex((r) => r.source.includes('/assets/'));
  const catchAllRuleIndex = rules.findIndex((r) => r.source === '/(.*)' && r.destination === '/index.html');

  assert(
    'API rewrite rule precedes catch-all',
    apiRuleIndex !== -1 && (catchAllRuleIndex === -1 || apiRuleIndex < catchAllRuleIndex),
    'API requests (/api/*) are matched before the SPA catch-all rule'
  );

  assert(
    'Asset rewrite rule precedes catch-all',
    assetRuleIndex !== -1 && (catchAllRuleIndex === -1 || assetRuleIndex < catchAllRuleIndex),
    'Asset requests (/assets/*) are matched before the SPA catch-all rule'
  );

  assert(
    'Catch-all rule targets /index.html',
    catchAllRuleIndex !== -1,
    'General routes rewrite to /index.html for client-side routing'
  );

  // 3. Simulate Vercel routing logic
  console.log('Step 3: Simulating route resolution...');

  // Mock filesystem files in dist/
  const distPath = path.resolve('dist');
  const distExists = fs.existsSync(distPath);
  assert('dist directory exists', distExists, 'Production build directory dist/ exists');

  function simulateVercelRouting(requestPath: string): { destination: string; type: 'static' | 'rewrite' | 'passthrough' } {
    // 1. Vercel checks filesystem first
    const relativeClean = requestPath.replace(/^\//, '');
    const candidateFile = path.join(distPath, relativeClean);
    if (fs.existsSync(candidateFile) && fs.statSync(candidateFile).isFile()) {
      return { destination: requestPath, type: 'static' };
    }

    // 2. Vercel evaluates rewrites in order
    for (const rule of rules) {
      // Simple regex conversion matching Vercel path-to-regexp behavior
      const regexSource = new RegExp('^' + rule.source.replace('(.*)', '(.*)') + '$');
      if (regexSource.test(requestPath)) {
        const dest = requestPath.replace(regexSource, rule.destination.replace('$1', '$1'));
        return { destination: rule.destination, type: 'rewrite' };
      }
    }

    return { destination: requestPath, type: 'passthrough' };
  }

  const testCases: Array<{ path: string; expectedDest: string; description: string }> = [
    { path: '/', expectedDest: '/index.html', description: 'Root homepage' },
    { path: '/admin', expectedDest: '/index.html', description: 'Admin dashboard entry' },
    { path: '/admin/login', expectedDest: '/index.html', description: 'Admin login page' },
    { path: '/admin/tours', expectedDest: '/index.html', description: 'Admin tour management' },
    { path: '/admin/crm/leads', expectedDest: '/index.html', description: 'Admin CRM pipeline' },
    { path: '/admin/operations/departures', expectedDest: '/index.html', description: 'Operations departures' },
    { path: '/login', expectedDest: '/index.html', description: 'Customer login page' },
    { path: '/register', expectedDest: '/index.html', description: 'Customer registration' },
    { path: '/excursions', expectedDest: '/index.html', description: 'Excursions catalog' },
    { path: '/excursions/orange-bay-island-snorkeling', expectedDest: '/index.html', description: 'Tour detail deep link' },
    { path: '/booking', expectedDest: '/index.html', description: 'Booking checkout flow' },
    { path: '/booking/confirmation/RST-2026-AB1234', expectedDest: '/index.html', description: 'Voucher confirmation deep link' },
    { path: '/my-booking/RST-2026-AB1234', expectedDest: '/index.html', description: 'Customer portal deep link' },
    { path: '/api/chat', expectedDest: '/api/$1', description: 'API endpoint preserves /api/* without returning HTML' },
    { path: '/assets/nonexistent.js', expectedDest: '/assets/$1', description: 'Broken asset preserves /assets/* without returning HTML' },
  ];

  testCases.forEach((tc) => {
    const outcome = simulateVercelRouting(tc.path);
    assert(
      `Route: ${tc.path}`,
      outcome.destination === tc.expectedDest,
      `${tc.description} -> resolved to ${outcome.destination}`
    );
  });

  // 4. Check actual static assets on disk
  console.log('Step 4: Checking essential built files...');
  const essentialFiles = ['index.html', 'manifest.webmanifest', 'sw.js'];
  essentialFiles.forEach((file) => {
    const fPath = path.join(distPath, file);
    assert(`Asset ${file}`, fs.existsSync(fPath), `Found ${file} in dist/`);
  });

  // Summary
  console.log('\n================================================================');
  console.log('  Route Verification Test Results');
  console.log('================================================================');
  let allPassed = true;
  results.forEach((r) => {
    const icon = r.passed ? '✓' : '✗';
    console.log(`[${icon}] ${r.name}: ${r.message}`);
    if (!r.passed) allPassed = false;
  });

  console.log('================================================================');
  console.log(`Final Status: ${allPassed ? 'ALL ROUTE TESTS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runRouteTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
