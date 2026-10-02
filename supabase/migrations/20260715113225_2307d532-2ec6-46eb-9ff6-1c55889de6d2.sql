CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
BEGIN
  base_username := trim(COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Trader'));
  IF base_username = '' THEN
    base_username := 'Trader';
  END IF;

  final_username := base_username;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) THEN
    final_username := base_username || '_' || substr(NEW.id::text, 1, 6);
  END IF;

  INSERT INTO public.profiles (id, username, balance)
  VALUES (NEW.id, final_username, 0)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;