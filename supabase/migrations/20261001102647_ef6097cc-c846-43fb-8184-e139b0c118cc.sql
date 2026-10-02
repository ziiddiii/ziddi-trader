CREATE OR REPLACE FUNCTION public.invest_in_plan(_plan_id uuid, _amount numeric)
RETURNS public.investments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.investment_plans; bal numeric; r public.investments;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF public.is_suspended(auth.uid()) THEN RAISE EXCEPTION 'Account suspended'; END IF;
  SELECT * INTO p FROM public.investment_plans WHERE id = _plan_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not available'; END IF;
  IF _amount < p.min_amount OR _amount > p.max_amount THEN
    RAISE EXCEPTION 'Amount must be between KES % and KES %', p.min_amount, p.max_amount; END IF;
  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF bal < _amount THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  UPDATE public.profiles SET balance = balance - _amount WHERE id = auth.uid();
  INSERT INTO public.investments(user_id, plan_id, plan_name, amount, interest_rate, duration_hours, expected_return, matures_at)
  VALUES (auth.uid(), p.id, p.name, _amount, p.interest_rate, p.duration_hours,
          _amount + _amount * p.interest_rate / 100, now() + make_interval(hours => p.duration_hours))
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.invest_in_plan(uuid, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.invest_in_plan(uuid, numeric) TO authenticated;
DROP POLICY IF EXISTS "Users create own investments" ON public.investments;