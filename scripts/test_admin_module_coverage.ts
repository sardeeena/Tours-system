import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

const tabUnion = layout.match(/export type AdminTab\s*=\s*([\s\S]*?);/)?.[1];
assert.ok(tabUnion, 'AdminTab must remain a declared union');
const tabs = [...tabUnion.matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.equal(tabs.length, 61, 'The admin tab inventory changed; review the coverage matrix before updating this assertion');
assert.equal(new Set(tabs).size, tabs.length, 'AdminTab contains duplicate identifiers');

const navBlock = layout.match(/const navItems:[\s\S]*?=\s*\[([\s\S]*?)\n  \];/)?.[1];
assert.ok(navBlock, 'Sidebar navigation list must be discoverable');
const navIds = [...navBlock.matchAll(/id:\s*'([^']+)'/g)]
  .map((match) => match[1])
  .filter((id) => !id.startsWith('header_'));
assert.ok(navIds.length >= 55, 'Expected all primary admin destinations to remain visible');
const repeatedNavigationIds = [...new Set(navIds.filter((id, index) => navIds.indexOf(id) !== index))].sort();
assert.deepEqual(repeatedNavigationIds, ['dashboard', 'tours'], 'Only the two expandable parent rows may share their destination ID with their first child.');
assert.equal(new Set(navIds).size, navIds.length - 2, 'Unexpected duplicate sidebar destination IDs were introduced.');
assert.deepEqual(navIds.filter((id) => !tabs.includes(id)), [], 'Sidebar points to an unknown tab');

const routedTabs = new Set([...app.matchAll(/activeAdminTab\s*===\s*'([^']+)'/g)].map((match) => match[1]));
assert.deepEqual(tabs.filter((id) => !routedTabs.has(id)), [], 'Every AdminTab must render a route in App.tsx');

const intentionallyHiddenAliases = ['availability', 'crm_customers', 'crm_inquiries', 'tour_edit'].sort();
const notInSidebar = tabs.filter((id) => !navIds.includes(id)).sort();
assert.deepEqual(notInSidebar, intentionallyHiddenAliases, 'Hidden aliases/internal routes changed; review whether each should be navigable');

for (const id of tabs) {
  const routeIndex = app.indexOf(`activeAdminTab === '${id}'`);
  assert.ok(routeIndex >= 0, `Missing route expression for ${id}`);
  const routeWindow = app.slice(routeIndex, routeIndex + 900);
  assert.ok(routeWindow.includes('<'), `Route ${id} does not render a component or content node`);
}

for (const group of [
  'OVERVIEW & SALES',
  'OPERATIONS',
  'FINANCE',
  'MESSAGES & COMMUNICATIONS',
  'CUSTOMERS & CRM',
  'WEBSITE CONTENT',
  'ADMINISTRATION & SECURITY',
]) {
  assert.ok(layout.includes(group), `Missing sidebar group: ${group}`);
}

assert.match(layout, /const canSeeTab\s*=/, 'Sidebar visibility must remain permission-filtered');
assert.match(layout, /const canAccessActiveTab\s*=/, 'Direct tab access must remain permission-checked');
assert.match(app, /<AdminLayout/, 'Admin routes must render inside AdminLayout');

console.log(`Admin module coverage passed: ${tabs.length} typed tabs, ${navIds.length} sidebar destinations, ${intentionallyHiddenAliases.length} documented aliases/internal routes.`);
