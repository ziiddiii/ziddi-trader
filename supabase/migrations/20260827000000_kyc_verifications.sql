CREATE TABLE IF NOT EXISTS public.kyc_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  id_type text NOT NULL,
  id_number text NOT NULL,
  id_front_url text,
  id_back_url text,
  selfie_url text,
  status text NOT NULL DEFAULT 'pending',
  reject_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.kyc_verifications TO authenticated;
GRANT ALL ON public.kyc_verifications TO service_role;

ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc own select" ON public.kyc_verifications;
CREATE POLICY "kyc own select" ON public.kyc_verifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "kyc admin update" ON public.kyc_verifications;
CREATE POLICY "kyc admin update" ON public.kyc_verifications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.submit_kyc(
  _full_name text, _id_type text, _id_number text,
  _id_front text, _id_back text, _selfie text)
RETURNS public.kyc_verifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.kyc_verifications;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.kyc_verifications (user_id, full_name, id_type, id_number, id_front_url, id_back_url, selfie_url, status, reject_reason, updated_at)
  VALUES (auth.uid(), _full_name, _id_type, _id_number, NULLIF(_id_front,''), NULLIF(_id_back,''), NULLIF(_selfie,''), 'pending', NULL, now())
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name, id_type = EXCLUDED.id_type, id_number = EXCLUDED.id_number,
    id_front_url = EXCLUDED.id_front_url, id_back_url = EXCLUDED.id_back_url, selfie_url = EXCLUDED.selfie_url,
    status = 'pending', reject_reason = NULL, reviewed_at = NULL, reviewed_by = NULL, updated_at = now()
  RETURNING * INTO r;
  RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_approve_kyc(_id uuid)
RETURNS public.kyc_verifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.kyc_verifications;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.kyc_verifications SET status='verified', reject_reason=NULL, reviewed_at=now(), reviewed_by=auth.uid(), updated_at=now()
  WHERE id=_id RETURNING * INTO r;
  RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reject_kyc(_id uuid, _reason text)
RETURNS public.kyc_verifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.kyc_verifications;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.kyc_verifications SET status='rejected', reject_reason=_reason, reviewed_at=now(), reviewed_by=auth.uid(), updated_at=now()
  WHERE id=_id RETURNING * INTO r;
  RETURN r;
END; $$;

REVOKE ALL ON FUNCTION public.submit_kyc(text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_approve_kyc(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reject_kyc(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_kyc(text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_kyc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_kyc(uuid,text) TO authenticated;
