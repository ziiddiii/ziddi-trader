-- Creates/resets admin login: admin@admin.com / Admin123 (run after the other files)
create extension if not exists pgcrypto;
do $$
declare uid uuid;
begin
  select id into uid from auth.users where email='admin@admin.com';
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated','admin@admin.com',crypt('Admin123',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Admin"}',now(),now(),'','','','');
    insert into auth.identities (id,user_id,provider_id,identity_data,provider,created_at,updated_at,last_sign_in_at)
    values (gen_random_uuid(),uid,uid::text,jsonb_build_object('sub',uid::text,'email','admin@admin.com','email_verified',true),'email',now(),now(),now());
  else
    update auth.users set encrypted_password=crypt('Admin123',gen_salt('bf')), email_confirmed_at=coalesce(email_confirmed_at,now()) where id=uid;
  end if;
  insert into public.user_roles(user_id,role) values (uid,'admin') on conflict do nothing;
end $$;
