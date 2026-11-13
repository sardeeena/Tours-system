-- Restore the two draft invoice company snapshots changed during PR #122.
-- This intentionally touches only these two draft invoice numbers and preserves
-- all booking, customer, line-item, payment, and lifecycle fields.
UPDATE public.invoices
SET company_details = jsonb_build_object(
  'name', 'Kemet Spirit',
  'tagline', 'Tours and experiences',
  'address', '',
  'city', '',
  'country', '',
  'phone', '',
  'email', '',
  'website', 'kemetspirit.com',
  'taxRegistrationNumber', '',
  'commercialRegistryNumber', '',
  'bankName', '',
  'iban', '',
  'swiftBic', ''
)
WHERE invoice_number IN ('INV-2026-000001', 'INV-2026-000002')
  AND status = 'draft'
  AND company_details->>'name' = 'Awesome Adventure Tours';
