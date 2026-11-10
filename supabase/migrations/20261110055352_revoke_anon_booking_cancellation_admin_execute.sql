-- The cancellation resolver is an administrative RPC. It must not be callable by guests.
REVOKE ALL ON FUNCTION public.admin_resolve_booking_cancellation(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
