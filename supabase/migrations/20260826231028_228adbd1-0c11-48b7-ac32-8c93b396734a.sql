CREATE OR REPLACE FUNCTION public._setup_exec(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
BEGIN
  EXECUTE sql;
END;
$fn$;
REVOKE ALL ON FUNCTION public._setup_exec(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._setup_exec(text) TO sandbox_exec;