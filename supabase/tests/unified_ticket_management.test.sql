BEGIN;
SELECT plan(22);

SELECT ok(to_regclass('public.support_tickets') IS NOT NULL, 'support tickets table exists');
SELECT ok(to_regclass('public.support_ticket_messages') IS NOT NULL, 'ticket messages table exists');
SELECT ok(to_regclass('public.support_ticket_events') IS NOT NULL, 'ticket event audit table exists');

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.support_tickets'::regclass), 'tickets have RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.support_ticket_messages'::regclass), 'messages have RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.support_ticket_events'::regclass), 'events have RLS enabled');

SELECT ok(EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='support_tickets_read'), 'ticket read policy exists');
SELECT ok(EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='support_tickets_create'), 'ticket create policy exists');
SELECT ok(EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='support_tickets_update'), 'ticket update policy exists');
SELECT ok(EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_ticket_messages' AND policyname='support_ticket_messages_read'), 'message visibility policy exists');
SELECT ok(EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_ticket_messages' AND policyname='support_ticket_messages_create'), 'message write policy exists');
SELECT ok(EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_ticket_events' AND policyname='support_ticket_events_read'), 'event read policy exists');

SELECT ok(EXISTS(
  SELECT 1 FROM public.access_roles r
  JOIN public.role_permissions rp ON rp.role_id=r.id
  JOIN public.access_permissions p ON p.id=rp.permission_id
  WHERE r.slug='support_agent' AND p.permission_key='tickets.manage'
), 'support agents receive ticket management permission');
SELECT ok(EXISTS(
  SELECT 1 FROM public.access_roles r
  JOIN public.role_permissions rp ON rp.role_id=r.id
  JOIN public.access_permissions p ON p.id=rp.permission_id
  WHERE r.slug='staff' AND p.permission_key='tickets.read_assigned'
), 'staff can read tickets assigned to them');
SELECT ok(EXISTS(
  SELECT 1 FROM public.access_roles r
  JOIN public.role_permissions rp ON rp.role_id=r.id
  JOIN public.access_permissions p ON p.id=rp.permission_id
  WHERE r.slug='finance_manager' AND p.permission_key='tickets.read'
), 'finance managers receive department ticket access');
SELECT ok(NOT EXISTS(
  SELECT 1 FROM public.access_roles r
  JOIN public.role_permissions rp ON rp.role_id=r.id
  JOIN public.access_permissions p ON p.id=rp.permission_id
  WHERE r.slug='customer' AND p.permission_key='tickets.read'
), 'customer role is not granted organization-wide ticket access');

SELECT ok(NOT has_table_privilege('anon','public.support_tickets','SELECT'), 'anonymous users cannot read tickets');
SELECT ok(NOT has_table_privilege('authenticated','public.support_ticket_events','INSERT'), 'authenticated users cannot forge audit events');
SELECT ok(NOT has_table_privilege('authenticated','public.support_tickets','DELETE'), 'authenticated users cannot delete tickets');
SELECT ok(NOT has_column_privilege('authenticated','public.support_tickets','requester_id','UPDATE'), 'ticket requester identity cannot be reassigned');

SELECT ok(EXISTS(SELECT 1 FROM storage.buckets WHERE id='support-ticket-attachments' AND public=false), 'ticket attachments bucket is private');
SELECT ok(EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='support_ticket_attachments_read'), 'attachment reads are ticket-scoped');

SELECT ok(EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='support_tickets_prepare' AND NOT tgisinternal), 'ticket creation guard trigger exists');
SELECT ok(EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='support_ticket_message_event' AND NOT tgisinternal), 'message audit and SLA trigger exists');

SELECT * FROM finish();
ROLLBACK;
