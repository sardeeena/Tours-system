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

const adminTourById = section(tours, 'export async function adminGetTourById(', 'export async function adminCreateTour(');
assert.match(adminTourById, /if \(import\.meta\.env\.PROD\) throw/, 'Admin tour editor must not silently use local tour data in production');
assert.match(adminTourById, /if \(error\)[\s\S]*?throw new Error/, 'Tour detail query failures must be surfaced');
assert.match(adminTourById, /if \(!data\) return null/, 'A real missing tour must remain a not-found result');

const createTour = section(tours, 'export async function adminCreateTour(', 'export async function adminUpdateTour(');
assert.match(createTour, /if \(import\.meta\.env\.PROD\) throw/, 'Tour creation must fail closed in production');
assert.match(createTour, /rolled back because related content could not be saved/, 'Incomplete tour creation must attempt a parent rollback');

const updateTour = section(tours, 'export async function adminUpdateTour(', 'export async function adminSetTourStatus(');
assert.match(updateTour, /if \(import\.meta\.env\.PROD\) throw/, 'Tour updates must fail closed in production');

const statusTour = section(tours, 'export async function adminSetTourStatus(', 'export async function adminCheckTourBookingsCount(');
assert.match(statusTour, /\.select\('id'\)[\s\S]*?\.maybeSingle\(\)/, 'Tour status changes must confirm an affected database row');
assert.match(statusTour, /if \(!data\) throw/, 'A zero-row status update must not report success');

const bookingCount = section(tours, 'export async function adminCheckTourBookingsCount(', 'export async function adminDeleteTour(');
assert.match(bookingCount, /if \(import\.meta\.env\.PROD\) throw/, 'Tour deletion must be blocked if booking history cannot be checked');
assert.match(bookingCount, /if \(error\)[\s\S]*?throw new Error/, 'Booking count errors must not be converted into zero');

const deleteTour = section(tours, 'export async function adminDeleteTour(', 'export async function getPublishedDestinations(');
assert.match(deleteTour, /adminCheckTourBookingsCount\(id\)/, 'Tour deletion must verify linked booking count first');
assert.match(deleteTour, /\.delete\(\)[\s\S]*?\.select\('id'\)/, 'Tour deletion must confirm a database row was deleted');

