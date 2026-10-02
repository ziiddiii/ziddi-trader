REVOKE ALL ON FUNCTION public.admin_approve_withdrawal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_withdrawal(uuid) TO authenticated;