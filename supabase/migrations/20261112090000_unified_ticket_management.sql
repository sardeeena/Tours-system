-- Unified Kemet Spirit ticket management.
-- Customers see only their own public conversations. Staff access is granted by the existing multi-role RBAC.
BEGIN;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 4 AND 180),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 10 AND 10000),
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general','booking','payment','refund','tour_operation','pickup','technical','complaint','other')),
  department text NOT NULL DEFAULT 'support'
    CHECK (department IN ('support','booking','operations','finance','sales','technical','management')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent','critical')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','assigned','in_progress','waiting_customer','waiting_third_party','resolved','closed','reopened')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_response_at timestamptz,
  first_response_due_at timestamptz NOT NULL DEFAULT (now() + interval '4 hours'),
  resolution_due_at timestamptz NOT NULL DEFAULT (now() + interval '2 days'),
  resolved_at timestamptz,
  closed_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_requester_created_idx
  ON public.support_tickets(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_queue_idx
  ON public.support_tickets(status, department, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_assignee_idx
  ON public.support_tickets(assigned_to, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_booking_idx
  ON public.support_tickets(booking_id) WHERE booking_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 10000),
  is_internal boolean NOT NULL DEFAULT false,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) <= 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_ticket_messages_thread_idx
  ON public.support_ticket_messages(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS public.support_ticket_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 1 AND 80),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_ticket_events_thread_idx
  ON public.support_ticket_events(ticket_id, created_at DESC);

-- Dedicated permission keys. Existing admin/super-admin bypass behavior remains in public.has_permission.
INSERT INTO public.access_permissions(permission_key,module,action,description)
VALUES
 ('tickets.create','tickets','create','Create support tickets'),
 ('tickets.read','tickets','read','Read department-wide support tickets'),
 ('tickets.read_assigned','tickets','read_assigned','Read tickets assigned to the current staff member'),
 ('tickets.reply','tickets','reply','Reply to customer-visible ticket conversations'),
 ('tickets.update','tickets','update','Update ticket status, priority and department'),
 ('tickets.assign','tickets','assign','Assign tickets to staff members'),
 ('tickets.internal_note','tickets','internal_note','Read and write private internal ticket notes'),
 ('tickets.manage','tickets','manage','Full ticket administration and reporting')
ON CONFLICT(permission_key) DO UPDATE
SET module=excluded.module, action=excluded.action, description=excluded.description;

-- Preserve existing role definitions and add only ticket permissions.
WITH role_grants(role_slug, permission_key) AS (
  SELECT * FROM (VALUES
    ('support_agent','tickets.create'),('support_agent','tickets.read'),('support_agent','tickets.read_assigned'),
    ('support_agent','tickets.reply'),('support_agent','tickets.update'),('support_agent','tickets.assign'),
    ('support_agent','tickets.internal_note'),('support_agent','tickets.manage'),
    ('manager','tickets.create'),('manager','tickets.read'),('manager','tickets.read_assigned'),
    ('manager','tickets.reply'),('manager','tickets.update'),('manager','tickets.assign'),('manager','tickets.internal_note'),
    ('operations_manager','tickets.create'),('operations_manager','tickets.read'),('operations_manager','tickets.read_assigned'),
    ('operations_manager','tickets.reply'),('operations_manager','tickets.update'),('operations_manager','tickets.internal_note'),
    ('finance_manager','tickets.create'),('finance_manager','tickets.read'),('finance_manager','tickets.read_assigned'),
    ('finance_manager','tickets.reply'),('finance_manager','tickets.update'),('finance_manager','tickets.internal_note'),
    ('sales_manager','tickets.create'),('sales_manager','tickets.read'),('sales_manager','tickets.read_assigned'),
    ('sales_manager','tickets.reply'),('sales_manager','tickets.update'),('sales_manager','tickets.internal_note'),
    ('staff','tickets.create'),('staff','tickets.read_assigned'),('staff','tickets.reply'),
    ('guide','tickets.create'),('guide','tickets.read_assigned'),('guide','tickets.reply')
  ) AS grants(role_slug,permission_key)
)
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM role_grants g
JOIN public.access_roles r ON r.slug=g.role_slug AND r.is_active
JOIN public.access_permissions p ON p.permission_key=g.permission_key
ON CONFLICT DO NOTHING;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_tickets_read ON public.support_tickets;
CREATE POLICY support_tickets_read ON public.support_tickets
FOR SELECT TO authenticated
USING (
  requester_id = (SELECT auth.uid())
  OR (SELECT public.has_permission('tickets.read'))
  OR (assigned_to = (SELECT auth.uid()) AND (SELECT public.has_permission('tickets.read_assigned')))
);

DROP POLICY IF EXISTS support_tickets_create ON public.support_tickets;
CREATE POLICY support_tickets_create ON public.support_tickets
FOR INSERT TO authenticated
WITH CHECK (
  requester_id = (SELECT auth.uid())
  AND (
    (SELECT public.has_permission('tickets.create'))
    OR (SELECT public.has_role('customer'))
  )
  AND (
    booking_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND (
          b.user_id = (SELECT auth.uid())
          OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id=b.customer_id AND c.user_id=(SELECT auth.uid()))
          OR (SELECT public.has_permission('tickets.manage'))
          OR (SELECT public.has_permission('bookings.read'))
        )
    )
  )
);

