-- Optimize frequently used RLS predicates and remove superseded permissive policies.
-- Wrap auth helpers in scalar SELECTs so Postgres can evaluate them once per statement.

BEGIN;

-- Bookings: the linked-bookings policy already covers direct user ownership,
-- linked customer ownership, and administrators. The older own-bookings policy
-- was a strict subset and therefore redundant.
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;

DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
CREATE POLICY "Users can update own bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id)
  OR (SELECT public.is_admin())
)
WITH CHECK (
  ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id)
  OR (SELECT public.is_admin())
);

DROP POLICY IF EXISTS "Users can view linked bookings" ON public.bookings;
CREATE POLICY "Users can view linked bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR customer_id IN (
    SELECT c.id
    FROM public.customers AS c
    WHERE c.user_id = (SELECT auth.uid())
  )
  OR (SELECT public.is_admin())
);

-- Customers: remove an obsolete ID-equals-user-ID policy. Ownership is based
-- on customers.user_id, not the unrelated customers.id primary key.
DROP POLICY IF EXISTS "Users can read own customer record" ON public.customers;

DROP POLICY IF EXISTS "Users can view own customer record" ON public.customers;
CREATE POLICY "Users can view own customer record"
ON public.customers
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  OR (SELECT public.is_admin())
);

DROP POLICY IF EXISTS "Users can update own customer record" ON public.customers;
CREATE POLICY "Users can update own customer record"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  OR (SELECT public.is_admin())
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  OR (SELECT public.is_admin())
);

-- Communication and financial customer-read policies.
DROP POLICY IF EXISTS "Customers can view their own communication messages" ON public.communication_messages;
CREATE POLICY "Customers can view their own communication messages"
ON public.communication_messages
FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT c.id
    FROM public.customers AS c
    WHERE c.user_id = (SELECT auth.uid())
  )
  OR (SELECT public.is_admin())
);

DROP POLICY IF EXISTS "Customers can view their own invoices" ON public.invoices;
CREATE POLICY "Customers can view their own invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.id = invoices.booking_id
      AND b.user_id = (SELECT auth.uid())
  )
);

-- Remove the duplicate legacy payments policy; the retained policy grants the
-- same customer-owned booking access.
DROP POLICY IF EXISTS "Customers can view their own payments" ON public.payment_transactions;

DROP POLICY IF EXISTS "Customers can view their own payment transactions" ON public.payment_transactions;
CREATE POLICY "Customers can view their own payment transactions"
ON public.payment_transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.id = payment_transactions.booking_id
      AND b.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Customers can view their own refund records" ON public.refund_records;
CREATE POLICY "Customers can view their own refund records"
ON public.refund_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.id = refund_records.booking_id
      AND b.user_id = (SELECT auth.uid())
  )
);

-- Related booking child rows already use scalar SELECT for auth.uid(); wrap
-- the admin predicate too so it is not re-run for every candidate row.
DROP POLICY IF EXISTS "Customers can view their own booking extras" ON public.booking_extras;
CREATE POLICY "Customers can view their own booking extras"
ON public.booking_extras
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.id = booking_extras.booking_id
      AND (
        b.user_id = (SELECT auth.uid())
        OR b.customer_id IN (
          SELECT c.id
          FROM public.customers AS c
          WHERE c.user_id = (SELECT auth.uid())
        )
      )
  )
  OR (SELECT public.is_admin())
);

DROP POLICY IF EXISTS "Customers can view their own booking passengers" ON public.booking_passengers;
CREATE POLICY "Customers can view their own booking passengers"
ON public.booking_passengers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.id = booking_passengers.booking_id
      AND (
        b.user_id = (SELECT auth.uid())
        OR b.customer_id IN (
          SELECT c.id
          FROM public.customers AS c
          WHERE c.user_id = (SELECT auth.uid())
        )
      )
  )
  OR (SELECT public.is_admin())
);

-- Profile administration policies call the SECURITY DEFINER helper to avoid
-- recursive RLS evaluation; scalar SELECT keeps that helper statement-scoped.
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING ((SELECT public.is_admin()));

COMMIT;
