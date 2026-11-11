-- Extend role-based action permissions to Supabase Storage.
BEGIN;
DROP POLICY IF EXISTS "RBAC can upload tour media" ON storage.objects;
DROP POLICY IF EXISTS "RBAC can update tour media" ON storage.objects;
DROP POLICY IF EXISTS "RBAC can delete tour media" ON storage.objects;
CREATE POLICY "RBAC can upload tour media" ON storage.objects
 FOR INSERT TO authenticated
 WITH CHECK (bucket_id='tour-media' AND (public.has_permission('tours.create') OR public.has_permission('content.create')));
CREATE POLICY "RBAC can update tour media" ON storage.objects
 FOR UPDATE TO authenticated
 USING (bucket_id='tour-media' AND (public.has_permission('tours.update') OR public.has_permission('content.update')))
 WITH CHECK (bucket_id='tour-media' AND (public.has_permission('tours.update') OR public.has_permission('content.update')));
CREATE POLICY "RBAC can delete tour media" ON storage.objects
 FOR DELETE TO authenticated
 USING (bucket_id='tour-media' AND (public.has_permission('tours.delete') OR public.has_permission('content.delete')));
DROP POLICY IF EXISTS "RBAC finance can view vouchers" ON storage.objects;
DROP POLICY IF EXISTS "RBAC finance can upload vouchers" ON storage.objects;
DROP POLICY IF EXISTS "RBAC finance can update vouchers" ON storage.objects;
DROP POLICY IF EXISTS "RBAC finance can delete vouchers" ON storage.objects;
CREATE POLICY "RBAC finance can view vouchers" ON storage.objects
 FOR SELECT TO authenticated USING (bucket_id='vouchers' AND public.has_permission('finance.read'));
CREATE POLICY "RBAC finance can upload vouchers" ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (bucket_id='vouchers' AND public.has_permission('finance.create'));
CREATE POLICY "RBAC finance can update vouchers" ON storage.objects
 FOR UPDATE TO authenticated
 USING (bucket_id='vouchers' AND public.has_permission('finance.update'))
 WITH CHECK (bucket_id='vouchers' AND public.has_permission('finance.update'));
CREATE POLICY "RBAC finance can delete vouchers" ON storage.objects
 FOR DELETE TO authenticated USING (bucket_id='vouchers' AND public.has_permission('finance.delete'));
COMMIT;