DROP POLICY IF EXISTS support_tickets_update ON public.support_tickets;
CREATE POLICY support_tickets_update ON public.support_tickets
FOR UPDATE TO authenticated
USING (
  (SELECT public.has_permission('tickets.update'))
  OR (assigned_to = (SELECT auth.uid()) AND (SELECT public.has_permission('tickets.reply')))
)
WITH CHECK (
  (SELECT public.has_permission('tickets.update'))
  OR (assigned_to = (SELECT auth.uid()) AND (SELECT public.has_permission('tickets.reply')))
);

DROP POLICY IF EXISTS support_ticket_messages_read ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_read ON public.support_ticket_messages
FOR SELECT TO authenticated
USING (
  (NOT is_internal OR (SELECT public.has_permission('tickets.internal_note')))
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id
      AND (
        t.requester_id = (SELECT auth.uid())
        OR (SELECT public.has_permission('tickets.read'))
        OR (t.assigned_to = (SELECT auth.uid()) AND (SELECT public.has_permission('tickets.read_assigned')))
      )
  )
);

DROP POLICY IF EXISTS support_ticket_messages_create ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_create ON public.support_ticket_messages
FOR INSERT TO authenticated
WITH CHECK (
  author_id = (SELECT auth.uid())
  AND (
    (
      NOT is_internal
      AND EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = ticket_id AND t.requester_id = (SELECT auth.uid())
          AND t.status NOT IN ('closed')
      )
    )
    OR (
      (SELECT public.has_permission('tickets.reply'))
      AND EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = ticket_id
          AND (
            (SELECT public.has_permission('tickets.read'))
            OR (t.assigned_to = (SELECT auth.uid()) AND (SELECT public.has_permission('tickets.read_assigned')))
          )
          AND t.status NOT IN ('closed')
      )
      AND (NOT is_internal OR (SELECT public.has_permission('tickets.internal_note')))
    )
  )
);

-- Event history is append-only and readable only to ticket participants/staff.
DROP POLICY IF EXISTS support_ticket_events_read ON public.support_ticket_events;
CREATE POLICY support_ticket_events_read ON public.support_ticket_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id=ticket_id
      AND (
        (t.requester_id=(SELECT auth.uid()) AND event_type<>'internal_note_added')
        OR (SELECT public.has_permission('tickets.read'))
        OR (t.assigned_to=(SELECT auth.uid()) AND (SELECT public.has_permission('tickets.read_assigned')))
      )
  )
);
-- No direct INSERT/UPDATE/DELETE policies for events: only trusted triggers write them.

-- Restrict columns so callers cannot rewrite ticket ownership or identity.
REVOKE ALL PRIVILEGES ON public.support_tickets, public.support_ticket_messages, public.support_ticket_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT INSERT (requester_id, customer_id, booking_id, subject, description, category, department, priority) ON public.support_tickets TO authenticated;
GRANT UPDATE (status, priority, department, assigned_to, first_response_at, resolved_at, closed_at, first_response_due_at, resolution_due_at, last_message_at, updated_at)
  ON public.support_tickets TO authenticated;
GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT SELECT ON public.support_ticket_events TO authenticated;
GRANT ALL PRIVILEGES ON public.support_tickets, public.support_ticket_messages, public.support_ticket_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.support_tickets_ticket_number_seq, public.support_ticket_events_id_seq TO authenticated, service_role;

-- Ensure ticket timestamps and first-response SLA are consistently maintained.
CREATE OR REPLACE FUNCTION private.set_support_ticket_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $function$
BEGIN
  NEW.updated_at := now();
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    NEW.first_response_due_at := CASE NEW.priority
      WHEN 'critical' THEN now() + interval '15 minutes'
      WHEN 'urgent' THEN now() + interval '1 hour'
      WHEN 'high' THEN now() + interval '2 hours'
      ELSE now() + interval '4 hours'
    END;
    NEW.resolution_due_at := CASE NEW.priority
      WHEN 'critical' THEN now() + interval '4 hours'
      WHEN 'urgent' THEN now() + interval '8 hours'
      WHEN 'high' THEN now() + interval '1 day'
      ELSE now() + interval '2 days'
    END;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status='resolved' THEN NEW.resolved_at := COALESCE(NEW.resolved_at,now());
    ELSIF NEW.status IN ('open','assigned','in_progress','reopened') THEN NEW.resolved_at := NULL;
    END IF;
    IF NEW.status='closed' THEN NEW.closed_at := COALESCE(NEW.closed_at,now());
    ELSE NEW.closed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION private.set_support_ticket_updated_at();

CREATE OR REPLACE FUNCTION private.record_support_ticket_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.support_ticket_events(ticket_id,actor_id,event_type,details)
    VALUES(NEW.id,v_actor,'ticket_created',jsonb_build_object('status',NEW.status,'department',NEW.department,'priority',NEW.priority));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.support_ticket_events(ticket_id,actor_id,event_type,details)
    VALUES(NEW.id,v_actor,'status_changed',jsonb_build_object('from',OLD.status,'to',NEW.status));
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.support_ticket_events(ticket_id,actor_id,event_type,details)
    VALUES(NEW.id,v_actor,'assignment_changed',jsonb_build_object('from',OLD.assigned_to,'to',NEW.assigned_to));
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.support_ticket_events(ticket_id,actor_id,event_type,details)
    VALUES(NEW.id,v_actor,'priority_changed',jsonb_build_object('from',OLD.priority,'to',NEW.priority));
  END IF;
  IF NEW.department IS DISTINCT FROM OLD.department THEN
    INSERT INTO public.support_ticket_events(ticket_id,actor_id,event_type,details)
    VALUES(NEW.id,v_actor,'department_changed',jsonb_build_object('from',OLD.department,'to',NEW.department));
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS support_tickets_event_insert ON public.support_tickets;
CREATE TRIGGER support_tickets_event_insert AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION private.record_support_ticket_event();
DROP TRIGGER IF EXISTS support_tickets_event_update ON public.support_tickets;
CREATE TRIGGER support_tickets_event_update AFTER UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION private.record_support_ticket_event();

CREATE OR REPLACE FUNCTION private.record_support_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  UPDATE public.support_tickets
  SET last_message_at=NEW.created_at,
      updated_at=now(),
      status=CASE WHEN requester_id=NEW.author_id AND status='resolved' AND NOT NEW.is_internal THEN 'reopened' ELSE status END
  WHERE id=NEW.ticket_id;
  INSERT INTO public.support_ticket_events(ticket_id,actor_id,event_type,details)
  VALUES(NEW.ticket_id,NEW.author_id,CASE WHEN NEW.is_internal THEN 'internal_note_added' ELSE 'reply_added' END,
    jsonb_build_object('message_id',NEW.id));
  IF NOT NEW.is_internal THEN
    UPDATE public.support_tickets SET first_response_at=COALESCE(first_response_at,NEW.created_at)
    WHERE id=NEW.ticket_id AND requester_id<>NEW.author_id;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS support_ticket_message_event ON public.support_ticket_messages;
