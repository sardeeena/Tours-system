import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const crm = readFileSync(new URL('../src/services/crmService.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20261114190000_crm_inquiry_conversion_atomicity.sql', import.meta.url), 'utf8');
const start = crm.indexOf('export async function convertInquiryToLead');
const end = crm.indexOf('export async function convertLeadToCustomer', start);
assert.ok(start >= 0 && end > start, 'Conversion service function exists');
const conversion = crm.slice(start, end);
assert.match(conversion, /rpc\('convert_inquiry_to_lead'/);
assert.doesNotMatch(conversion, /listLeads\(\)|createLead\(/);
assert.match(conversion, /if \(error\) throw new Error/);
assert.match(conversion, /Supabase is not configured/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /FOR UPDATE/);
assert.match(migration, /has_permission\('crm\.manage'\)/);
assert.match(migration, /INSERT INTO public\.crm_activities/);
console.log('Atomic CRM inquiry conversion checks passed.');
