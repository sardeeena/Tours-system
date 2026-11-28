import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20261112190420_superadmin_technical_telemetry.sql', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const layout = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf8');
const page = fs.readFileSync('src/components/admin/technical/TechnicalControlCenter.tsx', 'utf8');
const visitorPanel = fs.readFileSync('src/components/admin/technical/VisitorAnalyticsPanel.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

const checks: Array<{ name: string; passed: boolean }> = [
  { name: 'Telemetry table enables RLS', passed: /ALTER TABLE public\.technical_events ENABLE ROW LEVEL SECURITY/i.test(migration) },
  { name: 'Browser roles receive no telemetry table privileges', passed: /REVOKE ALL ON TABLE public\.technical_events FROM PUBLIC, anon, authenticated/i.test(migration) },
  { name: 'Only the server service role is granted table access', passed: /GRANT ALL ON TABLE public\.technical_events TO service_role/i.test(migration) },
  { name: 'Both technical API routes enforce superadmin AAL2', passed: (server.match(/requireSuperAdminAal2\(req, res\)/g) || []).length >= 3 },
  { name: 'Operational lifecycle reporting uses a separate protected server endpoint', passed: server.includes("app.get('/api/admin/technical/booking-lifecycle/overview'") && server.includes("from('booking_lifecycle_events')") && server.includes('requireSuperAdminAal2(req, res)') },
  { name: 'Visitor dashboard keeps operational lifecycle metrics separate from consented visitor funnel', passed: visitorPanel.includes('/api/admin/technical/booking-lifecycle/overview') && visitorPanel.includes('Separate from consented visitor tracking') && visitorPanel.includes('Staff-recorded confirmations') },
  { name: 'API telemetry excludes technical endpoints and public health probes', passed: server.includes("routePath.startsWith('/api/admin/technical') || routePath === '/api/health'") },
  { name: 'Destructive visitor retention cleanup only runs in production with a service-role key', passed: server.includes("process.env.NODE_ENV !== 'production' || !serverSupabase || SUPABASE_KEY_TYPE !== 'service_role'") && /if \(process\.env\.NODE_ENV === 'production' && serverSupabase && SUPABASE_KEY_TYPE === 'service_role'\) \{[\s\S]{0,300}pruneVisitorAnalytics/.test(server) },
  { name: 'Telemetry stores no request body, query string or authorization header', passed: !/metadata:\s*\{[^}]*req\.(body|query|headers)/s.test(server) },
  { name: 'Technical diagnostics are hidden from admin navigation and direct tab access', passed: !layout.includes("label: 'Technical Control Center'") && layout.slice(layout.indexOf('const canSeeTab'), layout.indexOf('const visibleNavItems')).includes('? false') && layout.slice(layout.indexOf('const canAccessActiveTab'), layout.indexOf('let activeNavSection')).includes('? false') },
  { name: 'Privacy and retention controls remain accessible through a separate superadmin workspace', passed: layout.includes("id: 'privacy_data', label: 'Privacy & Data'") && app.includes("activeAdminTab === 'privacy_data' && <VisitorAnalyticsPanel />") },
  { name: 'Translation workspace navigation is Super Admin-only', passed: /id === 'translations'[\s\S]{0,40}\? isSuperAdmin/.test(layout) && /activeTab === 'translations'[\s\S]{0,40}\? isSuperAdmin/.test(layout) },
  { name: 'Technical page refuses non-superadmin users', passed: page.includes('Superadmin access only') && page.includes('isSuperAdmin') },
  { name: 'Technical page is registered as a protected admin route', passed: app.includes("adminSubRoute?.main === 'technical'") && app.includes("activeAdminTab === 'technical' && <TechnicalControlCenter />") },
];

for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'}: ${check.name}`);
}
const failed = checks.filter((check) => !check.passed);
console.log(`\\n${checks.length - failed.length}/${checks.length} technical control center security checks passed.`);
if (failed.length) process.exit(1);
