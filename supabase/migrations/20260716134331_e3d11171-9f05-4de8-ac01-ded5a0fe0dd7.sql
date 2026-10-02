
-- Create admin user and grant admin role
DO $$
DECLARE
  admin_uid uuid;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'admin@admin.com';
  IF admin_uid IS NULL THEN
    admin_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', admin_uid, 'authenticated', 'authenticated',
      'admin@admin.com', crypt('Admin', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"Admin"}'::jsonb,
      false, false
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), admin_uid,
      jsonb_build_object('sub', admin_uid::text, 'email', 'admin@admin.com', 'email_verified', true),
      'email', admin_uid::text, now(), now(), now());
  END IF;

  INSERT INTO public.profiles (id, username, balance)
  VALUES (admin_uid, 'Admin', 0)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
