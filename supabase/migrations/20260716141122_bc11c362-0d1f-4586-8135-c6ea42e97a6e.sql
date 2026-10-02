
-- 1. Add suspended flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

-- 2. Community blog posts table
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  excerpt text,
  body text NOT NULL,
  category text,
  cover_url text,
  author_name text,
  published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads published posts" ON public.community_posts
  FOR SELECT USING (published = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage posts" ON public.community_posts
  FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. Admin RPC: suspend / unsuspend user
CREATE OR REPLACE FUNCTION public.admin_set_user_suspended(_user_id uuid, _suspended boolean)
RETURNS profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p public.profiles;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.profiles SET suspended = _suspended WHERE id = _user_id RETURNING * INTO p;
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (_user_id, 'account',
    CASE WHEN _suspended THEN 'Account suspended' ELSE 'Account reactivated' END,
    CASE WHEN _suspended THEN 'Your account has been suspended by an administrator. Contact support for assistance.'
         ELSE 'Your account has been reactivated. You can continue trading.' END);
  RETURN p;
END; $$;

-- 4. Admin RPC: credit balance
CREATE OR REPLACE FUNCTION public.admin_credit_user_balance(_user_id uuid, _amount numeric, _note text)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_bal numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _amount = 0 THEN RAISE EXCEPTION 'Amount required'; END IF;
  UPDATE public.profiles SET balance = balance + _amount WHERE id = _user_id RETURNING balance INTO new_bal;
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (_user_id, 'balance',
    CASE WHEN _amount > 0 THEN 'Balance credited by admin' ELSE 'Balance adjusted by admin' END,
    'KES ' || _amount::text || COALESCE(' — ' || _note, '') || '. New balance: KES ' || new_bal::text || '.');
  RETURN new_bal;
END; $$;

-- 5. Admin RPC: send mail (dashboard notification + flag)
CREATE OR REPLACE FUNCTION public.admin_send_user_mail(_user_id uuid, _subject text, _body text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF length(coalesce(_subject,'')) = 0 OR length(coalesce(_body,'')) = 0 THEN RAISE EXCEPTION 'Subject and body required'; END IF;
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (_user_id, 'admin_mail', _subject, _body);
END; $$;

-- 6. Seed a few community posts
INSERT INTO public.community_posts (title, excerpt, body, category, author_name)
SELECT 'Welcome to ZiiDi Community', 'Trends, tips and testimonials from the ZiiDi trading floor.',
'ZiiDi Trader is regulated by CBK and CMA. Our community channel brings weekly market outlooks, member testimonials, and platform announcements.',
'Announcement', 'ZiiDi Team'
WHERE NOT EXISTS (SELECT 1 FROM public.community_posts);
