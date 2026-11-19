-- Regression assertions for the atomic booking pricing and notice guard.
BEGIN;
DO $test$
DECLARE
  v_definition text := pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  );
BEGIN
  IF position('v_tour.child_price' in v_definition) = 0 THEN
    RAISE EXCEPTION 'Atomic booking must use the configured tour child_price.';
  END IF;
  IF position('v_departure_at' in v_definition) = 0
     OR position('minimum_booking_notice_hours' in v_definition) = 0
     OR position('Africa/Cairo' in v_definition) = 0 THEN
    RAISE EXCEPTION 'Atomic booking must enforce the configured Egypt-local minimum booking notice.';
  END IF;
  IF position('v_tour.price * 0.50' in v_definition) > 0 THEN
    RAISE EXCEPTION 'Atomic booking must not use the adult-price 50 percent rule when child_price is configured.';
  END IF;
END;
$test$;
ROLLBACK;