CREATE TRIGGER support_ticket_message_event AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION private.record_support_message_event();

-- Grant EXECUTE only to the trigger owner path; trigger functions are not exposed via RPC.
REVOKE ALL ON FUNCTION private.set_support_ticket_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.record_support_ticket_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.record_support_message_event() FROM PUBLIC, anon, authenticated;


-- Associate signed-in requesters with the CRM customer record where one exists.
CREATE OR REPLACE FUNCTION private.prepare_support_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  -- Link the requester's own CRM customer record when one exists.
  IF NEW.customer_id IS NULL THEN
    SELECT c.id INTO NEW.customer_id
    FROM public.customers c
    WHERE c.user_id=NEW.requester_id
    ORDER BY c.created_at DESC LIMIT 1;
  END IF;
  NEW.first_response_due_at := CASE NEW.priority
    WHEN 'critical' THEN now() + interval '15 minutes'
    WHEN 'urgent' THEN now() + interval '1 hour'
    WHEN 'high' THEN now() + interval '2 hours'
    ELSE now() + interval '4 hours'
  END;
  NEW.resolution_due_at := CASE NEW.priority
    WHEN 'critical' THEN now() + interval '4 hours'
    WHEN 'urgent' THEN now() + interval '8 hours'
    WHEN 'high' THEN now() + interval '1 day'
    ELSE now() + interval '2 days'
  END;
  -- Customers may never self-assign, set staff-only queues, or escalate their own priority.
  IF NOT public.has_permission('tickets.create') THEN
    NEW.department := 'support';
    NEW.priority := 'normal';
    NEW.assigned_to := NULL;
    NEW.status := 'open';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS support_tickets_prepare ON public.support_tickets;
CREATE TRIGGER support_tickets_prepare BEFORE INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION private.prepare_support_ticket();
REVOKE ALL ON FUNCTION private.prepare_support_ticket() FROM PUBLIC, anon, authenticated;

-- Private, ticket-scoped attachments. The object path must start with the ticket UUID.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('support-ticket-attachments','support-ticket-attachments',false,10485760,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp','text/plain'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS support_ticket_attachments_read ON storage.objects;
CREATE POLICY support_ticket_attachments_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id='support-ticket-attachments'
  AND split_part(name,'/',1) ~* '^[0-9a-f-]{36}

  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id::text=split_part(storage.objects.name,'/',1)
      AND (
        t.requester_id=(SELECT auth.uid())
        OR (SELECT public.has_permission('tickets.read'))
        OR (t.assigned_to=(SELECT auth.uid()) AND (SELECT public.has_permission('tickets.read_assigned')))
      )
  )
);

DROP POLICY IF EXISTS support_ticket_attachments_upload ON storage.objects;
CREATE POLICY support_ticket_attachments_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='support-ticket-attachments'
  AND split_part(name,'/',1) ~* '^[0-9a-f-]{36}

  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id::text=split_part(storage.objects.name,'/',1)
      AND (
        (t.requester_id=(SELECT auth.uid()) AND t.status<>'closed')
        OR (
          (SELECT public.has_permission('tickets.reply'))
          AND (
            (SELECT public.has_permission('tickets.read'))
            OR (t.assigned_to=(SELECT auth.uid()) AND (SELECT public.has_permission('tickets.read_assigned')))
          )
        )
      )
  )
);

DROP POLICY IF EXISTS support_ticket_attachments_delete ON storage.objects;
CREATE POLICY support_ticket_attachments_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id='support-ticket-attachments'
  AND split_part(name,'/',1) ~* '^[0-9a-f-]{36}

  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id::text=split_part(storage.objects.name,'/',1)
      AND (
        (t.requester_id=(SELECT auth.uid()) AND t.status<>'closed')
        OR (SELECT public.has_permission('tickets.manage'))
      )
  )
);

-- Enable realtime updates where the project's publication is available.
DO $realtime$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_tickets') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_ticket_messages') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
    END IF;
  END IF;
END;
$realtime$;


COMMIT;
