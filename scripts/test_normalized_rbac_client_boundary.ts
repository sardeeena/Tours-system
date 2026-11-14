import fs from 'node:fs';

const authService = fs.readFileSync('src/services/authService.ts', 'utf8');
const authContext = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');
const adminSettings = fs.readFileSync('src/components/admin/AdminSettings.tsx', 'utf8');

const checks: Array<{ name: string; passed: boolean }> = [];
const check = (name: string, passed: boolean) => checks.push({ name, passed });

const isUserAdminStart = authService.indexOf('export function isUserAdmin(');
const isUserAdminEnd = authService.indexOf('\n}', isUserAdminStart);
const isUserAdminBlock = authService.slice(isUserAdminStart, isUserAdminEnd);
check(
  'Staff/admin classification uses normalized roles only',
  isUserAdminBlock.includes('user.roles?.some') && !isUserAdminBlock.includes('user.role ===')
);

const currentUserStart = authService.indexOf('export async function getCurrentAdminUser()');
const currentUserEnd = authService.indexOf('\nexport async function verifyAdminAccess()', currentUserStart);
const currentUserBlock = authService.slice(currentUserStart, currentUserEnd);
check(
  'Missing normalized role arrays fail closed instead of falling back to profiles.role',
  currentUserBlock.includes(': [];') && !currentUserBlock.includes('[profile.role as UserRole]')
);

const verifyStart = authService.indexOf('export async function verifyAdminAccess()');
const verifyEnd = authService.indexOf('\n/**', verifyStart);
const verifyBlock = authService.slice(verifyStart, verifyEnd);
check(
  'Admin and Super Admin verification uses normalized role assignments only',
  verifyBlock.includes('const isSuperAdmin = roles.includes(\'super_admin\');')
    && verifyBlock.includes('roles.some(')
    && !verifyBlock.includes('profile.role ===')
);

check(
  'Auth context MFA and permission gates do not fall back to the legacy role field',
  !authContext.includes('candidate.role ===')
    && !authContext.includes('user?.role ===')
    && !authContext.includes('getUserPermissions(user?.role)')
    && authContext.includes('const permissions = user?.permissions ?? [];')
);

check(
  'Site Settings UI visibility requires an explicitly assigned normalized Super Admin role',
  adminSettings.includes("const isSuperAdmin = Boolean(user?.roles?.includes('super_admin'));")
    && !adminSettings.includes("user.role === 'super_admin'")
);

const failed = checks.filter((item) => !item.passed);
for (const item of checks) console.log((item.passed ? 'PASS ' : 'FAIL ') + item.name);
console.log('\n' + (checks.length - failed.length) + '/' + checks.length + ' normalized RBAC client checks passed.');
if (failed.length) process.exit(1);
