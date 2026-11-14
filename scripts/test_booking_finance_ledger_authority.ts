import assert from 'node:assert/strict';
import fs from 'node:fs';

const admin = fs.readFileSync('src/components/admin/AdminBookingsList.tsx', 'utf8');
const repository = fs.readFileSync('src/services/bookingRepository.ts', 'utf8');
const finance = fs.readFileSync('src/services/financeService.ts', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/20261114000000_finance_payment_status_ledger_authority.sql',
  'utf8'
);

assert.ok(admin.includes("import { listPayments, listRefunds, recordPayment }"), 'booking payment flow reads payments and processed refunds from the ledger');
assert.ok(admin.includes('Record Payment'), 'staff have an explicit ledger-backed Record Payment action');
assert.ok(!admin.includes('handleUpdatePaymentStatus'), 'booking screen has no direct payment-status mutation handler');
assert.ok(!admin.includes('Reset Pending'), 'staff cannot reset payment status without correcting the ledger');
assert.ok(!admin.includes('>Refund</button>'), 'booking screen does not mark refunds without a refund record');
assert.ok(admin.includes("refund.status === 'processed'"), 'remaining payment amount subtracts processed refunds');

const updateMethod = repository.slice(
  repository.indexOf('  async updateBooking(booking: Booking): Promise<Booking> {'),
  repository.indexOf('\n  async cancelBooking(', repository.indexOf('  async updateBooking(booking: Booking): Promise<Booking> {'))
);
assert.ok(updateMethod.includes(".select('payment_status')"), 'booking update reads the database-authoritative payment status');
assert.ok(!updateMethod.includes('payment_status: booking.paymentStatus'), 'booking update never writes payment status directly');

assert.ok(finance.includes("export async function requestRefund"), 'refund requests remain available through finance workflow');
assert.ok(finance.includes("export async function processRefund"), 'refund processing remains ledger-backed');

assert.ok(migration.includes('v_paid_before := greatest(0, v_paid_before - v_refunded_before)'), 'processed refunds reduce the balance available for later payments');
assert.ok(migration.includes('v_net_paid_after := greatest(0, v_paid_after - v_refunded_after)'), 'booking payment status is recalculated from net paid funds');
assert.ok(migration.includes('CREATE TRIGGER trg_enforce_booking_payment_status_ledger'), 'database rejects payment status changes that do not match the ledger');

console.log('Booking payment ledger authority regression checks passed.');
