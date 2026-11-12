-- Align provider-event visibility with the communications RBAC module.
-- Preserve existing content managers' read access while granting communications readers access.
DROP POLICY IF EXISTS "Staff can read email provider events" ON public.email_provider_events;

CREATE POLICY "Staff can read email provider events"
ON public.email_provider_events
FOR SELECT
TO authenticated
USING (
  private.has_permission('communications.read')
  OR private.has_permission('content.read')
);
