import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261120030000_coupons_require_content_permissions.sql', 'utf8');
const databaseTest = fs.readFileSync('supabase/tests/coupons_rbac.test.sql', 'utf8');
const schemaSnapshots = ['complete_schema.sql', 'supabase/schema.sql', 'supabase_complete_schema.sql'].map((path) => fs.readFileSync(path, 'utf8'));

const couponGate = layout.match(/if\s*\(id\s*===\s*'coupons'\)\s*return\s*'([^']+)'/);
assert.equal(couponGate?.[1], 'content.manage', 'Coupon management UI must require content.manage, not bookings.read.');

for (const action of ['read', 'create', 'update', 'delete']) {
  assert.ok(migration.includes(`public.has_permission('content.${action}')`), `Database coupon RLS must require content.${action}`);
  assert.ok(databaseTest.includes(`content.${action}`), `pgTAP must cover content.${action}`);
}
assert.ok(!migration.includes("public.has_permission('bookings.read')"), 'Coupon policies must not grant access based on bookings.read.');
for (const action of ['read', 'create', 'update', 'delete']) {
  assert.ok(schemaSnapshots[0].includes(`public.has_permission('content.${action}'::text)`), `Canonical schema must mirror content.${action}`);
}
assert.ok(migration.includes('DROP POLICY IF EXISTS "Public validate coupons"'), 'Migration must remove the legacy PUBLIC coupon-read policy.');
assert.ok(migration.includes('DROP POLICY IF EXISTS "Admins manage coupons"'), 'Migration must remove the legacy profile-role admin bypass policy.');
for (const [index, snapshot] of schemaSnapshots.entries()) {
  assert.ok(!/CREATE POLICY "Public (?:validate coupons|can read active coupons)"/i.test(snapshot), `Schema snapshot ${index} must not expose coupon rows to PUBLIC.`);
  assert.ok(!/CREATE POLICY "Admins (?:manage coupons|can manage coupons)"/i.test(snapshot), `Schema snapshot ${index} must not retain the legacy profile-role coupon admin bypass.`);
}
assert.match(databaseTest, /coupon reads require content\.read rather than bookings\.read/);
console.log('Coupon RBAC alignment passed: UI and database writes require content permissions.');
