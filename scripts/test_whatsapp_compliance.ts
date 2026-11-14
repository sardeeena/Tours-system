import fs from 'node:fs';
import path from 'node:path';

const server = fs.readFileSync(path.resolve('server.ts'), 'utf8');
const migrationPath = 'supabase/migrations/20261114150000_whatsapp_consent_foundation.sql';
const migration = fs.readFileSync(path.resolve(migrationPath), 'utf8');
const client = fs.readFileSync(path.resolve('src/services/communicationService.ts'), 'utf8');

const checks: Array<[string, boolean]> = [
  ['WhatsApp endpoint requires a linked customer UUID', /customerId.*test\\(customerId\\)/s.test(server)],
  ['WhatsApp endpoint checks append-only consent evidence', /customer_communication_consent_events/.test(server)],
  ['Consent is scoped to WhatsApp transactional purpose and exact phone', /\\.eq\\('channel', 'WhatsApp'\\)[\\s\\S]*?\\.eq\\('purpose', 'transactional'\\)[\\s\\S]*?\\.eq\\('phone_e164', phone\\)/.test(server)],
  ['Revoked or missing consent is rejected', /consent\\.consent_action !== 'granted'[\\s\\S]*?status\\(403\\)/.test(server)],
  ['Outbound WhatsApp uses a Meta template rather than free-form text', /type: 'template'[\\s\\S]*?template:[\\s\\S]*?name: templateName/.test(server) && !/type: 'text',[\\s\\S]*?text: \\{ preview_url: false, body: message \\}/.test(server)],
  ['Approved template name is required in server configuration', /WHATSAPP_TEMPLATE_NAME/.test(server)],
  ['Client requires a customer record before WhatsApp dispatch', /requires a linked customer record/.test(client)],
  ['Consent history table is append-only', /BEFORE UPDATE OR DELETE[\\s\\S]*?prevent_customer_communication_consent_event_mutation/.test(migration)],
  ['Consent table denies browser roles and grants server role only', /REVOKE ALL ON TABLE[\\s\\S]*?FROM PUBLIC, anon, authenticated[\\s\\S]*?GRANT SELECT, INSERT[\\s\\S]*?TO service_role/.test(migration)],
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log((passed ? '✓ PASS: ' : '✗ FAIL: ') + label);
  if (!passed) failed++;
}
console.log('WhatsApp compliance boundary: ' + (checks.length - failed) + '/' + checks.length + ' passed.');
if (failed) process.exit(1);
