# AwesomeAdventure email system

## Architecture
- Supabase Auth generates authentication and account-security emails and owns all confirmation, recovery, magic-link, invite, and reauthentication tokens.
- Resend SMTP delivers Supabase Auth messages.
- The AwesomeAdventure server generates business/operational email content and sends it through the Resend API.
- The Resend webhook at `/api/webhooks/resend` verifies Svix signatures and records provider delivery events.
- `communication_messages` is the application message ledger; `email_provider_events` is the provider event ledger. Auth SMTP messages appear in communications history only when a verified Resend event is received. User correlation is not assumed.

## Branding
The shared application renderer uses the production logo at `https://awesomeadventure.tours/logo.jpg`, navy header, gold accents, white body, and a mobile-friendly table layout. Supabase Auth templates in `supabase/templates` use the same visual identity.

## Hosted Supabase Auth templates
Supabase's hosted Email Templates UI is the production source of truth. The checked-in HTML files and `supabase/config.toml` entries provide version-controlled templates and local-development configuration. Changing `config.toml` alone does not update the hosted project.
Copy each matching HTML file into Authentication → Emails → Templates. Preserve Supabase Go-template variables such as `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .NewEmail }}`, `{{ .OldEmail }}`, `{{ .Phone }}`, `{{ .OldPhone }}`, `{{ .Provider }}`, and `{{ .FactorType }}`.
The six authentication templates are invite, confirmation, magic link, recovery, email change, and reauthentication. The seven security notification templates are password changed, email changed, phone changed, identity linked, identity unlinked, MFA factor enrolled, and MFA factor unenrolled.
Security notification templates are supplied but configured disabled in local config. Enable each notification individually in hosted Supabase only after reviewing the desired security-notification policy.

## Resend
- Supabase Auth SMTP: `smtp.resend.com`, port 465, username `resend`, password is the Resend API key.
- Keep link tracking disabled for Auth emails so single-use confirmation and recovery URLs are not rewritten.
- Application sender address is configured only in Hostinger environment variables. Never commit credentials.
- Resend webhook endpoint: `https://awesomeadventure.tours/api/webhooks/resend`.
- Subscribe to `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed`, and `email.suppressed`.

## Operational checks
1. Confirm `RESEND_API_KEY` is a valid active sending key.
2. Set `RESEND_FROM_EMAIL` to the bare verified sender mailbox, e.g. `no-reply@mail.awesomeadventure.tours`.
3. Confirm `RESEND_FROM_NAME`, `RESEND_REPLY_TO`, `BOOKING_NOTIFICATION_EMAIL`, and `BOOKING_NOTIFICATION_WORKER_ENABLED=true`.
4. Configure the Resend webhook signing secret in Hostinger.
5. Use an explicitly approved test mailbox for delivery tests; deployment does not send test emails.