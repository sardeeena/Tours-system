-- The trusted legacy admin provisioning function must not create staff access for unverified email accounts.
BEGIN;
CREATE OR REPLACE FUNCTION public.set_admin_role_by_email(target_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
 clean_email text; target_user_id uuid; target_user_metadata jsonb;
 target_email_confirmed_at timestamptz; existing_full_name text;
 verified_role text; provisioning_nonce text;
BEGIN
 IF session_user<>'postgres' AND COALESCE(auth.jwt()->>'role','')<>'service_role' THEN
  RAISE EXCEPTION 'Access Denied: administrator provisioning requires a trusted postgres or service_role context.' USING ERRCODE='42501';
 END IF;
 IF target_email IS NULL OR btrim(target_email)='' THEN RAISE EXCEPTION 'Target email cannot be null or empty.'; END IF;
 clean_email:=lower(btrim(target_email));
 SELECT u.id,u.raw_user_meta_data,u.email_confirmed_at
 INTO target_user_id,target_user_metadata,target_email_confirmed_at
 FROM auth.users u WHERE lower(u.email)=clean_email LIMIT 1;
 IF target_user_id IS NULL THEN RAISE EXCEPTION 'User with email "%" does not exist. The account must register first.',clean_email; END IF;
 IF target_email_confirmed_at IS NULL THEN RAISE EXCEPTION 'The target account must confirm its email before admin provisioning.'; END IF;
 SELECT p.full_name INTO existing_full_name FROM public.profiles p WHERE p.id=target_user_id;
 IF existing_full_name IS NULL OR btrim(existing_full_name)='' THEN
  existing_full_name:=COALESCE(target_user_metadata->>'full_name',
   nullif(btrim(COALESCE(target_user_metadata->>'first_name','')||' '||COALESCE(target_user_metadata->>'last_name','')),''),
   split_part(clean_email,'@',1));
 END IF;
 provisioning_nonce:=md5(gen_random_uuid()::text||clock_timestamp()::text||random()::text);
 PERFORM set_config('app.admin_provisioning_nonce',provisioning_nonce,true);
 PERFORM set_config('app.admin_provisioning_active_user',target_user_id::text,true);
 INSERT INTO public.profiles(id,email,full_name,role,is_confirmed,updated_at)
 VALUES(target_user_id,clean_email,COALESCE(existing_full_name,'Administrator'),'admin',true,now())
 ON CONFLICT(id) DO UPDATE SET role='admin',is_confirmed=true,updated_at=now();
 PERFORM set_config('app.admin_provisioning_nonce','',true);
 PERFORM set_config('app.admin_provisioning_active_user','',true);
 SELECT p.role INTO verified_role FROM public.profiles p WHERE p.id=target_user_id;
 IF verified_role IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Admin provisioning failed verification for %.',clean_email; END IF;
 UPDATE auth.users SET raw_app_meta_data=COALESCE(raw_app_meta_data,'{}'::jsonb)
  ||jsonb_build_object('role','admin','roles',jsonb_build_array('admin')) WHERE id=target_user_id;
 RETURN 'Success: confirmed account '||clean_email||' is now an active administrator with verified role "admin".';
END;
$function$;
COMMIT;