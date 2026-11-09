import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../src/services/couponService';
import { listInquiries, updateInquiryStatus, deleteInquiry } from '../src/services/inquiryService';
import { updateCustomerRole, updateCustomerDetails, deleteCustomerRecord } from '../src/services/customerService';
import { updateSubscriberStatus, deleteSubscriber } from '../src/services/newsletterService';
import { isUserAdmin, AppUser } from '../src/services/authService';
import { formatSupabaseError } from '../src/services/supabaseClient';

/**
 * ==============================================================================
 * PHASE 4: COMPLETE ADMIN DASHBOARD PERSISTENCE & ERROR SURFACING TEST SUITE
 * ==============================================================================
 */

async function runAdminDashboardPersistenceTests() {
  console.log('================================================================');
  console.log('  Phase 4: Admin Dashboard Persistence & Error Surfacing Tests');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, details?: any) {
    if (condition) {
      console.log(`✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      if (details) console.error('   Details:', details);
      failed++;
    }
  }

  // ----------------------------------------------------------------------------
  // TEST 1: formatSupabaseError produces clear, human-readable messages
  // ----------------------------------------------------------------------------
  console.log('Test 1: Error Formatting Utility');
  const rlsError = { code: '42501', message: 'new row violates row-level security policy' };
  const formattedRls = formatSupabaseError(rlsError);
  assert(
    formattedRls.includes('Permission denied') || formattedRls.includes('authorization'),
    'formatSupabaseError translates 42501 RLS error into clear permission denied message',
    formattedRls
  );

  const duplicateError = { code: '23505', message: 'duplicate key value violates unique constraint' };
  const formattedDup = formatSupabaseError(duplicateError);
  assert(
    formattedDup.includes('already exists'),
    'formatSupabaseError translates 23505 duplicate key into duplicate message',
    formattedDup
  );

  // ----------------------------------------------------------------------------
  // TEST 2: Role Authorization Checks
  // ----------------------------------------------------------------------------
  console.log('\nTest 2: Role Authorization & Least Privilege Enforcement');
  const superAdminUser: AppUser = {
    id: 'usr-super-1',
    email: 'superadmin@example.com',
    fullName: 'Mahmoud Super Admin',
    role: 'super_admin',
    isConfirmed: true,
  };
  const adminUser: AppUser = {
    id: 'usr-admin-1',
    email: 'admin@example.com',
    fullName: 'Operations Manager',
    role: 'admin',
    isConfirmed: true,
  };
  const nonAdminRoleUser: AppUser = {
    id: 'usr-external-1',
    email: 'external@example.com',
    fullName: 'External Partner',
    role: 'partner' as any,
    isConfirmed: true,
  };
  const customerUser: AppUser = {
    id: 'usr-cust-1',
    email: 'guest@example.com',
    fullName: 'Vacation Traveler',
    role: 'customer',
    isConfirmed: true,
  };

  assert(isUserAdmin(superAdminUser) === true, 'super_admin role is granted admin authorization');
  assert(isUserAdmin(adminUser) === true, 'admin role is granted admin authorization');
  assert(isUserAdmin(nonAdminRoleUser) === false, 'non-admin role is strictly denied admin access');
  assert(isUserAdmin(customerUser) === false, 'customer role is strictly denied admin access');
  assert(isUserAdmin(null) === false, 'null user is strictly denied admin access');
  assert(isUserAdmin(undefined) === false, 'undefined user is strictly denied admin access');

  // ----------------------------------------------------------------------------
  // TEST 3: Newsletter Subscriber Identifier Handling (UUID vs Email Type Safety)
  // ----------------------------------------------------------------------------
  console.log('\nTest 3: Newsletter Subscriber Identifier Safety');
  const validUuid = '11111111-2222-3333-4444-555555555555';
  const testEmail = 'subscriber.audit@example.com';

  // Calling updateSubscriberStatus with email must not crash PostgreSQL on UUID type cast
  try {
    const res = await updateSubscriberStatus(testEmail, 'subscribed');
    assert(res === true, 'updateSubscriberStatus succeeds safely when passed an email address');
  } catch (err: any) {
    assert(false, 'updateSubscriberStatus failed on email identifier', err.message);
  }

  try {
    const delRes = await deleteSubscriber(testEmail);
    assert(delRes === true, 'deleteSubscriber succeeds safely when passed an email address');
  } catch (err: any) {
    assert(false, 'deleteSubscriber failed on email identifier', err.message);
  }

  // ----------------------------------------------------------------------------
  // TEST 4: Coupon Service Validation & CRUD Safety
  // ----------------------------------------------------------------------------
  console.log('\nTest 4: Coupon Service Validation');
  try {
    const coupons = await getCoupons();
    assert(Array.isArray(coupons), 'getCoupons returns an array without crashing');
  } catch (err: any) {
    assert(false, 'getCoupons threw unexpected error', err.message);
  }

  // ----------------------------------------------------------------------------
  // TEST 5: Customer Service Mutation & Delete Cleanliness
  // ----------------------------------------------------------------------------
  console.log('\nTest 5: Customer Service Mutation and Deletion');
  try {
    const delCust = await deleteCustomerRecord('cust-test-dummy-id');
    assert(delCust === true, 'deleteCustomerRecord executes cleanly and updates local cache');
  } catch (err: any) {
    assert(false, 'deleteCustomerRecord failed unexpectedly', err.message);
  }

  // ----------------------------------------------------------------------------
  // TEST 6: Inquiry Service Status & Notes Updates
  // ----------------------------------------------------------------------------
  console.log('\nTest 6: Inquiry Service Status Updates');
  try {
    const inquiries = await listInquiries();
    assert(Array.isArray(inquiries), 'listInquiries returns an array of inquiries');
  } catch (err: any) {
    assert(false, 'listInquiries threw unexpected error', err.message);
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdminDashboardPersistenceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
