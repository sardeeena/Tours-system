-- Remove the company_info row inserted during PR #122.
-- The pre-PR application falls back to DEFAULT_COMPANY_SETTINGS when this row
-- is absent. Guard on the original insertion timestamp so later edits are not
-- accidentally removed.
DELETE FROM public.site_settings
WHERE key = 'company_info'
  AND updated_at = '2026-11-13 01:59:28.406+00';
