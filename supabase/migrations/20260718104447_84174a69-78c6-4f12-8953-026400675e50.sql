ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  base_username text;
  final_username text;
  phone_val text;
BEGIN
  base_username := trim(COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Trader'));
  IF base_username = '' THEN
    base_username := 'Trader';
  END IF;

  final_username := base_username;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) THEN
    final_username := base_username || '_' || substr(NEW.id::text, 1, 6);
  END IF;

  phone_val := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone');

  INSERT INTO public.profiles (id, username, balance, phone)
  VALUES (NEW.id, final_username, 0, phone_val)
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, username text, balance numeric, suspended boolean, email text, phone text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, email_confirmed_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.balance,
    COALESCE(p.suspended, false) AS suspended,
    u.email::text AS email,
    COALESCE(p.phone, u.phone, u.raw_user_meta_data->>'phone')::text AS phone,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at DESC NULLS LAST;
END;
$function$;