const relationSync = section(tours, 'async function syncTourRelations(', 'export async function adminCreateTour(');
assert.match(relationSync, /ensureTourWrite\(/, 'Tour relation writes must check Supabase errors');
assert.doesNotMatch(relationSync, /await supabase\.from\([^\n]+\)\.(?:delete|insert|upsert)\(/, 'Tour relation writes must not ignore Supabase result errors');

const extraPriceRead = section(tours, 'export async function fetchTourCustomExtraPricesFromDb(', '/**\n * Persists a tour-specific custom price override');
assert.match(extraPriceRead, /if \(error\) throw/, 'Custom add-on price reads must surface database errors');
assert.match(extraPriceRead, /import\.meta\.env\.PROD[\s\S]*?throw/, 'Production custom add-on pricing must not fall back to local cache');

const extraPriceWrite = section(tours, 'export async function persistTourCustomExtraPriceToDb(', '/**\n * Fetches active tour extras');
assert.match(extraPriceWrite, /if \(error\) throw error/, 'Custom add-on price writes must check Supabase errors');
assert.ok(extraPriceWrite.indexOf('await supabase') < extraPriceWrite.lastIndexOf('saveTourCustomExtraPrices'), 'Custom add-on cache must update only after persistence succeeds');

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

const operationsService = read('src/services/operationsService.ts');
const manifestRead = section(operationsService, 'export async function getPassengerManifest(', 'export async function updateManifestPassenger(');
assert.match(manifestRead, /from\('booking_passengers'\)[\s\S]*?passenger_index/, 'Passenger manifests must read persisted passenger records');
assert.match(manifestRead, /bookingIds\.length !== targetBookings\.length/, 'Manifest rows must not be matched with non-database booking references');
assert.match(manifestRead, /passengerIndex,/, 'Every manifest row must carry a stable passenger index');

const manifestWrite = section(operationsService, 'export async function updateManifestPassenger(', '// ==============================================================================\n// 4. PICKUP MANAGEMENT');
assert.match(manifestWrite, /booking_id: bookingId[\s\S]*?passenger_index: passengerIndex/, 'Passenger edits must be keyed by booking and stable passenger position');
assert.match(manifestWrite, /onConflict: 'booking_id,passenger_index'/, 'Passenger edits must upsert on the unique booking/index pair');
assert.match(manifestWrite, /if \(error\) throw new Error/, 'Passenger update failures must not be swallowed');
assert.match(manifestWrite, /if \(!data\?\.id\) throw/, 'Passenger edits must confirm a persisted database row');

const manifestUi = read('src/components/admin/operations/OperationsManifests.tsx');
assert.doesNotMatch(manifestUi, /ALL_TOURS/, 'Manifest filters must not fall back to seeded demo tours');
assert.doesNotMatch(manifestUi, /getPublishedTours\(\)\.catch\(\(\) => \[\]\)/, 'Manifest tour-load errors must not be hidden');
assert.match(manifestUi, /loadError/, 'Manifest load failures must be displayed distinctly from an empty manifest');
assert.match(manifestUi, /passengerIndex: editingPassenger\.passengerIndex/, 'Manifest edits must send the passenger index');

const manifestType = read('src/types/operations.ts');
assert.match(section(manifestType, 'export interface PassengerManifestItem', 'export interface AvailabilitySlot'), /passengerIndex: number/, 'Manifest rows must expose a stable passenger index');

const guideDelete = section(operations, 'export async function deleteGuide(', 'export async function listAvailabilitySlots(');
assert.match(guideDelete, /\.delete\(\)[\s\S]*?\.select\('id'\)[\s\S]*?\.maybeSingle\(\)/, 'Guide deletion must confirm a real database row');
assert.match(guideDelete, /if \(!data\?\.id\) throw/, 'Guide deletion must not report success for a missing or inaccessible row');
assert.ok(guideDelete.indexOf('await supabase') < guideDelete.indexOf('setLocal'), 'Guide cache must update only after database deletion succeeds');

const vessels = section(operations, 'export async function listVessels()', 'export async function saveVessel(');
assert.match(vessels, /if \(!import\.meta\.env\.DEV\) throw/, 'Production vessel lists must not appear empty when Supabase is unavailable');
const weatherList = section(operations, 'export async function listWeatherBulletins()', 'export async function getLatestWeatherBulletin(');
assert.match(weatherList, /if \(!import\.meta\.env\.DEV\) throw/, 'Production operator weather bulletins must not silently appear empty');

const pickupUpdate = section(operations, 'export async function updatePickupScheduleStatus(', '// ==============================================================================\n// 5. VESSELS FLEET MANAGEMENT');
assert.match(pickupUpdate, /scheduleReadError/, 'Pickup updates must inspect the current schedule before mutation');
assert.match(pickupUpdate, /A real pickup time, driver, vehicle, customer and pickup location are required/, 'New pickup schedules must validate required operational details before changing booking status');
assert.match(pickupUpdate, /rollbackError/, 'Pickup schedule failures must attempt to restore the booking status');
assert.match(pickupUpdate, /\.select\('id'\)[\s\S]*?\.maybeSingle\(\)/, 'Pickup updates must confirm affected booking and schedule rows');

const conflictCheck = section(operations, 'export async function detectAssignmentConflicts(', '/**\n * Save operational assignment');
for (const resource of ['vessel', 'guide', 'captain', 'driver']) {
  assert.match(conflictCheck, new RegExp(`if \\(!${resource}\\) throw new Error`), `Missing ${resource} records must block resource assignment`);
}
assert.match(conflictCheck, /guide_unavailable/, 'Unavailable guides must block assignment');
assert.match(conflictCheck, /captain_unavailable/, 'Unavailable captains must block assignment');
assert.match(conflictCheck, /driver_unavailable/, 'Unavailable drivers must block assignment');

const assignmentsUi = read('src/components/admin/operations/OperationsAssignments.tsx');
assert.match(assignmentsUi, /conflictCheckError/, 'Assignment UI must display conflict verification failures');
assert.match(assignmentsUi, /if \(validatingConflicts \|\| conflictCheckError \|\| preSaveConflicts\.length > 0\)/, 'Assignment submit handler must fail closed until conflict checks pass');
assert.match(assignmentsUi, /disabled=\{validatingConflicts \|\| Boolean\(conflictCheckError\) \|\| preSaveConflicts\.length > 0\}/, 'Assignment button must be disabled for conflicts or failed verification');

const loadErrorComponent = read('src/components/admin/AdminLoadError.tsx');
assert.match(loadErrorComponent, /role="alert"/, 'Shared admin load error must be announced accessibly');
assert.match(loadErrorComponent, /onRetry/, 'Shared admin load error must provide a working retry action');
for (const path of [
  'src/components/admin/operations/OperationsVessels.tsx',
  'src/components/admin/operations/OperationsWeather.tsx',
  'src/components/admin/operations/OperationsAvailability.tsx',
  'src/components/admin/operations/OperationsPickupSchedule.tsx',
  'src/components/admin/operations/OperationsAssignments.tsx',
  'src/components/admin/operations/OperationsDepartures.tsx',
]) {
  const component = read(path);
  assert.match(component, /AdminLoadError/, `${path} must show a visible error instead of an empty table on query failure`);
  assert.match(component, /loadError/, `${path} must keep the live-data error state`);
}

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
assert.match(section(crm, 'export async function recordConversation(', '// ------------------------------------------------------------------------------\n// COMMUNICATIONS & NOTES'), /staff_id: newRecord\\.staffId/, 'Conversation records must persist the signed-in staff UUID');
assert.match(section(crm, 'export async function createLead(', 'export async function updateLead('), /estimatedValue: input\.estimatedValue !== undefined \? input\.estimatedValue : 0/, 'New leads must not receive invented estimated revenue');
assert.match(section(crm, 'export async function createLead(', 'export async function updateLead('), /assignedStaffId: input\.assignedStaffId \|\| null/, 'Lead assignments must use a real staff UUID or remain unassigned');
assert.match(read('src/components/admin/crm/CrmConversationsManager.tsx'), /useAuth\(\)[\s\S]*?staffId: user\?\.id/, 'Conversation attribution must use the active authenticated user');
assert.match(read('src/components/admin/crm/CrmCustomersManager.tsx'), /useAuth\(\)[\s\S]*?staffId: user\?\.id/, 'Customer actions must use the active authenticated user');
assert.match(read('src/components/admin/crm/CrmLeadsManager.tsx'), /summarizeStageValues[\s\S]*?currency/, 'Lead pipeline summaries must respect currency boundaries');

assert.match(section(crm, 'export async function recordCommunication(', 'export async function listNotes('), /staff_id: newComm\.staffId/, 'Communication records must persist the real staff UUID');
assert.match(section(crm, 'export async function addStaffNote(', '// ------------------------------------------------------------------------------\n// UNIFIED TIMELINE'), /staff_id: newNote\.staffId/, 'Staff notes must persist the real staff UUID');
assert.match(section(crm, 'export async function getCustomerProfile(', 'export async function createCustomer('), /from\('payment_transactions'\)[\s\S]*?from\('refund_records'\)[\s\S]*?from\('reviews'\)/, 'Customer profiles must read payment, refund and review records from Supabase');
assert.match(section(crm, 'export async function getCustomerProfile(', 'export async function createCustomer('), /found\.payments\s*=|found\.reviews\s*=/, 'Customer profiles must populate payment and review panels');
assert.match(section(crm, 'export async function getCrmDashboardMetrics()', ''), /payment_transactions[\s\S]*?refund_records/, 'CRM outstanding balances must use the finance ledger, not booking status snapshots');

const bookingRepo = read('src/services/bookingRepository.ts');
const getBooking = section(bookingRepo, '  async getBooking(', '  async findBooking(');
assert.match(getBooking, /if \(error\) throw new Error/, 'Booking detail query errors must not be returned as not-found');
assert.match(getBooking, /if \(!isDevelopmentBuild\)[\s\S]*?throw new Error/, 'Production booking lookup must not silently use browser cache');
const findBooking = section(bookingRepo, '  async findBooking(', '  async getBookingsByEmail(');
assert.match(findBooking, /if \(error\) throw new Error/, 'Authenticated booking lookup query errors must be surfaced');
assert.match(findBooking, /throw err instanceof Error/, 'Booking lookup exceptions must not be converted into null');
const bookingsByEmail = section(bookingRepo, '  async getBookingsByEmail(', '  async updateBooking(');
assert.match(bookingsByEmail, /if \(profileError\) throw/, 'Booking directory must surface profile authorization query failures');
assert.match(bookingsByEmail, /if \(userQueryError\) throw/, 'Booking directory must surface fallback query failures');
assert.match(bookingsByEmail, /if \(!isDevelopmentBuild\) throw/, 'Production customer booking lookup must not use browser cache');

const newsletter = read('src/services/newsletterService.ts');
const updateSubscriber = section(newsletter, 'export async function updateSubscriberStatus(', 'export async function deleteSubscriber(');
assert.match(updateSubscriber, /\.select\('id'\)[\s\S]*?\.maybeSingle\(\)/, 'Newsletter status updates must confirm an affected subscriber row');
assert.match(updateSubscriber, /if \(!result\.data\?\.id\) throw/, 'Newsletter status updates must not report success for a missing subscriber');
const deleteSubscriber = section(newsletter, 'export async function deleteSubscriber(', '');
assert.match(deleteSubscriber, /\.select\('id'\)[\s\S]*?\.maybeSingle\(\)/, 'Newsletter deletion must confirm an affected subscriber row');
assert.match(deleteSubscriber, /if \(!result\.data\?\.id\) throw/, 'Newsletter deletion must not report success for a missing subscriber');

const inquiryService = read('src/services/inquiryService.ts');
const createInquiry = section(inquiryService, 'export async function createCustomerInquiry(', '/**\n * Lists all inquiries');
assert.match(createInquiry, /\.from\('inquiries'\)[\s\S]*?\.insert\(/, 'Public inquiry submissions must persist to the inquiries table');
assert.match(createInquiry, /if \(error\)[\s\S]*?success: false/, 'Inquiry database failures must be reported as failures, not local success');
assert.doesNotMatch(createInquiry, /estimatedValue:\s*120|createLead\(/, 'Inquiry submissions must not create fake-value CRM leads from the public client');
assert.ok(createInquiry.indexOf(".insert({") < createInquiry.indexOf('saveStoredInquiries([persistedInquiry'), 'Inquiry browser cache must update only after the database insert succeeds');

const inquiryList = section(inquiryService, 'export async function listInquiries(', '/**\n * Updates inquiry status');
assert.match(inquiryList, /if \(!import\.meta\.env\.DEV\)\s*\{[\s\S]*?throw new Error/, 'Production inquiry listing must not fall back to browser cache');
assert.match(inquiryList, /if \(error\)[\s\S]*?throw new Error/, 'Inquiry read failures must be surfaced');

const inquiryDelete = section(inquiryService, 'export async function deleteInquiry(', '');
assert.match(inquiryDelete, /\.delete\(\)[\s\S]*?\.select\('id'\)[\s\S]*?\.maybeSingle\(\)/, 'Inquiry deletion must confirm the database row was deleted');
assert.ok(inquiryDelete.indexOf('await supabase') < inquiryDelete.lastIndexOf('saveStoredInquiries'), 'Inquiry cache must update only after the database deletion succeeds');
assert.match(inquiryDelete, /current\.status === 'converted'[\s\S]*?throw new Error/, 'Converted inquiry source records must be retained for CRM audit history');

const inquiryConvert = section(inquiryService, 'export async function convertInquiryToLead(', '/**\n * Deletes an inquiry');
assert.match(inquiryConvert, /rpc\('convert_inquiry_to_lead'/, 'Inquiry-to-lead conversion must use the atomic permission-checked RPC');
assert.match(inquiryConvert, /if \(error\) throw new Error/, 'Conversion RPC failures must be surfaced');

const inquiryUi = read('src/components/admin/AdminInquiriesList.tsx');
assert.match(inquiryUi, /hasPermission\('crm\.manage'\)[\s\S]*?Convert to CRM Lead/, 'Lead conversion must be restricted to CRM managers');
assert.match(inquiryUi, /'converted'/, 'Converted inquiries must remain filterable and visible');

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
assert.ok(saveSetting.indexOf('.upsert(') < saveSetting.lastIndexOf('localStorage.setItem'), 'Settings must be cached only after the database write succeeds');

const storage = read('src/services/storageService.ts');
const uploadMedia = section(storage, 'export async function uploadTourMedia(', '/**\n * Removes an image or video');
assert.match(uploadMedia, /from\('media_assets'\)[\s\S]*?\.select\('id,created_at'\)/, 'Media uploads must create an authoritative metadata record');
assert.match(uploadMedia, /rollbackError|uploaded object was rolled back/, 'Media uploads must roll back storage objects if metadata persistence fails');
const listMedia = section(storage, 'export async function listStorageMedia(', '/**\n * Audits Supabase Storage bucket');
assert.match(listMedia, /if \(dbError\) throw/, 'Media listing must surface database failures');
assert.match(listMedia, /if \(storageError\) throw/, 'Media listing must surface storage failures');
assert.match(listMedia, /if \(!import\.meta\.env\.DEV\) throw new Error[\s\S]*?return getLocalAssets\(\)/, 'Local media fallback must be limited to development');
const cleanMedia = section(storage, 'export async function cleanOrphanedStorageFiles(', '/**\n * Generates an optimized image URL');
assert.match(cleanMedia, /from\('user_roles'\)[\s\S]*?access_roles\(slug\)/, 'Storage cleanup must use the current RBAC role assignments');

console.log('Admin data wiring regression checks passed: production fallbacks, staff IDs, CRM persistence, customer financial/review records and dashboard ledger calculations.');
