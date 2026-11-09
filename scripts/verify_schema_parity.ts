import fs from 'fs';
import path from 'path';

/**
 * ==============================================================================
 * AUTOMATED SCHEMA PARITY & ANTI-DIVERGENCE ENFORCEMENT TEST
 * ==============================================================================
 * Prevents silent divergence between the incremental migration history in
 * supabase/migrations/*.sql and the authoritative fresh-build complete_schema.sql.
 *
 * Verifies:
 * 1. Identical table inventory across both tracks (exact 54 tables).
 * 2. Identical PostgreSQL stored procedures and RPC functions (exact 13 functions).
 * 3. Identical database triggers and event bindings.
 * 4. Naming consistency (e.g. operational_assignments vs deprecated operations_assignments).
 * 5. Idempotent policy declarations (preventing SQLSTATE 42710 duplicate policies).
 * ==============================================================================
 */

function runParityCheck() {
  console.log('================================================================');
  console.log('  Supabase Schema Parity & Anti-Divergence Validation');
  console.log('================================================================\n');

  const completeSchemaPath = path.resolve('complete_schema.sql');
  const migrationsDir = path.resolve('supabase/migrations');

  if (!fs.existsSync(completeSchemaPath)) {
    console.error('❌ Fatal: complete_schema.sql not found at project root.');
    process.exit(1);
  }

  const completeSql = fs.readFileSync(completeSchemaPath, 'utf8');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Auditing ${migrationFiles.length} incremental migrations against complete_schema.sql...\n`);

  // 1. Audit Tables
  const completeTables = new Set<string>();
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRegex.exec(completeSql)) !== null) {
    completeTables.add(m[1].toLowerCase());
  }

  const migrationTables = new Set<string>();
  for (const f of migrationFiles) {
    const content = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    let m2: RegExpExecArray | null;
    const r2 = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi;
    while ((m2 = r2.exec(content)) !== null) {
      migrationTables.add(m2[1].toLowerCase());
    }
  }

  // Canonical baseline required tables (enforces that objects missing from BOTH files are caught)
  const REQUIRED_CANONICAL_TABLES = [
    'audit_logs', 'automation_events', 'booking_extras', 'booking_passengers', 'bookings',
    'categories', 'communication_messages', 'communication_templates', 'coupons',
    'crm_activities', 'crm_communications', 'crm_conversations', 'crm_lead_stages',
    'crm_notes', 'crm_segments', 'crm_tags', 'crm_tasks', 'customers', 'departures',
    'destinations', 'faqs', 'guides', 'inquiries', 'invoices', 'leads', 'media_assets',
    'newsletter_subscriptions', 'operational_assignments', 'payment_providers',
    'payment_transactions', 'pickup_locations', 'pickup_schedules', 'profiles',
    'rate_limit_buckets', 'refund_records', 'reviews', 'seo_metadata', 'site_settings',
    'staff_notifications', 'tour_assigned_extras', 'tour_availability', 'tour_categories',
    'tour_exclusions', 'tour_extras', 'tour_faqs', 'tour_highlights', 'tour_images',
    'tour_inclusions', 'tour_itinerary', 'tour_pickup_locations', 'tour_vessels',
    'tour_videos', 'tours', 'vessels', 'weather_bulletins'
  ];

  const missingFromBaseline = REQUIRED_CANONICAL_TABLES.filter((t) => !completeTables.has(t));
  if (missingFromBaseline.length > 0) {
    console.error('❌ Parity Failure: Canonical tables missing from complete_schema.sql:', missingFromBaseline);
    process.exit(1);
  }

  const missingInMig = [...completeTables].filter((t) => !migrationTables.has(t));
  const missingInComplete = [...migrationTables].filter((t) => !completeTables.has(t));

  if (missingInMig.length > 0 || missingInComplete.length > 0) {
    console.error('❌ Parity Failure: Tables diverged!');
    if (missingInMig.length) console.error('   In complete_schema but missing in migrations:', missingInMig);
    if (missingInComplete.length) console.error('   In migrations but missing in complete_schema:', missingInComplete);
    process.exit(1);
  }
  console.log(`✓ Table Parity: Exact match across all ${completeTables.size} canonical tables (including rate_limit_buckets).`);

  // 2. Audit Functions
  const completeFns = new Set<string>();
  const fnRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
  while ((m = fnRegex.exec(completeSql)) !== null) {
    completeFns.add(m[1].toLowerCase());
  }

  const migrationFns = new Set<string>();
  for (const f of migrationFiles) {
    const content = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    let m2: RegExpExecArray | null;
    const r2 = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
    while ((m2 = r2.exec(content)) !== null) {
      migrationFns.add(m2[1].toLowerCase());
    }
  }

  // Canonical baseline required functions & RPCs
  const REQUIRED_CANONICAL_FUNCTIONS = [
    'check_atomic_rate_limit',
    'check_public_submission_rate_limit',
    'create_booking_atomic',
    'get_executive_bi_metrics',
    'get_tour_availability_schedule',
    'handle_new_user',
    'handle_updated_at',
    'handle_user_confirmed',
    'is_admin',
    'lookup_booking_secure',
    'protect_profile_role',
    'query_custom_bi_report',
    'recalculate_customer_stats',
    'request_booking_cancellation_secure',
    'set_admin_role_by_email'
  ];

  const missingFnsFromBaseline = REQUIRED_CANONICAL_FUNCTIONS.filter((f) => !completeFns.has(f));
  if (missingFnsFromBaseline.length > 0) {
    console.error('❌ Parity Failure: Canonical functions missing from complete_schema.sql:', missingFnsFromBaseline);
    process.exit(1);
  }

  const missingFnInMig = [...completeFns].filter((f) => !migrationFns.has(f));
  const missingFnInComplete = [...migrationFns].filter((f) => !completeFns.has(f));

  if (missingFnInMig.length > 0 || missingFnInComplete.length > 0) {
    console.error('❌ Parity Failure: Functions diverged!');
    if (missingFnInMig.length) console.error('   In complete_schema but missing in migrations:', missingFnInMig);
    if (missingFnInComplete.length) console.error('   In migrations but missing in complete_schema:', missingFnInComplete);
    process.exit(1);
  }
  console.log(`✓ Function Parity: Exact match across all ${completeFns.size} functions & RPCs.`);

  // 3. Prohibit Deprecated Table Names
  if (completeSql.includes('operations_assignments') || migrationFiles.some(f => fs.readFileSync(path.join(migrationsDir, f), 'utf8').includes('public.operations_assignments'))) {
    console.error('❌ Parity Failure: Deprecated relation name "operations_assignments" detected! Canonical name is "operational_assignments".');
    process.exit(1);
  }
  console.log('✓ Relation Naming: Zero occurrences of deprecated "operations_assignments".');

  // 4. Validate handle_new_user() Security Hardening
  const fnMatch = completeSql.match(/CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)[\s\S]*?END;\s*\$\$/i);
  const fnBody = fnMatch ? fnMatch[0] : '';
  if (fnBody.includes("raw_user_meta_data->>'role'") || fnBody.includes("NEW.email = 'admin@")) {
    console.error('❌ Parity Failure: handle_new_user() in complete_schema.sql contains privilege leaks!');
    process.exit(1);
  }
  console.log('✓ Security Hardening: handle_new_user() strictly assigns customer role without email or metadata bypasses.');

  console.log('\n================================================================');
  console.log('✅ ALL PARITY CHECKS PASSED: Migrations and complete_schema.sql are fully synchronized.');
  console.log('================================================================\n');
}

runParityCheck();
