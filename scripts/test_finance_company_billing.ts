import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const settingsService = read('src/services/siteSettingsService.ts');
const settingsUi = read('src/components/admin/AdminSettings.tsx');
const financeService = read('src/services/financeService.ts');
const financeUi = read('src/components/admin/finance/FinanceInvoices.tsx');

for (const field of [
  'legalEntityName',
  'registeredAddress',
  'registeredCity',
  'registeredCountry',
  'taxRegistrationNumber',
  'commercialRegistryNumber',
  'bankName',
  'iban',
  'swiftBic',
]) {
  assert.match(settingsService, new RegExp(field), `Company settings must persist ${field}`);
  assert.match(settingsUi, new RegExp(field), `Admin settings must expose ${field}`);
}

assert.match(settingsService, /\.\.\.DEFAULT_COMPANY_SETTINGS, \.\.\.settings/, 'Older company settings must safely merge newly added optional fields');
assert.match(financeService, /getCompanySettings/, 'Finance must read the authoritative company settings');
assert.match(financeService, /export async function getCompanyBillingDetails/, 'Finance must map legal company settings into invoice details');
assert.match(financeService, /settings\.registeredAddress\.trim\(\)/, 'Invoices must use the registered address, not the pier dispatch address');
assert.match(financeService, /settings\.registeredCountry\.trim\(\)/, 'Invoices must use the registered country');
assert.match(financeService, /function getMissingCompanyBillingFields/, 'Invoice issue readiness must validate legal billing fields');
assert.match(financeService, /status: 'draft'/, 'Invoice creation must always create a reviewable draft');
assert.match(financeService, /export async function issueInvoice/, 'Authorized staff must be able to issue a reviewed draft');
assert.match(financeService, /\.eq\('status', 'draft'\)/, 'Issuing must be conditional on the invoice still being a draft');
assert.match(financeService, /company_details: companyDetails/, 'Issuing must persist the verified company details snapshot');

assert.match(financeUi, /hasPermission\('finance\.update'\)/, 'Invoice issue controls must be permission-gated');
assert.match(financeUi, /issueInvoice\(selectedInvoice\.id\)/, 'Invoice preview must call the issue workflow');
assert.match(financeUi, /Open Company Settings/, 'Draft invoices must provide a route to complete legal billing details');
assert.match(financeUi, /Draft Created/, 'Draft dates must not be presented as issue dates');

assert.match(settingsUi, /Cancellation, refund and rescheduling terms depend on the selected excursion/, 'Unverified cancellation promises must not be prefilled');
assert.doesNotMatch(settingsUi, /Registered Tour Operator License #8421/, 'Unverified licence claims must not be prefilled');
assert.doesNotMatch(settingsUi, /PADI Certified Dive Centers/, 'Unverified certification claims must not be prefilled');
assert.doesNotMatch(settingsUi, /Free 100% cancellation up to 24 hours/, 'Unverified cancellation guarantees must not be prefilled');
assert.match(settingsUi, /badges: \[\]/, 'Unverified certification badges must default to empty');

console.log('Finance company billing settings and explicit invoice issuance checks passed.');
