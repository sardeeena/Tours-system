-- Persist CRM inquiry ownership against real, normalized staff profiles.
BEGIN;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS assigned_staff_id UUID
  REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_staff_id
  ON public.inquiries(assigned_staff_id)
  WHERE assigned_staff_id IS NOT NULL;

COMMENT ON COLUMN public.inquiries.assigned_staff_id IS
  'Profile ID of the staff member responsible for this inquiry; NULL means unassigned.';

-- The staff directory is intentionally exposed through a narrow RPC rather than
-- granting CRM users broad direct access to profile or RBAC tables.
CREATE OR REPLACE FUNCTION public.list_crm_assignable_staff()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  role_slugs TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.read') THEN
    RAISE EXCEPTION 'CRM read permission is required to view assignable staff.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(NULLIF(btrim(p.full_name), ''), p.email) AS full_name,
    p.email,
    array_agg(DISTINCT r.slug ORDER BY r.slug) AS role_slugs
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  JOIN public.access_roles r ON r.id = ur.role_id AND r.is_active
  WHERE p.is_confirmed IS TRUE
    AND r.slug NOT IN ('customer', 'guide')
  GROUP BY p.id, p.full_name, p.email
  ORDER BY COALESCE(NULLIF(btrim(p.full_name), ''), p.email), p.email;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_crm_assignable_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_crm_assignable_staff() TO authenticated, service_role;

COMMENT ON FUNCTION public.list_crm_assignable_staff() IS
  'Returns confirmed staff profiles with active normalized non-customer/non-guide roles, only to CRM readers.';

NOTIFY pgrst, 'reload schema';
COMMIT;
