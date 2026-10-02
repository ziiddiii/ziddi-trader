
-- Let admins read all messages and listings-scoped chats
DROP POLICY IF EXISTS "messages visible to buyer/seller" ON public.messages;
CREATE POLICY "messages visible to buyer/seller/admin"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = messages.listing_id
      AND (l.seller_id = auth.uid() OR l.buyer_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Admin sends a chat message impersonating the seller of a listing.
CREATE OR REPLACE FUNCTION public.admin_send_as_seller(_listing_id uuid, _content text)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.listings;
  m public.messages;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can send as seller';
  END IF;
  IF _content IS NULL OR length(trim(_content)) = 0 THEN
    RAISE EXCEPTION 'Message required';
  END IF;
  SELECT * INTO l FROM public.listings WHERE id = _listing_id;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;

  INSERT INTO public.messages (listing_id, sender_id, content)
  VALUES (_listing_id, l.seller_id, _content)
  RETURNING * INTO m;
  RETURN m;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_send_as_seller(uuid, text) TO authenticated;
