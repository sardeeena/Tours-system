-- Coupon administration is a content-management capability, not a booking-read capability.
-- Keep the UI gate and database RLS aligned so read-only booking staff cannot manage discounts.
BEGIN;

DROP POLICY IF EXISTS "Public validate coupons" ON public.coupons;
DROP POLICY IF EXISTS "Public can read active coupons" ON public.coupons;
DROP POLICY IF EXISTS rbac_coupons_read ON public.coupons;
DROP POLICY IF EXISTS rbac_coupons_create ON public.coupons;
DROP POLICY IF EXISTS rbac_coupons_update ON public.coupons;
DROP POLICY IF EXISTS rbac_coupons_delete ON public.coupons;

CREATE POLICY rbac_coupons_read ON public.coupons
  FOR SELECT TO authenticated
  USING (public.has_permission('content.read'));

CREATE POLICY rbac_coupons_create ON public.coupons
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('content.create'));

CREATE POLICY rbac_coupons_update ON public.coupons
  FOR UPDATE TO authenticated
  USING (public.has_permission('content.update'))
  WITH CHECK (public.has_permission('content.update'));

CREATE POLICY rbac_coupons_delete ON public.coupons
  FOR DELETE TO authenticated
  USING (public.has_permission('content.delete'));

COMMIT;
