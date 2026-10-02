
-- Fix NULL text columns on auth.users that break GoTrue password grant
UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change IS NULL
   OR email_change_token_current IS NULL
   OR reauthentication_token IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL;

-- Reset the admin password to Admin123 and ensure confirmed
UPDATE auth.users
SET encrypted_password = crypt('Admin123', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'admin@admin.com';

-- If admin does not exist, create it
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token, phone_change, phone_change_token, raw_app_meta_data, raw_user_meta_data)
SELECT '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'admin@admin.com', crypt('Admin123', gen_salt('bf')), now(), now(), now(),
  '', '', '', '', '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb, '{"username":"Admin"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@admin.com');

-- Ensure admin role assignment
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'admin@admin.com'
ON CONFLICT DO NOTHING;

-- Ensure profile exists
INSERT INTO public.profiles (id, username, balance)
SELECT id, 'Admin', 0 FROM auth.users WHERE email = 'admin@admin.com'
ON CONFLICT (id) DO NOTHING;

-- Fix profiles table permission (per PostgREST hint in logs)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
