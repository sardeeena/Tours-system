import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inquiryService = readFileSync(new URL('../src/services/inquiryService.ts', import.meta.url), 'utf8');
const inquiryManager = readFileSync(new URL('../src/components/admin/crm/CrmInquiriesManager.tsx', import.meta.url), 'utf8');

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Missing boundary after: ${start}`);
  return source.slice(startIndex, endIndex);
}

const updateInquiry = section(
  inquiryService,
  'export async function updateInquiryStatus',
  '/**\n * Deletes an inquiry'
);
assert.ok(updateInquiry.indexOf(".from('inquiries')") < updateInquiry.indexOf('saveStoredInquiries(updated)'));
assert.match(updateInquiry, /\.select\('id'\)[\s\S]*?\.maybeSingle\(\)/);
assert.match(updateInquiry, /if \(error\) throw new Error/);
assert.match(updateInquiry, /if \(!data\) throw new Error/);
assert.match(updateInquiry, /else if \(!import\.meta\.env\.DEV\)/);

const listInquiries = section(
  inquiryService,
  'export async function listInquiries',
  '/**\n * Updates inquiry status'
);
assert.match(listInquiries, /Cached inquiries are not used in production/);

const saveHandler = section(inquiryManager, 'const handleSaveInquiry', 'const handleConvertToLead');
assert.match(saveHandler, /await updateInquiryStatus\(/);
assert.ok(saveHandler.indexOf('await updateInquiryStatus(') < saveHandler.indexOf('setInquiries('));
assert.match(saveHandler, /Choose a valid inquiry status/);
assert.doesNotMatch(saveHandler, /supabase\.from\('inquiries'\)/);

assert.match(inquiryManager, /<option value="contacted">Contacted<\/option>/);
assert.match(inquiryManager, /<option value="resolved">Resolved<\/option>/);
assert.doesNotMatch(inquiryManager, /<option value="in_progress">|<option value="responded">|<option value="archived">/);
assert.match(inquiryManager, /if \(convertingInquiryId \|\| inq\.status === 'converted'\) return/);
assert.match(inquiryManager, /disabled=\{convertingInquiryId === inq\.id\}/);


const convertInquiry = section(
  readFileSync(new URL('../src/services/crmService.ts', import.meta.url), 'utf8'),
  'export async function convertInquiryToLead',
  'export async function convertLeadToCustomer'
);
assert.match(convertInquiry, /\[source-inquiry:\$\{inquiry\.id\}\]/);
assert.match(convertInquiry, /item\.notes\?\.includes\(sourceMarker\)/);
assert.match(convertInquiry, /if \(error\) throw new Error\(formatSupabaseError\(error\)\)/);
assert.match(convertInquiry, /if \(!data\) throw new Error/);
assert.doesNotMatch(convertInquiry, /catch\s*\{/);

assert.match(inquiryManager, /await convertLeadToCustomer\(lead\.id\)/);
assert.doesNotMatch(inquiryManager, /updateCustomerMetadata/);

console.log('CRM inquiry persistence integrity checks passed.');
