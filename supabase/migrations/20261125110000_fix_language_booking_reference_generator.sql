BEGIN;

-- The public guest-checkout path is:
-- create_booking_atomic_with_departure -> create_booking_atomic_with_locale
-- -> create_booking_atomic_with_language -> private.create_booking_atomic(..., p_tour_language).
-- The 20261125090000 migration updated the reference generator, but this 19-argument
-- overload still generated the old RST + UUID value and bypassed that generator.
--
-- Patch only the reference allocation and insert retry block. All pricing,
-- availability, customer, locale, pickup, payment, idempotency and audit logic
-- in the existing atomic function remains unchanged.
DO $migration$
DECLARE
  v_signature regprocedure := to_regprocedure(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'
  );
  v_definition text;
  v_rewritten text;
  v_old_start constant text := $old$
    -- 10. Generate Authoritative Unpredictable Booking Reference
    v_booking_ref := 'RST-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || UPPER(REPLACE(gen_random_uuid()::text, '-', ''));

    -- 11. Insert Authoritative Booking Record with Idempotency Key & Concurrency Protection
    BEGIN
$old$;
  v_new_start constant text := $new$
    -- 10. Generate Authoritative Compact Booking Reference
    LOOP
        v_booking_ref := private.generate_booking_reference(p_booking_date);

    -- 11. Insert Authoritative Booking Record with Idempotency Key & Collision Protection
    BEGIN
$new$;
  v_old_end constant text := $old$
        END IF;
        RAISE;
    END;

    -- 12. Persist Immutable Booking Extras Snapshot
$old$;
  v_new_end constant text := $new$
        END IF;

        -- A concurrent request may have allocated the same random reference
        -- after the generator's existence check. Retry only that collision;
        -- preserve the existing idempotency and unrelated-constraint behavior.
        IF EXISTS (
            SELECT 1
            FROM public.bookings
            WHERE booking_reference = v_booking_ref
        ) THEN
            CONTINUE;
        END IF;

        RAISE;
    END;
    END LOOP;

    -- 12. Persist Immutable Booking Extras Snapshot
$new$;
BEGIN
  IF v_signature IS NULL THEN
    RAISE EXCEPTION 'Expected language-aware atomic booking function overload was not found.';
  END IF;

  v_definition := pg_get_functiondef(v_signature);

  IF position('private.generate_booking_reference(p_booking_date)' IN v_definition) > 0
     AND position('RST-' IN v_definition) = 0 THEN
    -- Already corrected; keep the migration safe to re-run.
    RETURN;
  END IF;

  IF position(v_old_start IN v_definition) = 0
     OR position(v_old_end IN v_definition) = 0 THEN
    RAISE EXCEPTION 'The expected legacy booking-reference block did not match; refusing to rewrite the booking function.';
  END IF;

  v_rewritten := replace(v_definition, v_old_start, v_new_start);
  v_rewritten := replace(v_rewritten, v_old_end, v_new_end);

  IF v_rewritten = v_definition
     OR position('private.generate_booking_reference(p_booking_date)' IN v_rewritten) = 0
     OR position('RST-' IN v_rewritten) > 0 THEN
    RAISE EXCEPTION 'Booking-reference function rewrite did not produce the expected compact-only implementation.';
  END IF;

  EXECUTE v_rewritten;
END;
$migration$;

COMMIT;
