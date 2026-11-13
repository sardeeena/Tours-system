import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = [
  'src',
  'public',
  'scripts',
  'index.html',
  'supabase/seed.sql',
  'supabase/catalogue_seed.sql',
  'supabase/seed',
];
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.json', '.webmanifest', '.svg', '.txt', '.sql',
]);
const RETIRED_BRANDS = [
  { label: 'retired company identity', pattern: new RegExp(['Kemet', 'Spirit'].join('\\s+'), 'i') },
  { label: 'retired company domain', pattern: new RegExp(['kemetspirit', '.com'].join(''), 'i') },
  { label: 'retired travel brand', pattern: new RegExp(['Red', 'Sea', 'Voyages'].join('\\s+'), 'i') },
  { label: 'retired travel domain', pattern: new RegExp(['redsea', 'voyages', '.com'].join(''), 'i') },
  { label: 'retired category label', pattern: new RegExp(['Red', 'Sea', 'Excursions?'].join('\\s+'), 'i') },
];

function collectFiles(entry: string): string[] {
  const absolute = path.join(ROOT, entry);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((item) => {
    if (item.name === 'node_modules' || item.name === '.git' || item.name === 'dist') return [];
    const child = path.join(absolute, item.name);
    return item.isDirectory() ? collectFiles(path.relative(ROOT, child)) : [child];
  });
}

const files = [...new Set(SCAN_ROOTS.flatMap(collectFiles))].filter((file) => {
  const relative = path.relative(ROOT, file);
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()) || relative.startsWith('public/assets/aistudio/');
});
const violations: string[] = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const retired of RETIRED_BRANDS) {
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (retired.pattern.test(line)) {
        violations.push(path.relative(ROOT, file) + ':' + (index + 1) + ' contains retired branding (' + retired.label + ')');
      }
    });
  }
}

if (violations.length) {
  console.error('Retired branding found in active website content:');
  violations.forEach((violation) => console.error(' - ' + violation));
  process.exitCode = 1;
} else {
  console.log('Brand identity check passed across ' + files.length + ' active website and seed files.');
}
