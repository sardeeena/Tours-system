-- Make inquiry-to-lead conversion atomic and idempotent under concurrent requests.
BEGIN;

CREATE OR REPLACE FUNCTION public.convert_inquiry_to_lead(p_inquiry_id UUID)
RETURNS SETOF public.leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_inquiry public.inquiries%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_marker TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('crm.manage') THEN
    RAISE EXCEPTION 'CRM management permission is required to convert inquiries.'
      USING ERRCODE = '42501';
  END IF;

  -- Serialize conversions for this inquiry, including requests from different
  -- browser sessions that cannot coordinate through client-side state.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_inquiry_id::text, 0));

  SELECT * INTO v_inquiry
  FROM public.inquiries
  WHERE id = p_inquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inquiry not found.' USING ERRCODE = 'P0002';
  END IF;

  v_marker := '[source-inquiry:' || v_inquiry.id::text || ']';

  SELECT * INTO v_lead
  FROM public.leads
  WHERE lower(trim(COALESCE(email, ''))) = lower(trim(v_inquiry.email))
    AND position(v_marker in COALESCE(notes, '')) > 0
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_inquiry.status <> 'converted' THEN
      UPDATE public.inquiries
      SET status = 'converted', updated_at = now()
      WHERE id = p_inquiry_id;
    END IF;
    RETURN NEXT v_lead;
    RETURN;
  END IF;

  IF v_inquiry.status = 'converted' THEN
    RAISE EXCEPTION 'Inquiry is already converted but its linked lead is missing; manual review is required.'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.leads (
    name, email, phone, whatsapp, source, interested_tour_id,
    interested_tour_title, number_of_guests, estimated_value,
    currency, stage, status, score, notes
  ) VALUES (
    v_inquiry.customer_name,
    v_inquiry.email,
    v_inquiry.phone,
    COALESCE(v_inquiry.whatsapp, v_inquiry.phone),
    COALESCE(NULLIF(v_inquiry.source, ''), 'Website'),
    CASE WHEN v_inquiry.tour_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN v_inquiry.tour_id::uuid ELSE NULL END,
    COALESCE(NULLIF(v_inquiry.tour_title, ''), NULLIF(replace(COALESCE(v_inquiry.admin_notes, ''), 'Referenced Tour: ', ''), '')),
    2,
    150,
    'EUR',
    'Contacted',
    'active',
    60,
    v_marker || ' Converted from Help Inquiry: ' || v_inquiry.message
  )
  RETURNING * INTO v_lead;

  INSERT INTO public.crm_activities (
    lead_id, event_type, title, description, actor, metadata
  ) VALUES (
    v_lead.id,
    'lead_created',
    'Lead Created from Inquiry',
    'Lead created through atomic inquiry conversion.',
    'CRM Staff',
    jsonb_build_object('source_inquiry_id', v_inquiry.id)
  );

  UPDATE public.inquiries
  SET status = 'converted', updated_at = now()
  WHERE id = p_inquiry_id;

  RETURN NEXT v_lead;
END;
$function$;

REVOKE ALL ON FUNCTION public.convert_inquiry_to_lead(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_inquiry_to_lead(UUID) TO authenticated;

COMMENT ON FUNCTION public.convert_inquiry_to_lead(UUID) IS
  'Atomically converts an inquiry into one linked CRM lead; serializes retries by inquiry ID and requires crm.manage.';

NOTIFY pgrst, 'reload schema';
COMMIT;
