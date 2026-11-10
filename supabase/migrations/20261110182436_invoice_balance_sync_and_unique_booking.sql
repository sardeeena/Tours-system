-- Keep invoice balances synchronized with settled payments and processed refunds.
-- Enforce one invoice per booking; the application already treats invoices as one-to-one.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.invoices
    GROUP BY booking_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce one invoice per booking: duplicate invoice rows exist. Reconcile them before applying this migration.';
  END IF;
END;
$$;

DROP INDEX IF EXISTS public.idx_invoices_booking_id;
CREATE UNIQUE INDEX idx_invoices_booking_id
  ON public.invoices (booking_id);

CREATE OR REPLACE FUNCTION public.sync_invoice_financial_totals(p_booking_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_paid NUMERIC := 0;
  v_refunded NUMERIC := 0;
  v_net_paid NUMERIC := 0;
BEGIN
  SELECT *
  INTO v_invoice
  FROM public.invoices
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(pt.amount), 0)
  INTO v_paid
  FROM public.payment_transactions AS pt
  WHERE pt.booking_id = p_booking_id
    AND pt.currency = v_invoice.currency
    AND pt.status IN ('Paid', 'Partially Paid');

  SELECT COALESCE(SUM(COALESCE(r.approved_amount, r.requested_amount, r.amount)), 0)
  INTO v_refunded
  FROM public.refund_records AS r
  WHERE r.booking_id = p_booking_id
    AND r.currency = v_invoice.currency
    AND r.status = 'processed'
    AND (
      r.payment_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.payment_transactions AS linked_payment
        WHERE linked_payment.id = r.payment_id
          AND linked_payment.status IN ('Paid', 'Partially Paid')
      )
    );

  v_net_paid := GREATEST(0, v_paid - v_refunded);

  UPDATE public.invoices
  SET paid = v_net_paid,
      balance = GREATEST(0, v_invoice.total - v_net_paid),
      status = CASE
        WHEN v_invoice.status IN ('draft', 'cancelled') THEN v_invoice.status
        WHEN v_net_paid >= v_invoice.total THEN 'paid'
        WHEN v_net_paid > 0 THEN 'partially_paid'
        WHEN v_invoice.status = 'overdue' THEN 'overdue'
        ELSE 'issued'
      END,
      updated_at = NOW()
  WHERE id = v_invoice.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_invoice_financial_totals_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.booking_id IS DISTINCT FROM NEW.booking_id THEN
      PERFORM public.sync_invoice_financial_totals(OLD.booking_id);
    END IF;
  END IF;

  PERFORM public.sync_invoice_financial_totals(NEW.booking_id);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_invoice_financial_totals(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_invoice_financial_totals_trigger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_invoice_financial_totals ON public.payment_transactions;
CREATE TRIGGER trg_sync_invoice_financial_totals
AFTER INSERT OR UPDATE OF booking_id, amount, currency, status
ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_invoice_financial_totals_trigger();

DROP TRIGGER IF EXISTS trg_sync_invoice_financial_totals ON public.refund_records;
CREATE TRIGGER trg_sync_invoice_financial_totals
AFTER INSERT OR UPDATE OF booking_id, amount, currency, status, approved_amount, requested_amount
ON public.refund_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_invoice_financial_totals_trigger();

DROP TRIGGER IF EXISTS trg_sync_invoice_financial_totals ON public.invoices;
CREATE TRIGGER trg_sync_invoice_financial_totals
AFTER INSERT OR UPDATE OF booking_id, total, currency
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_invoice_financial_totals_trigger();

COMMIT;
