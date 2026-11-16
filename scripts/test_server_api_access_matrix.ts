import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');
const results: Array<{ name: string; passed: boolean; detail?: string }> = [];
const assert = (name: string, condition: boolean, detail?: string) => results.push({ name, passed: condition, detail });

type RouteEntry = { method: string; path: string };
const routePattern = /app\.(get|post|put|patch|delete)\(\s*(\[[\s\S]*?\]|'[^']+'|"[^"]+")/g;
const actualRoutes: RouteEntry[] = [];
let routeMatch: RegExpExecArray | null;
while ((routeMatch = routePattern.exec(source)) !== null) {
  const routeExpression = routeMatch[2];
  const paths = [...routeExpression.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  for (const path of paths) {
    if (path.startsWith('/api/')) actualRoutes.push({ method: routeMatch[1].toUpperCase(), path });
  }
}

const expectedRoutes: RouteEntry[] = [
  { method: 'POST', path: '/api/chat' },
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/api/communications/status' },
  { method: 'POST', path: '/api/communications/email' },
  { method: 'POST', path: '/api/webhooks/resend' },
  { method: 'GET', path: '/api/communications/whatsapp/consent' },
  { method: 'POST', path: '/api/communications/whatsapp/consent' },
  { method: 'POST', path: '/api/communications/whatsapp' },
  { method: 'GET', path: '/api/webhooks/whatsapp' },
  { method: 'POST', path: '/api/webhooks/whatsapp' },
  { method: 'GET', path: '/api/config' },
  { method: 'GET', path: '/api/tours' },
  { method: 'POST', path: '/api/bookings/create' },
  { method: 'POST', path: '/api/inquiries' },
  { method: 'POST', path: '/api/inquiries/submit' },
  { method: 'POST', path: '/api/contact' },
  { method: 'GET', path: '/api/newsletter/unsubscribe' },
  { method: 'POST', path: '/api/newsletter/unsubscribe' },
  { method: 'POST', path: '/api/newsletter' },
  { method: 'POST', path: '/api/newsletter/subscribe' },
  { method: 'GET', path: '/api/admin/technical/overview' },
  { method: 'GET', path: '/api/admin/technical/audit-logs' },
  { method: 'GET', path: '/api/admin/technical/events' },
  { method: 'POST', path: '/api/visitor/consent' },
  { method: 'POST', path: '/api/visitor/events' },
  { method: 'GET', path: '/api/admin/technical/visitors/overview' },
  { method: 'GET', path: '/api/admin/technical/visitors/events' },
  { method: 'GET', path: '/api/admin/technical/visitors/sessions' },
  { method: 'GET', path: '/api/admin/technical/visitors/consent' },
  { method: 'POST', path: '/api/admin/technical/visitors/erase' },
  { method: 'GET', path: '/api/admin/technical/visitors/settings' },
  { method: 'POST', path: '/api/admin/technical/visitors/settings' },
  { method: 'GET', path: '/api/admin/translations' },
  { method: 'POST', path: '/api/admin/translations' },
  { method: 'GET', path: '/api/admin/translations/source' },
  { method: 'GET', path: '/api/content-translations/resolve' },
  { method: 'GET', path: '/api/content-translations/ui' },
  { method: 'GET', path: '/api/content-translations/locales' },
  { method: 'GET', path: '/api/admin/users' },
  { method: 'POST', path: '/api/admin/users/invite' },
  { method: 'GET', path: '/api/admin/users/:userId/status' },
  { method: 'POST', path: '/api/admin/users/:userId/status' },
  { method: 'POST', path: '/api/admin/users/:userId/password-reset' },
  { method: 'GET', path: '/api/auth/verify-session' },
];

const routeKey = ({ method, path }: RouteEntry) => method + ' ' + path;
const actualKeys = actualRoutes.map(routeKey).sort();
const expectedKeys = expectedRoutes.map(routeKey).sort();
assert(
  'Every API route is explicitly classified in the access inventory',
  actualKeys.length === expectedKeys.length && actualKeys.every((key, index) => key === expectedKeys[index]),
  'Update expectedRoutes and docs/server-api-access-matrix.md whenever an API route is added, removed, or changed.'
);

const routeBlock = (method: string, path: string): string => {
  const start = source.indexOf("app." + method.toLowerCase() + "('" + path + "'");
  if (start < 0) return '';
  const nextRoute = source.slice(start + 1).search(/\napp\.(?:get|post|put|patch|delete)\(/i);
  return source.slice(start, nextRoute < 0 ? source.length : start + 1 + nextRoute);
};

const superAdminRoutes = expectedRoutes.filter((route) => route.path.startsWith('/api/admin/'));
assert(
  'Every Super Admin API route requires normalized Super Admin plus AAL2',
  superAdminRoutes.length === 18 && superAdminRoutes.every((route) => routeBlock(route.method, route.path).includes('requireSuperAdminAal2(req, res)')),
  'All /api/admin/* routes must retain the dedicated Super Admin/AAL2 guard.'
);

const communicationReadRoutes = [
  { method: 'GET', path: '/api/communications/status', guard: 'requireCommunicationsStaff(req, res)' },
  { method: 'GET', path: '/api/communications/whatsapp/consent', guard: 'requireCommunicationsStaff(req, res)' },
];
const communicationManageRoutes = [
  { method: 'POST', path: '/api/communications/email', guard: "requireCommunicationsStaff(req, res, 'communications.manage')" },
  { method: 'POST', path: '/api/communications/whatsapp/consent', guard: "requireCommunicationsStaff(req, res, 'communications.manage')" },
  { method: 'POST', path: '/api/communications/whatsapp', guard: "requireCommunicationsStaff(req, res, 'communications.manage')" },
];
assert(
  'Communication read endpoints require communications.read',
  communicationReadRoutes.every((route) => routeBlock(route.method, route.path).includes(route.guard))
);
assert(
  'Communication dispatch and consent mutation require communications.manage',
  communicationManageRoutes.every((route) => routeBlock(route.method, route.path).includes(route.guard))
);
assert(
  'All API routes pass through token authentication middleware',
  source.includes("app.use('/api', authenticateToken as any);")
);
assert(
  'Server-side permission checks use only normalized roles and permissions',
  source.includes('// Only the live, caller-scoped normalized RBAC context may grant access.')
    && source.includes('const roles = req.user.roles || [];')
    && !source.includes("|| req.user.role === 'super_admin' || req.user.role === 'admin'")
);
assert(
  'Session verification exposes only the authenticated account RBAC context',
  routeBlock('GET', '/api/auth/verify-session').includes('if (!req.user)')
    && routeBlock('GET', '/api/auth/verify-session').includes('roles: req.user.roles')
    && routeBlock('GET', '/api/auth/verify-session').includes('permissions: req.user.permissions')
);

const failed = results.filter((result) => !result.passed);
for (const result of results) {
  console.log((result.passed ? 'PASS ' : 'FAIL ') + result.name + (result.detail ? ' — ' + result.detail : ''));
}
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' API access matrix checks passed.');
if (failed.length) process.exit(1);
