import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf8');

// The sidebar is intentionally grouped into a short, predictable information hierarchy.
for (const section of [
  'OVERVIEW & SALES',
  'OPERATIONS',
  'FINANCE',
  'MESSAGES & COMMUNICATIONS',
  'CUSTOMERS & CRM',
  'WEBSITE CONTENT',
  'ADMINISTRATION & SECURITY',
]) {
  assert.ok(layout.includes(section), `Missing admin navigation group: ${section}`);
}
assert.match(layout, /header_core: false/, 'The primary overview and sales group is expanded by default');
assert.match(layout, /setCollapsedSections\(\(previous\) => \(\{ \.\.\.previous, \[item\.id\]: !previous\[item\.id\] \}\)\)/, 'Navigation groups remain user-collapsible');
assert.match(layout, /setCollapsedSections\(\(previous\) => \(\{ \.\.\.previous, \[section\.id\]: false \}\)\)/, 'Navigating directly to a tab expands its parent group');

// The live public site must be reachable even when the mobile/tablet drawer is closed.
assert.match(layout, /aria-label="Go to live website"[\s\S]*?onClick=\{onNavigateSite\}/, 'The top bar exposes a clearly labelled live-site shortcut');
assert.match(layout, /title="View Live Website"[\s\S]*?onClick=\{onNavigateSite\}/, 'The sidebar retains its live-site shortcut');
assert.match(layout, /aria-label="Open sidebar"/, 'The sidebar can be reopened from the top bar');
assert.match(layout, /event\.key === 'Escape'[\s\S]*?setIsSidebarOpen\(false\)/, 'Escape closes the mobile/tablet navigation drawer');
assert.match(layout, /window\.innerWidth < 1024/, 'Touch-sized viewports use the drawer interaction');
assert.match(layout, /max-w-\[88vw\]/, 'The drawer leaves room for the page backdrop on narrow screens');
assert.match(layout, /min-h-11 flex items-center justify-between px-3 py-2 rounded-xl/, 'Primary navigation rows have touch-friendly target height');

// Navigation visibility and direct-tab access must continue to use the existing permission checks.
assert.match(layout, /const visibleNavItems = navItems\.flatMap/, 'Navigation is filtered before rendering');
assert.match(layout, /const canAccessActiveTab =/, 'Direct tab access remains guarded');
assert.match(layout, /id === 'translations'[\s\S]*?isSuperAdmin/, 'Translations remain restricted to super administrators');
assert.match(layout, /id === 'access_control'[\s\S]*?canManageAccess/, 'Access control remains restricted to administrators');
assert.match(layout, /hasPermission\(activePermission\)/, 'Active content still requires the assigned permission');

console.log('Admin navigation hierarchy, live-site access, responsive drawer and RBAC regression checks passed.');
