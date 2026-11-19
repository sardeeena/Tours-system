import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const section = (source: string, start: string, end: string) => {
  const a = source.indexOf(start);
  const b = end ? source.indexOf(end, a + start.length) : source.length;
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

const coupons = read('src/services/couponService.ts');
const couponList = section(coupons, 'export async function getCoupons()', 'export async function createCoupon(');
assert.match(couponList, /import\.meta\.env\.PROD[\s\S]*?throw new Error/, 'Coupon admin reads must not return seeded coupons in production');
assert.match(couponList, /if \(error\)[\s\S]*?throw new Error/, 'Coupon query failures must be visible');
assert.match(coupons, /if \(!import\.meta\.env\.DEV\) throw new Error\('Supabase is not configured; coupon changes cannot be saved in production\.'\)/, 'Coupon writes must be database-only in production');

const faqs = read('src/services/faqService.ts');
const faqList = section(faqs, 'export async function getFaqs(', 'export async function createFaq(');
assert.match(faqList, /if \(!import\.meta\.env\.DEV\) throw new Error/, 'FAQ admin reads must not use local seed data in production');
assert.match(faqList, /if \(error\) throw new Error/, 'FAQ query failures must be visible');
assert.match(faqList, /return data \|\| \[\]/, 'An empty FAQ table must be shown as empty, not replaced with sample FAQs');

const settings = read('src/services/siteSettingsService.ts');
const getSetting = section(settings, 'export async function getSetting<T>', 'export async function saveSetting<T>');
const saveSetting = section(settings, 'export async function saveSetting<T>', 'export async function getCompanySettings()');
assert.match(getSetting, /if \(error\) throw new Error/, 'Site setting read failures must not fall back to stale local values');
assert.match(getSetting, /Supabase is not configured; site settings cannot be loaded in production/, 'Production site settings require Supabase');
assert.ok(saveSetting.indexOf('.upsert(') < saveSetting.indexOf('localStorage.setItem'), 'Settings must be cached only after the database write succeeds');

const storage = read('src/services/storageService.ts');
const uploadMedia = section(storage, 'export async function uploadTourMedia(', '/**\n * Removes an image or video');
assert.match(uploadMedia, /from\('media_assets'\)[\s\S]*?\.select\('id,created_at'\)/, 'Media uploads must create an authoritative metadata record');
assert.match(uploadMedia, /rollbackError|uploaded object was rolled back/, 'Media uploads must roll back storage objects if metadata persistence fails');
const listMedia = section(storage, 'export async function listStorageMedia(', '/**\n * Audits Supabase Storage bucket');
assert.match(listMedia, /if \(dbError\) throw/, 'Media listing must surface database failures');
assert.match(listMedia, /if \(storageError\) throw/, 'Media listing must surface storage failures');
assert.doesNotMatch(listMedia, /return getLocalAssets\(\);\s*\}/, 'Production media listing must not mask storage failures with local assets');
const cleanMedia = section(storage, 'export async function cleanOrphanedStorageFiles(', '/**\n * Generates an optimized image URL');
assert.match(cleanMedia, /from\('user_roles'\)[\s\S]*?access_roles\(slug\)/, 'Storage cleanup must use the current RBAC role assignments');

console.log('Admin data wiring regression checks passed: production fallbacks, staff IDs, CRM persistence, customer financial/review records and dashboard ledger calculations.');
