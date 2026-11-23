import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generatePrivateUiCatalog, collectPrivateUiMessages } from './generate_private_ui_catalog';
import { privateUiMessageKey } from '../src/i18n/privateUiCatalog';
import { privateUiTranslationPlugin } from '../src/i18n/privateUiVitePlugin';
import path from 'node:path';

const count = generatePrivateUiCatalog();
const generated = readFileSync(new URL('../src/i18n/privateUiCatalog.generated.ts', import.meta.url), 'utf8');
const messages = collectPrivateUiMessages();

assert.ok(count > 100, 'The private customer workflow catalogue must cover more than a token handful of UI messages.');
assert.equal(messages[privateUiMessageKey('pwa.iosStep1End')], undefined, 'Internal t() lookup keys are never extracted as visible customer UI messages.');
assert.ok(messages[privateUiMessageKey('button in your Safari browser navigation bar.')], 'The visible English fallback passed to t() is extracted.');
for (const required of [
  'Sign In Required',
  'Welcome back',
  'Create your account',
  'Confirm & Save New Password',
  'Your account',
  'No Reservations Found',
  'Tour assistant',
  'Ticket queue',
  'Print Voucher (PDF)',
  'Confirming your booking...',
]) {
  assert.ok(Object.values(messages).some((value) => value.includes(required)), `Private UI catalogue includes: ${required}`);
}
assert.match(generated, /PRIVATE_UI_SOURCE_CATALOG/);
const plugin = privateUiTranslationPlugin();
const transform = plugin.transform as (code: string, id: string) => { code: string } | null;
const fixture = `import { useLanguage } from '../contexts/LanguageContext';\nconst statusLabels = { open: 'Open' };\nexport const SamplePage = () => { return <button aria-label="Continue securely">Book now {statusLabels.open}</button>; };`;
const transformed = transform(fixture, path.resolve('src/pages/BookingPage.tsx'));
assert.ok(transformed?.code.includes('LocalizedText'), 'Static JSX text is routed through the reviewed translation catalogue.');
assert.ok(transformed?.code.includes('LocalizedValue'), 'Dynamic JSX string values are translated when a reviewed catalogue entry exists.');
assert.ok(transformed?.code.includes('aria-label={<') || transformed?.code.includes('aria-label={__privateUiT'), 'Accessible labels are emitted as valid JSX expressions.');
assert.ok(transformed?.code.includes('__privateUiT'), 'Accessible labels and form attributes use the active translation catalogue.');
assert.equal((transformed?.code.match(/import \{ useLanguage \}/g) || []).length, 1, 'Existing language hooks are not imported twice.');
assert.ok(messages[privateUiMessageKey('Sign In Required')] === 'Sign In Required');
assert.ok(messages[privateUiMessageKey('cancellation_requested')] === 'cancellation_requested', 'Booking status values rendered dynamically are included in the reviewed UI catalogue.');
assert.ok(Object.values(messages).some((value) => value === 'Password'), 'Password labels are included in the private UI catalogue.');
console.log(`Private customer UI localization catalogue checks passed (${count} messages).`);
