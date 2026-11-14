import assert from 'node:assert/strict';
import fs from 'node:fs';

const reporting = fs.readFileSync('src/services/reportingService.ts', 'utf8');
const executiveStart = reporting.indexOf('export async function fetchExecutiveReport');
const executiveEnd = reporting.indexOf('// 2. SALES REPORT', executiveStart);
const financeStart = reporting.indexOf('export async function fetchFinanceReport');
const financeEnd = reporting.indexOf('// 6. REPORT BUILDER ENGINE', financeStart);

assert.ok(executiveStart >= 0 && executiveEnd > executiveStart, 'executive reporting function exists');
assert.ok(financeStart >= 0 && financeEnd > financeStart, 'finance reporting function exists');

const executive = reporting.slice(executiveStart, executiveEnd);
const finance = reporting.slice(financeStart, financeEnd);

assert.ok(executive.includes('listRefunds()'), 'executive fallback loads refund ledger records');
assert.ok(executive.includes("refund.status === 'processed'"), 'executive collections only subtract completed refunds');
assert.ok(executive.includes('grossCollectedRevenueEur - refundedRevenueEur'), 'executive collected revenue is net of processed refunds');
assert.ok(executive.includes('nonCancelledBookings.map((b) => b.bookingReference)'), 'executive collections exclude cancelled booking cohorts');

assert.ok(finance.includes("['paid', 'partially paid'].includes(String(payment.paymentStatus).toLowerCase().replace(/_/g, ' '))"),
  'finance reports include fully and partially settled payment transactions');
assert.ok(finance.includes("refund.status !== 'processed'"), 'finance reports exclude requested, approved, and rejected refunds');
assert.ok(finance.includes('cohortGrossCollected - cohortRefunded'), 'outstanding balances use net collected funds for the selected booking cohort');
assert.ok(finance.includes("if (refund.status !== 'processed') return;"), 'monthly refund totals include only processed payouts');
assert.ok(!finance.includes("r.status === 'processed' || r.status === 'approved'"),
  'approved-but-unpaid refund requests are not counted as completed refunds');

console.log('Refund-aware finance reporting regression checks passed.');
