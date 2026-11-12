import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20261112193000_superadmin_technical_telemetry.sql', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const layout = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf8');
const page = fs.readFileSync('src/components/admin/technical/TechnicalControlCenter.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

const checks: Array<{ name: string; passed: boolean }> = [
  { name: 'Telemetry table enables RLS', passed: /ALTER TABLE public\.technical_events ENABLE ROW LEVEL SECURITY/i.test(migration) },
  { name: 'Browser roles receive no telemetry table privileges', passed: /REVOKE ALL ON TABLE public\.technical_events FROM PUBLIC, anon, authenticated/i.test(migration) },
  { name: 'Only the server service role is granted table access', passed: /GRANT ALL ON TABLE public\.technical_events TO service_role/i.test(migration) },
  { name: 'Both technical API routes enforce superadmin AAL2', passed: (server.match(/requireSuperAdminAal2\(req, res\)/g) || []).length >= 3 },
  { name: 'API telemetry excludes technical endpoints and public health probes', passed: server.includes("routePath.startsWith('/api/admin/technical') || routePath === '/api/health'") },
  { name: 'Telemetry stores no request body, query string or authorization header', passed: !/metadata:\s*\{[^}]*req\.(body|query|headers)/s.test(server) },
  { name: 'Technical navigation is explicitly superadmin-only', passed: /id === 'technical'[\s\S]{0,40}\? isSuperAdmin/.test(layout) && /activeTab === 'technical'[\s\S]{0,40}\? isSuperAdmin/.test(layout) },
  { name: 'Technical page refuses non-superadmin users', passed: page.includes('Superadmin access only') && page.includes('isSuperAdmin') },
  { name: 'Technical page is registered as a protected admin route', passed: app.includes("adminSubRoute?.main === 'technical'") && app.includes("activeAdminTab === 'technical' && <TechnicalControlCenter />") },
];

for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'}: ${check.name}`);
}
const failed = checks.filter((check) => !check.passed);
console.log(`\\n${checks.length - failed.length}/${checks.length} technical control center security checks passed.`);
if (failed.length) process.exit(1);
