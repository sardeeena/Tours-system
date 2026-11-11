# Scripts inventory

This directory contains TypeScript verification/test entry points and controlled utility scripts. They remain in this directory because `package.json` and GitHub Actions call these exact paths; moving them without updating every script reference and relative import can silently break CI.

## Test and verification groups

| Group | Entry points |
|---|---|
| Catalogue and data | `test_catalogue_import.ts`, `import_catalogue_to_supabase.ts`, `test_dynamic_experiences_destinations.ts` |
| Database/schema | `verify_schema_parity.ts`, `test_migration_runner.ts`, `test_migration_failure_investigation_and_fix.ts`, `test_preview_migration_failure_and_fix.ts` |
| Authentication and security | `test_admin_security.ts`, `test_abuse_prevention.ts`, `test_password_recovery.ts`, `test_supabase_project_guard.ts`, `scan_secrets.ts` |
| Booking and customer flows | `test_booking_identifier_resolution.ts`, `test_booking_addons_and_destinations_remediation.ts` |
| Communication | `test_communication_validation.ts` |
| Routes and platform | `test_routes.ts`, `test_platform_integration.ts` |
| Admin, operations and finance | `test_admin_dashboard_persistence.ts`, `test_phase7_admin_operations.ts`, `test_phase8_financial_and_workflow_validation.ts` |
| Phase/audit verification | `test_phase1_to_phase7_controlled_enhancement.ts`, `test_phase6_2_dynamic_audit.ts`, `test_phase6_3_staging_verification.ts`, `test_security_and_booking_reliability_remediation.ts`, `test_security_booking_reliability_remediation.ts` |
| Utility/setup | `generate-icons.cjs`, `setup-admin.ts` |

## Running tests

Use the package scripts from the repository root:

```bash
npm run lint
npm run build
npm run test:all
```

Individual commands are documented in the root [README](../README.md) and defined in [package.json](../package.json).

## Safety

- Read each script before running it against production.
- Prefer isolated/local Supabase for migration replay and database tests.
- Do not pass production credentials on the command line or commit them.
- Scripts that import or mutate catalogue/admin data must be treated as controlled operations; use their dry-run/confirmation options where provided.
- Never assume a test script is harmless merely because its filename begins with `test_`.
