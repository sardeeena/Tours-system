import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const checks: Array<{ name: string; passed: boolean }> = [];
const check = (name: string, passed: boolean) => checks.push({ name, passed });

const visitorPanel = fs.readFileSync('src/components/admin/technical/VisitorAnalyticsPanel.tsx', 'utf8');
const reportingService = fs.readFileSync('src/services/reportingService.ts', 'utf8');
const technicalPanel = fs.readFileSync('src/components/admin/technical/TechnicalControlCenter.tsx', 'utf8');
const spreadsheetSerializer = fs.readFileSync('src/utils/spreadsheetExport.ts', 'utf8');
check(
  'Every CSV and TSV export uses the shared spreadsheet formula neutralizer',
  spreadsheetSerializer.includes('serializeSpreadsheetCell')
    && spreadsheetSerializer.includes("typeof value === 'string'")
    && spreadsheetSerializer.includes('formulaSafe')
    && visitorPanel.includes('serializeSpreadsheetRows([columns, ...rows])')
    && reportingService.includes('serializeSpreadsheetRows([')
    && technicalPanel.includes('serializeSpreadsheetRows([columns, ...rows])')
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
check(
  'Visitor analytics event ingestion requires an existing consented session',
  /app\.post\('\/api\/visitor\/events'[\s\S]*?if \(!session\?\.analytics_consent\) return res\.status\(204\)\.end\(\)/.test(server)
);
check(
  'Visitor analytics accepts only allowlisted event names and event fields',
  server.includes('const VISITOR_EVENT_NAMES = new Set([')
    && server.includes('const VISITOR_EVENT_FIELDS = new Set([')
    && server.includes('event_data: safeVisitorEventData(req.body?.event_data)')
);

const failed = checks.filter((item) => !item.passed);
for (const item of checks) console.log((item.passed ? 'PASS ' : 'FAIL ') + item.name);
console.log('\n' + (checks.length - failed.length) + '/' + checks.length + ' audit and analytics boundary checks passed.');
if (failed.length) process.exit(1);
