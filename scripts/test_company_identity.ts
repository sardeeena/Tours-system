import * as fs from 'fs';
import * as path from 'path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`Company identity verification failed: ${message}`);
  console.log(`PASS: ${message}`);
};

const appConfig = read('src/config/appConfig.ts');
const settings = read('src/services/siteSettingsService.ts');
const finance = read('src/services/financeService.ts');
const adminSettings = read('src/components/admin/AdminSettings.tsx');
const invoiceUi = read('src/components/admin/finance/FinanceInvoices.tsx');
const catalogueSeed = read('supabase/seed/awesome_adventure_tours_catalogue.sql');
const correctionSeed = read('supabase/seed/awesome_adventure_tours_catalogue_live_corrections.sql');

assert(appConfig.includes("COMPANY_NAME: 'Awesome Adventure Tours'"), 'application brand is Awesome Adventure Tours');
assert(settings.includes('companyName: APP_CONFIG.COMPANY_NAME'), 'company settings default to the central application brand');
assert(finance.includes('getCompanyBillingDetails()'), 'invoice creation loads current company billing settings');
assert(finance.includes('name: settings.companyName?.trim() || APP_CONFIG.COMPANY_NAME'), 'invoice issuer name comes from the authoritative company setting');
assert(finance.includes("website: 'https://awesomeadventure.tours'"), 'invoice fallback website uses the production domain');
assert(adminSettings.includes('Legal Billing Entity Name') && adminSettings.includes('Tax Registration Number'), 'admins can configure legal invoice details');
assert(invoiceUi.includes('selectedInvoice.companyDetails.name'), 'invoice issuer footer uses the invoice company identity');
assert(!catalogueSeed.includes('kemetspirit.com') && !catalogueSeed.includes('Kemet Spirit'), 'catalogue seed contains no former brand or domain');
assert(!correctionSeed.includes('Kemet Spirit'), 'catalogue correction seed contains no former brand');

console.log('All company identity checks passed.');
