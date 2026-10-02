CREATE TABLE public.mpesa_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  remarks text NOT NULL DEFAULT 'Payout',
  occasion text,
  status text NOT NULL DEFAULT 'pending',
  conversation_id text,
  originator_conversation_id text,
  transaction_id text,
  receiver_name text,
  result_code text,
  result_desc text,
  raw_response jsonb,
  raw_result jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mpesa_payouts_conversation_idx ON public.mpesa_payouts (conversation_id);
CREATE INDEX mpesa_payouts_created_idx ON public.mpesa_payouts (created_at DESC);
GRANT SELECT ON public.mpesa_payouts TO authenticated;
GRANT ALL ON public.mpesa_payouts TO service_role;
ALTER TABLE public.mpesa_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view payouts" ON public.mpesa_payouts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.mpesa_balance_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending',
  conversation_id text,
  originator_conversation_id text,
  working_balance numeric,
  available_balance numeric,
  reserved_balance numeric,
  uncleared_balance numeric,
  result_code text,
  result_desc text,
  raw_response jsonb,
  raw_result jsonb,
  requested_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mpesa_balance_conversation_idx ON public.mpesa_balance_checks (conversation_id);
GRANT SELECT ON public.mpesa_balance_checks TO authenticated;
GRANT ALL ON public.mpesa_balance_checks TO service_role;
ALTER TABLE public.mpesa_balance_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view balance checks" ON public.mpesa_balance_checks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER mpesa_payouts_updated_at BEFORE UPDATE ON public.mpesa_payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER mpesa_balance_checks_updated_at BEFORE UPDATE ON public.mpesa_balance_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();