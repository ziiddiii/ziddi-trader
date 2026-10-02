
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS chat_closed_at TIMESTAMPTZ;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS chat_closed_by UUID;

CREATE OR REPLACE FUNCTION public.close_listing_chat(_listing_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.listings%ROWTYPE;
  v_is_admin BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_row FROM public.listings WHERE id = _listing_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  SELECT public.has_role(v_uid, 'admin') INTO v_is_admin;
  IF v_uid <> v_row.seller_id AND v_uid <> COALESCE(v_row.buyer_id, '00000000-0000-0000-0000-000000000000'::uuid) AND NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Not authorised to close this chat';
  END IF;
  UPDATE public.listings SET chat_closed_at = now(), chat_closed_by = v_uid WHERE id = _listing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.close_listing_chat(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_listing_chat(UUID) TO authenticated;
