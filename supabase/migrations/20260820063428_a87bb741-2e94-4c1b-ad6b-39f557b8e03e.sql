CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Trusted server-side routines run as the function owner (e.g. postgres) and
  -- are allowed to move balances. Direct client updates run as anon/authenticated.
  IF current_user IN ('anon', 'authenticated')
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.balance IS DISTINCT FROM OLD.balance THEN
      RAISE EXCEPTION 'Balance cannot be modified directly';
    END IF;
    IF COALESCE(NEW.suspended,false) IS DISTINCT FROM COALESCE(OLD.suspended,false) THEN
      RAISE EXCEPTION 'Suspension status cannot be modified directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;