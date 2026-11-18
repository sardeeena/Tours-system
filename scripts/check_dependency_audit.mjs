import fs from 'node:fs';

const reportPath = process.argv[2] ?? 'dependency-audit.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

const allowedAdvisory = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const expectedPackages = [
  '@vitejs/plugin-react',
  'fdir',
  'picomatch',
  'tinyglobby',
  'vite',
].sort();

function fail(message) {
  console.error(`Dependency security policy failed: ${message}`);
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const actualPackages = Object.keys(vulnerabilities).sort();
const summary = report.metadata?.vulnerabilities;

if (!summary) fail('npm audit report has no vulnerability summary.');

// The previously documented Vite toolchain advisory is no longer guaranteed to
// appear in every registry snapshot. A clean audit is the strongest result and
// must pass without requiring the old exception packages to remain vulnerable.
if (summary.total === 0) {
  if ([summary.high, summary.critical, summary.moderate, summary.low, summary.info].some((count) => count !== 0)) {
    fail(`Inconsistent clean audit severity totals: ${JSON.stringify(summary)}`);
  }
  console.log('Dependency security policy passed: no advisories found.');
  process.exit(0);
}
if (JSON.stringify(actualPackages) !== JSON.stringify(expectedPackages)) {
  fail(`Unexpected vulnerable packages: ${actualPackages.join(', ') || '(none)'}`);
}
if (
  summary.total !== expectedPackages.length
  || summary.high !== expectedPackages.length
  || summary.critical !== 0
  || summary.moderate !== 0
  || summary.low !== 0
  || summary.info !== 0
) {
  fail(`Unexpected audit severity totals: ${JSON.stringify(summary)}`);
}

const advisoryUrls = new Set();
for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (vulnerability.severity !== 'high') {
    fail(`${name} has unexpected severity ${vulnerability.severity}.`);
  }
  for (const item of vulnerability.via ?? []) {
    if (typeof item === 'object' && item.url) advisoryUrls.add(item.url);
  }
}
if (advisoryUrls.size !== 1 || !advisoryUrls.has(allowedAdvisory)) {
  fail(`Unexpected advisory set: ${[...advisoryUrls].join(', ') || '(none)'}`);
}

for (const name of expectedPackages) {
  const entry = lock.packages?.[`node_modules/${name}`];
  if (!entry) fail(`package-lock.json is missing node_modules/${name}.`);
  if (entry.dev !== true) fail(`${name} is not marked development-only in package-lock.json.`);
  if (packageJson.dependencies?.[name]) {
    fail(`${name} unexpectedly appears in production dependencies.`);
  }
}
if (!packageJson.devDependencies?.vite || !packageJson.devDependencies?.['@vitejs/plugin-react']) {
  fail('Vite and its React plugin must remain development dependencies.');
}

console.log('Dependency security policy passed.');
console.log('Allowed development-only advisory:', allowedAdvisory);
console.log('Affected development packages:', expectedPackages.join(', '));
console.log('No other advisories are permitted. Production dependencies are audited separately.');
