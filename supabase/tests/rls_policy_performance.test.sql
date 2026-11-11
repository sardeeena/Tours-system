BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='bookings'
      AND policyname='Users can view own bookings'
  ),
  'redundant own-bookings policy is removed while linked-bookings policy remains'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='bookings'
      AND policyname='rbac_bookings_read'
      AND qual ILIKE '%SELECT auth.uid()%'
  ),
  'linked-bookings policy uses statement-scoped auth.uid'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='customers'
      AND policyname='Users can read own customer record'
  ),
  'obsolete customer primary-key ownership policy is removed'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='customers'
      AND policyname='rbac_customers_read'
      AND qual ILIKE '%SELECT auth.uid()%'
  ),
  'customer ownership policy remains and uses statement-scoped auth.uid'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='payment_transactions'
      AND policyname='Customers can view their own payments'
  ),
  'duplicate legacy payments policy is removed'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='payment_transactions'
      AND policyname='rbac_payment_transactions_read'
      AND qual ILIKE '%SELECT auth.uid()%'
  ),
  'customer payment access remains through the retained optimized policy'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='refund_records'
      AND policyname='rbac_refund_records_read'
      AND qual ILIKE '%SELECT auth.uid()%'
  ),
  'customer refund access remains with statement-scoped auth.uid'
);

SELECT * FROM finish();
ROLLBACK;
