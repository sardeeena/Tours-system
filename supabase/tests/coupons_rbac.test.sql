BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

SELECT ok(
  (SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename='coupons' AND policyname='rbac_coupons_read') LIKE '%content.read%'
  AND (SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename='coupons' AND policyname='rbac_coupons_read') NOT LIKE '%bookings.read%',
  'coupon reads require content.read rather than bookings.read'
);
SELECT ok(
  (SELECT with_check FROM pg_policies WHERE schemaname='public' AND tablename='coupons' AND policyname='rbac_coupons_create') LIKE '%content.create%',
  'coupon creation requires content.create'
);
SELECT ok(
  (SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename='coupons' AND policyname='rbac_coupons_update') LIKE '%content.update%'
  AND (SELECT with_check FROM pg_policies WHERE schemaname='public' AND tablename='coupons' AND policyname='rbac_coupons_update') LIKE '%content.update%',
  'coupon updates require content.update for existing and resulting rows'
);
SELECT ok(
  (SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename='coupons' AND policyname='rbac_coupons_delete') LIKE '%content.delete%',
  'coupon deletion requires content.delete'
);


SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='coupons'
      AND cmd='SELECT' AND 'public'=ANY(roles)
  ),
  'anonymous and PUBLIC roles cannot read coupon rows directly'
);

SELECT * FROM finish();
ROLLBACK;
