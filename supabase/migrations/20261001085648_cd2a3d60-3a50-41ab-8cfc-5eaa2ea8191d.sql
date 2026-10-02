ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_id text;

CREATE OR REPLACE FUNCTION public.gen_account_id() RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v text;
BEGIN
  LOOP
    v := 'ZD' || lpad((floor(random()*1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE account_id = v);
  END LOOP;
  RETURN v;
END $$;

UPDATE public.profiles SET account_id = public.gen_account_id() WHERE account_id IS NULL;
ALTER TABLE public.profiles ALTER COLUMN account_id SET DEFAULT public.gen_account_id();
ALTER TABLE public.profiles ALTER COLUMN account_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_account_id_key ON public.profiles(account_id);

CREATE TABLE public.transfer_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_amount numeric NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.transfer_settings TO authenticated, anon;
GRANT ALL ON public.transfer_settings TO service_role;
ALTER TABLE public.transfer_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read transfer settings" ON public.transfer_settings FOR SELECT USING (true);
INSERT INTO public.transfer_settings (min_amount) VALUES (50);

CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  amount numeric NOT NULL,
  recipient_label text,
  sender_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own transfers" ON public.transfers FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.find_transfer_recipient(_q text)
RETURNS TABLE(id uuid, username text, account_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE q text := upper(trim(_q)); d text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  d := regexp_replace(q, '\D', '', 'g');
  RETURN QUERY
  SELECT p.id, p.username, p.account_id FROM public.profiles p
  WHERE p.account_id = q
     OR (length(d) >= 9 AND p.phone IS NOT NULL
         AND right(regexp_replace(p.phone, '\D', '', 'g'), 9) = right(d, 9))
  LIMIT 1;
END $$;
REVOKE ALL ON FUNCTION public.find_transfer_recipient(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_transfer_recipient(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_funds(_recipient text, _amount numeric)
RETURNS public.transfers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r record; s record; mn numeric; t public.transfers;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_suspended(uid) THEN RAISE EXCEPTION 'Account suspended'; END IF;
  SELECT min_amount INTO mn FROM public.transfer_settings ORDER BY updated_at DESC LIMIT 1;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _amount < COALESCE(mn,0) THEN RAISE EXCEPTION 'Minimum transfer is KES %', mn; END IF;
  SELECT * INTO r FROM public.find_transfer_recipient(_recipient);
  IF r.id IS NULL THEN RAISE EXCEPTION 'Recipient not found'; END IF;
  IF r.id = uid THEN RAISE EXCEPTION 'You cannot send funds to yourself'; END IF;
  SELECT * INTO s FROM public.profiles WHERE id = uid FOR UPDATE;
  IF s.balance < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.profiles SET balance = balance - _amount WHERE id = uid;
  UPDATE public.profiles SET balance = balance + _amount WHERE id = r.id;
  INSERT INTO public.transfers(sender_id, recipient_id, amount, recipient_label, sender_label)
    VALUES (uid, r.id, _amount, r.username || ' (' || r.account_id || ')', s.username || ' (' || s.account_id || ')')
    RETURNING * INTO t;
  INSERT INTO public.notifications(user_id, kind, title, body) VALUES
    (uid, 'transfer', 'Funds sent', 'You sent KES ' || _amount || ' to ' || r.username || ' (' || r.account_id || ').'),
    (r.id, 'transfer', 'Funds received', 'You received KES ' || _amount || ' from ' || s.username || ' (' || s.account_id || ').');
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.transfer_funds(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_funds(text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_transfer_settings(_min numeric)
RETURNS public.transfer_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.transfer_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _min IS NULL OR _min < 0 THEN RAISE EXCEPTION 'Invalid minimum'; END IF;
  UPDATE public.transfer_settings SET min_amount=_min, updated_at=now(), updated_by=auth.uid()
    WHERE id = (SELECT id FROM public.transfer_settings ORDER BY updated_at DESC LIMIT 1) RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.admin_update_transfer_settings(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_transfer_settings(numeric) TO authenticated;