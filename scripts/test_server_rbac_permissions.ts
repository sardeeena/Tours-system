import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');
const results: Array<{ name: string; passed: boolean }> = [];
const assert = (name: string, condition: boolean) => results.push({ name, passed: condition });

assert(
  'Authenticated server users carry normalized roles and permissions',
  /roles: string\[\];\s*permissions: string\[\];/.test(source)
    && /req\.user = \{ id: user\.id, email: user\.email, role, roles, permissions \}/.test(source)
);
assert(
  'Server authentication reads the caller-scoped RBAC context',
  source.includes("userScopedSupabase.rpc('get_my_access_context')")
    && source.includes('accessContext?.permissions')
);
assert(
  'Permission checks support exact permissions and module manage grants',
  source.includes('function userHasPermission(')
    && source.includes('permissions.includes(permission)')
    && source.includes("permissions.includes(moduleName + '.manage')")
);
assert(
  'Administrator MFA gate recognizes normalized admin role assignments',
  source.includes("req.user.roles?.some(role => role === 'admin' || role === 'super_admin')")
);
assert(
  'Super Admin-only account lifecycle checks normalized role assignments',
  source.includes("req.user.roles?.includes('super_admin')")
);
assert(
  'Communications status and consent history require read permission',
  source.includes("permission: 'communications.read' | 'communications.manage' = 'communications.read'")
    && source.includes("app.get('/api/communications/status'")
    && source.includes("app.get('/api/communications/whatsapp/consent'")
);
assert(
  'Email and WhatsApp dispatch require communications.manage',
  source.includes("app.post('/api/communications/email', rateLimit(20, 60_000), async (req: AuthenticatedRequest, res: Response) => {\n  if (!requireCommunicationsStaff(req, res, 'communications.manage')) return;")
    && source.includes("app.post('/api/communications/whatsapp', rateLimit(20, 60_000), async (req: AuthenticatedRequest, res: Response) => {\n  if (!requireCommunicationsStaff(req, res, 'communications.manage')) return;")
);
assert(
  'Consent changes require communications.manage',
  source.includes("app.post('/api/communications/whatsapp/consent', rateLimit(20, 60_000), async (req: AuthenticatedRequest, res: Response) => {\n  if (!requireCommunicationsStaff(req, res, 'communications.manage')) return;")
);
assert(
  'Both staff booking lookup paths require bookings.read',
  (source.match(/const isStaff = userHasPermission\(req, 'bookings\.read'\);/g) || []).length === 2
);
assert(
  'Administrative overview requires analytics.read',
  source.includes("if (!userHasPermission(req, 'analytics.read'))")
);
assert(
  'Session verification returns current RBAC roles and permissions',
  source.includes('roles: req.user.roles,') && source.includes('permissions: req.user.permissions,')
);

const failed = results.filter(result => !result.passed);
for (const result of results) {
  console.log((result.passed ? 'PASS ' : 'FAIL ') + result.name);
}
console.log(`\\n${results.length - failed.length}/${results.length} server RBAC checks passed.`);
if (failed.length) process.exit(1);
