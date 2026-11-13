# Kemet Spirit — Administrator account lifecycle

The Users & Roles screen provides account invitations, suspension/reactivation, password-reset requests, and a read-only Supabase Auth directory.

## Security

- Privileged Auth Admin endpoints require a verified Super Admin session with AAL2 multi-factor authentication.
- The server-only Supabase secret/service-role key is required and must never use a `VITE_` environment variable or be exposed to the browser.
- The Auth directory returns only account ID, email, display name, creation time, last sign-in time, email-confirmation state, and suspension state.
- The directory is read-only. Permanent deletion is intentionally excluded because deleting an Auth identity can affect profile foreign keys, bookings, financial records, audit history, and Storage ownership. A retention-aware deletion workflow requires separate design and review.
- Invitation, suspension/reactivation, and password-reset operations use the existing Super Admin + AAL2-protected routes and audit logging.

## Production configuration

Configure these server-side values in Hostinger:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (publishable key for caller-scoped operations)
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` (server-only secret)

Restart the Node.js application after changing environment variables. Supabase Auth email delivery must also be configured for invitations and password-reset messages.

## Verification

1. Confirm the server-only Supabase secret is configured in Hostinger.
2. Confirm the Super Admin account has completed MFA/AAL2.
3. Open **Admin → Security & Access → Users, Roles & Permissions**.
4. Verify the Auth directory lists account status without exposing secret credentials.
5. Verify a non-Super Admin or session below AAL2 receives HTTP 403.
6. Verify an unconfigured server secret fails closed with HTTP 503.
7. Test invitation, suspension/reactivation, and reset using a disposable test account only.

Loading the directory is read-only and does not modify production accounts.
