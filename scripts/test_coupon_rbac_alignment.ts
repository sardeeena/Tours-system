import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261120030000_coupons_require_content_permissions.sql', 'utf8');
const databaseTest = fs.readFileSync('supabase/tests/coupons_rbac.test.sql', 'utf8');
const canonicalSchema = fs.readFileSync('complete_schema.sql', 'utf8');

const couponGate = layout.match(/if\s*\(id\s*===\s*'coupons'\)\s*return\s*'([^']+)'/);
assert.equal(couponGate?.[1], 'content.manage', 'Coupon management UI must require content.manage, not bookings.read.');

for (const action of ['read', 'create', 'update', 'delete']) {
  assert.ok(migration.includes(`public.has_permission('content.${action}')`), `Database coupon RLS must require content.${action}`);
  assert.ok(databaseTest.includes(`content.${action}`), `pgTAP must cover content.${action}`);
}
assert.ok(!migration.includes("public.has_permission('bookings.read')"), 'Coupon policies must not grant access based on bookings.read.');
for (const action of ['read', 'create', 'update', 'delete']) {
  assert.ok(canonicalSchema.includes(`public.has_permission('content.${action}'::text)`), `Canonical schema must mirror content.${action}`);
}
assert.match(databaseTest, /coupon reads require content\.read rather than bookings\.read/);
console.log('Coupon RBAC alignment passed: UI and database writes require content permissions.');
