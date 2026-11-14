import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inquiryService = readFileSync(new URL('../src/services/inquiryService.ts', import.meta.url), 'utf8');
const inquiryManager = readFileSync(new URL('../src/components/admin/crm/CrmInquiriesManager.tsx', import.meta.url), 'utf8');
const domainTypes = readFileSync(new URL('../src/types/database.ts', import.meta.url), 'utf8');
const generatedTypes = readFileSync(new URL('../src/types/database.types.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261114180000_crm_inquiry_staff_assignments.sql', import.meta.url), 'utf8');

assert.match(domainTypes, /export interface DbInquiry[\s\S]*?assigned_staff_id: string \| null/);
assert.match(generatedTypes, /inquiries:[\s\S]*?assigned_staff_id: string \| null/);
assert.match(generatedTypes, /inquiries_assigned_staff_id_fkey/);

const assigneeLoader = inquiryService.slice(
  inquiryService.indexOf('export async function listInquiryAssignees'),
  inquiryService.indexOf('/**\n * Updates inquiry status')
);
assert.match(assigneeLoader, /rpc\('list_crm_assignable_staff'\)/);
assert.match(assigneeLoader, /if \(error\) throw new Error/);

const updateInquiry = inquiryService.slice(
  inquiryService.indexOf('export async function updateInquiryStatus'),
  inquiryService.indexOf('/**\n * Deletes an inquiry')
);
assert.match(updateInquiry, /if \(assignedStaffId !== undefined\) updates\.assigned_staff_id = assignedStaffId/);
assert.ok(updateInquiry.indexOf(".from('inquiries')") < updateInquiry.indexOf('saveStoredInquiries(updated)'));
assert.match(updateInquiry, /assigned_staff_id: assignedStaffId/);

assert.doesNotMatch(inquiryManager, /const STAFF_MEMBERS/);
assert.match(inquiryManager, /listInquiryAssignees\(\)/);
assert.match(inquiryManager, /setTempStaffId\(inq\.assigned_staff_id \|\| ''\)/);
assert.match(inquiryManager, /tempStaffId \|\| null/);
assert.match(inquiryManager, /staff\.id === inq\.assigned_staff_id/);
assert.match(inquiryManager, /<option value="">Unassigned<\/option>/);
assert.match(inquiryManager, /staffMembers\.map\(\(staff\)/);

assert.match(migration, /REFERENCES public\.profiles\(id\) ON DELETE SET NULL/);
assert.match(migration, /public\.has_permission\('crm\.read'\)/);
assert.match(migration, /public\.user_roles/);
assert.match(migration, /public\.access_roles/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.list_crm_assignable_staff\(\) FROM PUBLIC, anon/);
assert.doesNotMatch(migration, /p\.role/);

console.log('CRM inquiry staff assignment persistence checks passed.');
