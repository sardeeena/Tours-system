import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const checks: Array<{ name: string; passed: boolean }> = [];
const check = (name: string, passed: boolean) => checks.push({ name, passed });

const visitorPanel = fs.readFileSync('src/components/admin/technical/VisitorAnalyticsPanel.tsx', 'utf8');
const reportingService = fs.readFileSync('src/services/reportingService.ts', 'utf8');
const technicalPanel = fs.readFileSync('src/components/admin/technical/TechnicalControlCenter.tsx', 'utf8');
const spreadsheetSerializer = fs.readFileSync('src/utils/spreadsheetExport.ts', 'utf8');
const spreadsheetExportFiles = [
  'src/components/admin/AdminBookingsList.tsx',
  'src/components/admin/AdminCustomersList.tsx',
  'src/components/admin/AdminNewsletterList.tsx',
  'src/components/admin/operations/OperationsDocuments.tsx',
  'src/components/admin/operations/OperationsManifests.tsx',
  'src/components/admin/finance/FinanceReports.tsx',
  'src/components/admin/finance/FinancePayments.tsx',
  'src/components/admin/finance/FinanceRefunds.tsx',
  'src/components/admin/finance/FinanceOutstandingBalances.tsx',
  'src/components/admin/crm/CrmCustomersManager.tsx',
  'src/components/admin/crm/CrmSegmentsManager.tsx',
  'src/components/admin/communications/CommunicationsHistory.tsx',
].map((path) => ({ path, source: fs.readFileSync(path, 'utf8') }));

