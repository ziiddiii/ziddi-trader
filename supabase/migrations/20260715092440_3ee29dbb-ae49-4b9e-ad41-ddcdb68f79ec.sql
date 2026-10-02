
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 10000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 4)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- listings
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ticker TEXT NOT NULL,
  company_name TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_per_share NUMERIC NOT NULL CHECK (price_per_share > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','paid','sold','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings visible to authenticated" ON public.listings FOR SELECT TO authenticated USING (true);
CREATE POLICY "sellers create listings" ON public.listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "seller or buyer update listing" ON public.listings FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id OR auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = seller_id OR auth.uid() = buyer_id);

-- messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages visible to buyer/seller" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND (l.seller_id = auth.uid() OR l.buyer_id = auth.uid()))
);
CREATE POLICY "buyer/seller send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND (l.seller_id = auth.uid() OR l.buyer_id = auth.uid()))
);

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.listings;

-- buyer initiates purchase
CREATE OR REPLACE FUNCTION public.start_purchase(_listing_id UUID)
RETURNS public.listings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.listings;
BEGIN
  UPDATE public.listings SET buyer_id = auth.uid(), status = 'pending'
   WHERE id = _listing_id AND status = 'active' AND seller_id <> auth.uid()
  RETURNING * INTO l;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
  RETURN l;
END; $$;
GRANT EXECUTE ON FUNCTION public.start_purchase(UUID) TO authenticated;

-- buyer marks paid: deducts buyer balance (escrow)
CREATE OR REPLACE FUNCTION public.mark_paid(_listing_id UUID)
RETURNS public.listings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.listings; total NUMERIC; buyer_balance NUMERIC;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Only the buyer can pay'; END IF;
  IF l.status <> 'pending' THEN RAISE EXCEPTION 'Listing not awaiting payment'; END IF;
  total := l.quantity * l.price_per_share;
  SELECT balance INTO buyer_balance FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF buyer_balance < total THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.profiles SET balance = balance - total WHERE id = auth.uid();
  UPDATE public.listings SET status = 'paid' WHERE id = _listing_id RETURNING * INTO l;
  RETURN l;
END; $$;
GRANT EXECUTE ON FUNCTION public.mark_paid(UUID) TO authenticated;

-- seller releases shares: credits seller balance, marks sold
CREATE OR REPLACE FUNCTION public.release_shares(_listing_id UUID)
RETURNS public.listings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.listings; total NUMERIC;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Only the seller can release'; END IF;
  IF l.status <> 'paid' THEN RAISE EXCEPTION 'Payment not received yet'; END IF;
  total := l.quantity * l.price_per_share;
  UPDATE public.profiles SET balance = balance + total WHERE id = l.seller_id;
  UPDATE public.listings SET status = 'sold' WHERE id = _listing_id RETURNING * INTO l;
  RETURN l;
END; $$;
GRANT EXECUTE ON FUNCTION public.release_shares(UUID) TO authenticated;

-- cancel (either side)
CREATE OR REPLACE FUNCTION public.cancel_purchase(_listing_id UUID)
RETURNS public.listings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.listings;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF auth.uid() NOT IN (l.seller_id, l.buyer_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF l.status <> 'pending' THEN RAISE EXCEPTION 'Cannot cancel'; END IF;
  UPDATE public.listings SET status = 'active', buyer_id = NULL WHERE id = _listing_id RETURNING * INTO l;
  RETURN l;
END; $$;
GRANT EXECUTE ON FUNCTION public.cancel_purchase(UUID) TO authenticated;
