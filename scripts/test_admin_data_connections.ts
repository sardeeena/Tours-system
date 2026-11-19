import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const section = (source: string, start: string, end: string) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Could not inspect source section: ${start}`);
  return source.slice(a, b);
};

const tours = read('src/services/tourService.ts');
const adminTours = section(tours, 'export async function adminListTours(', 'export async function');
assert.match(adminTours, /if \(import\.meta\.env\.PROD\)[\s\S]*?throw new Error/, 'Admin tour listing must fail closed in production when schema/config is unavailable');
assert.match(adminTours, /if \(isSchemaMissingError\(error\)\)[\s\S]*?import\.meta\.env\.PROD/, 'Schema-missing errors must not silently show local demo tours in production');

const operations = read('src/services/operationsService.ts');
const listGuides = section(operations, 'export async function listGuides()', 'export async function saveGuide(');
assert.match(listGuides, /if \(!import\.meta\.env\?\.DEV\)[\s\S]*?throw new Error/, 'Production guide listing must not fall back to seeded staff');
assert.match(listGuides, /const \{ data, error \} = await supabase\.from\('guides'\)/, 'Guide listing must query Supabase');
assert.match(listGuides, /if \(error\) throw/, 'Guide query failures must be surfaced');
assert.match(listGuides, /return guides;/, 'An empty database result must remain an empty list');

const saveGuide = section(operations, 'export async function saveGuide(', 'export async function deleteGuide(');
assert.match(saveGuide, /supabase\.from\('guides'\)\.insert\(payload\)\.select\('\*'\)\.single\(\)/, 'New guide records must return the database-generated UUID');
assert.match(saveGuide, /supabase\.from\('guides'\)\.update\(payload\)[\s\S]*?\.select\('\*'\)/, 'Guide edits must return the authoritative database row');
assert.match(saveGuide, /if \(!result\.data\) throw/, 'Guide writes must not report success without a persisted row');

const guideUi = read('src/components/admin/operations/OperationsGuides.tsx');
assert.match(guideUi, /loadError/, 'Guide registry must expose load failures rather than show an empty list');
assert.match(guideUi, /Operational staff could not be loaded/, 'Guide registry must distinguish errors from empty data');

const staffHook = read('src/hooks/useCrmAssignableStaff.ts');
assert.match(staffHook, /listInquiryAssignees\(\)/, 'CRM assignment options must come from the permission-filtered live staff RPC');
for (const path of [
  'src/components/admin/crm/CrmLeadsManager.tsx',
  'src/components/admin/crm/CrmTasksManager.tsx',
  'src/components/admin/crm/CrmFollowUpsManager.tsx',
]) {
  const component = read(path);
  assert.match(component, /useCrmAssignableStaff/, `${path} must use live staff assignments`);
  assert.doesNotMatch(component, /Captain Tarek|Mona Zaki|Ahmed Fathy|Captain Farouk|Youssef Marina Desk/, `${path} must not offer fabricated hard-coded staff`);
}

const crm = read('src/services/crmService.ts');
assert.match(crm, /function useLocalCrmData\(/, 'CRM local data must be explicitly limited to development');
for (const [start, end] of [
  ['export async function listLeads(', 'function applyLeadClientFilters('],
  ['export async function listConversations(', 'export async function recordConversation('],
  ['export async function listCommunications(', 'export async function recordCommunication('],
  ['export async function listNotes(', 'export async function addStaffNote('],
  ['export async function getGlobalActivityTimeline(', '// ------------------------------------------------------------------------------\n// CUSTOMER DIRECTORY'],
  ['export async function listCrmTags():', 'export async function createCrmTag('],
]) {
  const fn = section(crm, start, end);
  assert.match(fn, /useLocalCrmData\(/, `${start} must distinguish development fallback from production`);
  assert.doesNotMatch(fn, /catch\s*\{\s*\/\/ ignore/, `${start} must not hide a production read failure`);
}
for (const table of ['crm_conversations', 'crm_communications', 'crm_notes', 'crm_activities']) {
  assert.ok(crm.includes(`.from('${table}')`), `CRM service is missing database wiring for ${table}`);
}
assert.match(section(crm, 'export async function recordCommunication(', 'export async function listNotes('), /staff_id: newComm\.staffId/, 'Communication records must persist the real staff UUID');
assert.match(section(crm, 'export async function addStaffNote(', '// ------------------------------------------------------------------------------\n// UNIFIED TIMELINE'), /staff_id: newNote\.staffId/, 'Staff notes must persist the real staff UUID');
assert.match(section(crm, 'export async function getCustomerProfile(', 'export async function createCustomer('), /from\('payment_transactions'\)[\s\S]*?from\('refund_records'\)[\s\S]*?from\('reviews'\)/, 'Customer profiles must read payment, refund and review records from Supabase');
assert.match(section(crm, 'export async function getCustomerProfile(', 'export async function createCustomer('), /found\.payments\s*=|found\.reviews\s*=/, 'Customer profiles must populate payment and review panels');
assert.match(section(crm, 'export async function getCrmDashboardMetrics()', ''), /payment_transactions[\s\S]*?refund_records/, 'CRM outstanding balances must use the finance ledger, not booking status snapshots');

const customers = read('src/services/customerService.ts');
const customerList = section(customers, 'export async function listUnifiedCustomers()', '/**\n * Updates a customer\'s role');
assert.match(customerList, /if \(profilesRes\.error\) throw/, 'Customer directory must surface profile query errors');
assert.match(customerList, /if \(customersRes\.error\) throw/, 'Customer directory must surface customer query errors');
assert.doesNotMatch(customerList, /catch\s*\(err\)\s*\{\s*console\.warn/, 'Customer directory must not return partial local data after production DB failures');

console.log('Admin data wiring regression checks passed: production fallbacks, staff IDs, CRM persistence, customer financial/review records and dashboard ledger calculations.');
