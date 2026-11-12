import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { renderBrandedEmailHtml } from '../src/utils/emailTemplate';

const rendered = renderBrandedEmailHtml({
  heading: '<Welcome>',
  preheader: 'Preview text',
  bodyText: 'Hello <script>alert(1)</script>\n\nUnsubscribe: https://awesomeadventure.tours/unsubscribe?token=a&source=email',
});

assert.match(rendered, /https:\/\/awesomeadventure\.tours\/logo\.jpg/);
assert.match(rendered, /alt="Awesome Adventure Tours"/);
assert.match(rendered, /&lt;Welcome&gt;/);
assert.doesNotMatch(rendered, /<script>alert\(1\)<\/script>/);
assert.match(rendered, /href="https:\/\/awesomeadventure\.tours\/unsubscribe\?token=a&amp;source=email"/);

const templates = [
  'confirm-signup.html', 'invite.html', 'magic-link.html', 'recovery.html',
  'email-change.html', 'reauthentication.html', 'password-changed.html',
  'email-changed.html', 'phone-changed.html', 'identity-linked.html',
  'identity-unlinked.html', 'verification-added.html', 'verification-removed.html',
];
for (const template of templates) {
  const path = 'supabase/templates/' + template;
  assert.ok(existsSync(path), 'Auth template exists: ' + template);
  const html = readFileSync(path, 'utf8');
  assert.match(html, /logo\.jpg/, 'Auth template uses the production logo: ' + template);
}
const config = readFileSync('supabase/config.toml', 'utf8');
assert.match(config, /\[auth\.email\.template\.confirmation\]/);
assert.match(config, /\[auth\.email\.notification\.mfa_factor_unenrolled\]/);

console.log('Premium email renderer and all 13 Supabase Auth templates passed.');
