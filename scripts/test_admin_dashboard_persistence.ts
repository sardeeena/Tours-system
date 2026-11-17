import { isUserAdmin, AppUser } from '../src/services/authService';
import { formatSupabaseError } from '../src/services/supabaseClient';

/**
 * Safe, isolated admin authorization and error-formatting regression tests.
 *
 * This script intentionally performs no Supabase reads or writes. Database
 * persistence tests must use an isolated local Supabase stack and fixtures,
 * never dummy identifiers against whichever project happens to be configured.
 */
function runAdminDashboardPersistenceTests() {
  console.log('Admin authorization and error-formatting regression tests');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`✓ PASS: ${description}`);
      passed += 1;
    } else {
      console.error(`✗ FAIL: ${description}`);
      failed += 1;
    }
  }

  const makeUser = (roles: string[]): AppUser => ({
    id: 'isolated-test-user',
    email: 'test@example.invalid',
    fullName: 'Isolated Test User',
    role: 'customer',
    roles,
    isConfirmed: true,
  });

  assert(isUserAdmin(makeUser(['super_admin'])), 'super_admin normalized role grants admin UI authorization');
  assert(isUserAdmin(makeUser(['admin'])), 'admin normalized role grants admin UI authorization');
  assert(isUserAdmin(makeUser(['operations_manager'])), 'non-customer staff role grants scoped admin UI authorization');
  assert(!isUserAdmin(makeUser(['customer'])), 'customer role is denied admin UI authorization');
  assert(!isUserAdmin(makeUser(['guide'])), 'guide-only role is denied admin UI authorization');
  assert(!isUserAdmin(makeUser([])), 'empty role set is denied admin UI authorization');
  assert(!isUserAdmin(null), 'null user is denied admin UI authorization');
  assert(!isUserAdmin(undefined), 'undefined user is denied admin UI authorization');

  const formattedRls = formatSupabaseError({
    code: '42501',
    message: 'new row violates row-level security policy',
  });
  assert(
    formattedRls.toLowerCase().includes('permission denied') ||
      formattedRls.toLowerCase().includes('authorization'),
    'RLS errors are translated into a clear permission message'
  );

  const formattedDuplicate = formatSupabaseError({
    code: '23505',
    message: 'duplicate key value violates unique constraint',
  });
  assert(
    formattedDuplicate.toLowerCase().includes('already exists'),
    'duplicate-key errors are translated into a clear conflict message'
  );

  console.log(`Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runAdminDashboardPersistenceTests();