check(
  'Every CSV and TSV export uses the shared spreadsheet formula neutralizer',
  spreadsheetSerializer.includes('serializeSpreadsheetCell')
    && spreadsheetSerializer.includes("typeof value === 'string'")
    && spreadsheetSerializer.includes('formulaSafe')
    && spreadsheetSerializer.includes('\\ufeff')
    && visitorPanel.includes('serializeSpreadsheetRows([columns, ...rows])')
    && reportingService.includes('serializeSpreadsheetRows([')
    && technicalPanel.includes('serializeSpreadsheetRows([columns, ...rows])')
    && reportingService.match(/serializeSpreadsheetRows\(/g)?.length === 2
    && spreadsheetExportFiles.every(({ source }) => source.includes('serializeSpreadsheetRows([headers, ...rows])'))
    && !technicalPanel.includes('String(value).replace')
);
check(
  'Spreadsheet formula neutralization preserves numeric values',
  spreadsheetSerializer.includes("typeof value === 'string' &&")
);

const telemetryStart = server.indexOf('// Sanitized API telemetry.');
const telemetryEnd = server.indexOf('// Initialize Google Gen AI client', telemetryStart);
const telemetry = telemetryStart >= 0 && telemetryEnd > telemetryStart
  ? server.slice(telemetryStart, telemetryEnd)
  : '';

check(
  'API telemetry is disabled unless the server has a service-role client',
  telemetry.includes("if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') return;")
);
check(
  'API telemetry excludes technical endpoints and public health probes',
  telemetry.includes("routePath.startsWith('/api/admin/technical') || routePath === '/api/health'")
);
check(
  'API telemetry does not persist request bodies, query strings, headers, or raw cookies',
  telemetry.includes('metadata: { request_id: requestId }')
    && !/req\.(body|query|headers|cookies)/.test(telemetry)
);
check(
  'Telemetry persistence failures are observed without logging request or database payloads',
  telemetry.includes(".then(({ error }) => {")
    && telemetry.includes("console.warn('[API telemetry] Sanitized event could not be persisted.')")
);
check(
  'Audit history remains behind the Super Admin AAL2 boundary',
  /app\.get\('\/api\/admin\/technical\/audit-logs'[\s\S]*?requireSuperAdminAal2\(req, res\)/.test(server)
);
check(
  'Audit history response applies a privacy filter to before/after snapshots',
  server.includes('const safeSnapshot = (value: unknown)')
    && server.includes('old_data: safeSnapshot(record.old_data), new_data: safeSnapshot(record.new_data)')
);
const visitorEventsStart = server.indexOf("app.post('/api/visitor/events'");
const visitorEventsEnd = server.indexOf("app.get('/api/admin/technical/visitors/overview'", visitorEventsStart);
const visitorEventsRoute = visitorEventsStart >= 0 && visitorEventsEnd > visitorEventsStart
  ? server.slice(visitorEventsStart, visitorEventsEnd)
  : '';
check(
  'Visitor analytics event ingestion uses one consent-gated database RPC',
  visitorEventsRoute.includes(".rpc('record_visitor_event'") &&
    !visitorEventsRoute.includes(".from('visitor_sessions').select") &&
    !visitorEventsRoute.includes(".from('visitor_events').insert")
);
check(
  'Visitor analytics accepts only allowlisted event names and event fields',
  server.includes('const VISITOR_EVENT_NAMES = new Set([')
    && server.includes('const VISITOR_EVENT_FIELDS = new Set([')
    && server.includes('p_event_data: safeVisitorEventData(req.body?.event_data)')
);

const performanceMigration = fs.readFileSync('supabase/migrations/20261122000000_project_performance_optimization.sql', 'utf8');
const bookingWorker = fs.readFileSync('src/server/bookingNotificationWorker.ts', 'utf8');
const tourService = fs.readFileSync('src/services/tourService.ts', 'utf8');

check(
  'Public generated text endpoints use bounded in-process response caching',
  server.includes('function cachePublicTextResponse') &&
    server.includes("cachePublicTextResponse(300_000") &&
    server.includes('publicHtmlResponseCache')
);
check(
  'Public translation endpoints cache locale dictionaries and reduce repeated checksum scans',
  server.includes("app.get('/api/content-translations/ui', cachePublicResponse(300_000") &&
    server.includes("app.get('/api/content-translations/locales', cachePublicResponse(300_000") &&
    server.includes("app.get('/api/content-translations/target', cachePublicResponse(60_000") &&
    server.includes("app.get('/api/content-translations/resolve', cachePublicResponse(60_000")
);
check(
  'Readiness probes use a bounded existence check instead of an exact count',
  server.includes(".select('id')\n    .eq('status', 'published')\n    .limit(1)\n    .maybeSingle()") &&
    !server.includes(".select('id', { head: true, count: 'exact' })")
);
check(
  'Idle booking queue polling backs off while active deliveries remain responsive',
  bookingWorker.includes('IDLE_QUEUE_POLL_INTERVAL_MS = 30_000') &&
    bookingWorker.includes('ACTIVE_QUEUE_POLL_INTERVAL_MS = 15_000') &&
    bookingWorker.includes("messages.length > 0 ? 'active' : 'idle'")
);
check(
  'Published catalogue cache reduces repeated reads while retaining mutation invalidation',
  tourService.includes('const CACHE_TTL_MS = 5 * 60 * 1000;') &&
    tourService.includes('export function invalidateCatalogueCache()')
);
check(
  'Database optimization migration adds the four missing FK indexes',
  ['captain_id', 'driver_id', 'guide_id', 'vessel_id'].every((column) =>
    performanceMigration.includes('exclusive_departures_' + column + '_idx')
  )
);
check(
  'Database optimization migration makes auth and permission RLS checks statement-scoped',
  performanceMigration.includes('(SELECT auth.role())') &&
    performanceMigration.includes('(SELECT public.has_permission(')
);
check(
  'Visitor event RPC is service-role-only and atomically verifies consent',
  performanceMigration.includes('CREATE OR REPLACE FUNCTION public.record_visitor_event') &&
    performanceMigration.includes('analytics_consent = TRUE') &&
    performanceMigration.includes('TO service_role')
);

const failed = checks.filter((item) => !item.passed);
for (const item of checks) console.log((item.passed ? 'PASS ' : 'FAIL ') + item.name);
console.log('\n' + (checks.length - failed.length) + '/' + checks.length + ' audit and analytics boundary checks passed.');
if (failed.length) process.exit(1);
