import fs from 'node:fs';
import path from 'node:path';

const server = fs.readFileSync(path.resolve('server.ts'), 'utf8');
const migration = fs.readFileSync(path.resolve('supabase/migrations/20261114150000_whatsapp_consent_foundation.sql'), 'utf8');
const client = fs.readFileSync(path.resolve('src/services/communicationService.ts'), 'utf8');

const routeStart = server.indexOf("app.post('/api/communications/whatsapp'");
const routeEnd = server.indexOf('// 3. System Configuration Endpoint', routeStart);
const route = routeStart >= 0 && routeEnd > routeStart ? server.slice(routeStart, routeEnd) : '';

const checks: Array<[string, boolean]> = [
  ['WhatsApp endpoint validates a linked customer UUID', route.includes('test(customerId)') && route.includes('customerId')],
  ['WhatsApp endpoint checks append-only consent evidence', route.includes("from('customer_communication_consent_events')")],
  ['Consent is scoped to WhatsApp transactional purpose and exact phone', route.includes(".eq('channel', 'WhatsApp')") && route.includes(".eq('purpose', 'transactional')") && route.includes(".eq('phone_e164', phone)")],
  ['Missing or revoked consent is rejected before provider dispatch', route.includes("consent.consent_action !== 'granted'") && route.includes("status(403)") && route.indexOf("status(403)") < route.indexOf('https://graph.facebook.com')],
  ['Outbound WhatsApp uses an approved Meta template payload', route.includes("type: 'template'") && route.includes('name: templateName') && route.includes('bodyParameter')],
  ['Approved template name is required in server configuration', route.includes('WHATSAPP_TEMPLATE_NAME')],
  ['Client requires a linked customer record before WhatsApp dispatch', client.includes('requires a linked customer record')],
  ['Consent history has append-only mutation protection and audit capture', migration.includes('BEFORE UPDATE OR DELETE') && migration.includes('prevent_customer_communication_consent_event_mutation') && migration.includes('trg_capture_business_audit')],
  ['Consent table denies browser roles and grants server role only', migration.includes('REVOKE ALL ON TABLE public.customer_communication_consent_events FROM PUBLIC, anon, authenticated') && migration.includes('GRANT SELECT, INSERT ON TABLE public.customer_communication_consent_events TO service_role')],
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log((passed ? '✓ PASS: ' : '✗ FAIL: ') + label);
  if (!passed) failed++;
}
console.log('WhatsApp compliance boundary: ' + (checks.length - failed) + '/' + checks.length + ' passed.');
if (failed) process.exit(1);
