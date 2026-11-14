import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261114160000_whatsapp_delivery_status_webhooks.sql'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src/components/admin/communications/CommunicationsWhatsApp.tsx'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/services/communicationService.ts'), 'utf8');

const checks: Array<[string, boolean]> = [
  ['WhatsApp route captures raw bytes before JSON parsing', server.indexOf("app.use('/api/webhooks/whatsapp', express.raw") < server.indexOf('app.use(express.json(')],
  ['GET verification requires configured token and subscribe mode', server.includes("req.query['hub.mode']") && server.includes('WHATSAPP_WEBHOOK_VERIFY_TOKEN') && server.includes("mode !== 'subscribe'")],
  ['GET challenge is returned as plain text', server.includes("type('text/plain').send(challenge)")],
  ['POST validates HMAC-SHA256 over the raw body', server.includes("req.header('x-hub-signature-256')") && server.includes("createHmac('sha256', appSecret).update(req.body)") && server.includes('timingSafeEqual(expected, supplied)')],
  ['Webhook fails closed without app secret or service-role storage', server.includes('WHATSAPP_APP_SECRET') && server.includes("SUPABASE_KEY_TYPE !== 'service_role'")],
  ['Only supported delivery states are accepted', server.includes("['sent', 'delivered', 'read', 'failed'].includes(status)")],
  ['Status is persisted through the restricted atomic RPC', server.includes("rpc('record_whatsapp_provider_status'")],
  ['Inbound messages and raw payloads are not ingested', server.includes('inbound customer messages are not ingested') && !migration.includes('raw_payload jsonb')],
  ['Event key is unique and RLS is enabled', migration.includes('event_key text PRIMARY KEY') && migration.includes('ENABLE ROW LEVEL SECURITY')],
  ['RPC is restricted to service_role', migration.includes('REVOKE ALL ON FUNCTION public.record_whatsapp_provider_status') && migration.includes('TO service_role')],
  ['Duplicate and out-of-order events are handled', migration.includes('ON CONFLICT (event_key) DO NOTHING') && migration.includes('p_event_at > message.provider_status_at')],
  ['Early callbacks are reconciled after the provider ID is stored', migration.includes('reconcile_whatsapp_status_after_message_write') && migration.includes('AFTER INSERT OR UPDATE OF provider_message_id')],
  ['Admin UI exposes the Read delivery state', ui.includes("'Read'") && ui.includes("msg.status === 'Read'")],
  ['Communication history reads and stores read timestamps', service.includes('readAt: d.read_at') && service.includes('read_at: msg.readAt')],
];
let failed = 0;
for (const [name, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' ' + name);
  if (!passed) failed++;
}
assert.equal(failed, 0, failed + ' WhatsApp delivery webhook checks failed.');
console.log('All WhatsApp delivery webhook checks passed.');
