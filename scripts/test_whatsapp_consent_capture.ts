import fs from 'node:fs';
import path from 'node:path';
const server = fs.readFileSync(path.resolve('server.ts'), 'utf8');
const ui = fs.readFileSync(path.resolve('src/components/admin/communications/CommunicationsWhatsApp.tsx'), 'utf8');
const service = fs.readFileSync(path.resolve('src/services/communicationService.ts'), 'utf8');
const start = server.indexOf("app.get('/api/communications/whatsapp/consent'");
const end = server.indexOf("app.post('/api/communications/whatsapp',", start);
const routes = start >= 0 && end > start ? server.slice(start, end) : '';
const checks: Array<[string, boolean]> = [
 ['Consent endpoints require authorized communications staff', routes.includes('requireCommunicationsStaff(req, res)')],
 ['Consent writes require explicit staff attestation', routes.includes('req.body?.explicitConfirmation !== true')],
 ['Granting permission requires an evidence reference', routes.includes("(action === 'grant' && evidenceReference.length < 4)")],
 ['Customer identity and current database phone are verified', routes.includes("from('customers')") && routes.includes('normalizeConsentPhone(customer.phone) !== phone')],
 ['Consent is appended with actor, purpose, source and version', routes.includes("consent_source: 'staff_verified_record'") && routes.includes('recorded_by: req.user!.id') && routes.includes('consent_text_version:')],
 ['History reads are limited to the selected customer and phone', routes.includes(".eq('customer_id', customerId)") && routes.includes(".eq('phone_e164', phone)")],
 ['Browser service uses the authenticated staff session', service.includes('getCommunicationsAccessToken') && service.includes('Authorization:') && service.includes('recordWhatsAppConsentEvent')],
 ['UI clearly states that consent is never inferred', ui.includes('does not count as WhatsApp permission')],
 ['UI supports transactional and marketing permission separately', ui.includes('value="transactional"') && ui.includes('value="marketing"')],
 ['UI requires confirmation and evidence before granting permission', ui.includes('consentConfirmed') && ui.includes('consentEvidenceReference.trim().length < 4')],
 ['UI supports withdrawal and append-only history', ui.includes("handleRecordConsent('revoke')") && ui.includes('Append-only consent history')],
 ['Phone normalization strips formatting consistently', ui.includes('replace(/\\D/g') && service.includes('replace(/\\D/g')],
];
let failed=0; for(const [label,passed] of checks){console.log((passed?'✓ PASS: ':'✗ FAIL: ')+label);if(!passed)failed++;}
console.log('WhatsApp consent capture boundary: '+(checks.length-failed)+'/'+checks.length+' passed.');
if(failed)process.exit(1);
