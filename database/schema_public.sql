--
-- PostgreSQL database dump
--

\restrict FFibSB3dkhrRyKW3OKOdKcp21Q3mm5DVcFy14Hswciy4fumOGIhiB10YzbfmnNt

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'SQL_ASCII';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deposits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric NOT NULL,
    phone text NOT NULL,
    tx_ref text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_note text,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    checkout_request_id text,
    merchant_request_id text,
    mpesa_receipt text,
    channel text DEFAULT 'manual'::text NOT NULL
);

ALTER TABLE ONLY public.deposits REPLICA IDENTITY FULL;


--
-- Name: admin_approve_deposit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_approve_deposit(_id uuid) RETURNS public.deposits
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE d public.deposits;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO d FROM public.deposits WHERE id = _id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Deposit not found'; END IF;
  IF d.status = 'approved' THEN RETURN d; END IF;

  UPDATE public.profiles SET balance = COALESCE(balance,0) + d.amount WHERE id = d.user_id;
  UPDATE public.deposits SET status = 'approved', approved_at = now(), updated_at = now()
    WHERE id = _id RETURNING * INTO d;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (d.user_id, 'deposit', 'Deposit approved — account credited',
    'Your M-PESA deposit of KES ' || d.amount::text || ' has been confirmed and credited to your ZiiDi account balance.');
  RETURN d;
END;
$$;


--
-- Name: kyc_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kyc_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text NOT NULL,
    id_type text NOT NULL,
    id_number text NOT NULL,
    id_front_url text,
    id_back_url text,
    selfie_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    reject_reason text,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_approve_kyc(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_approve_kyc(_id uuid) RETURNS public.kyc_verifications
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r public.kyc_verifications;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.kyc_verifications SET status='verified', reject_reason=NULL, reviewed_at=now(), reviewed_by=auth.uid(), updated_at=now()
  WHERE id=_id RETURNING * INTO r;
  RETURN r;
END; $$;


--
-- Name: listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    buyer_id uuid,
    ticker text NOT NULL,
    company_name text,
    quantity integer NOT NULL,
    price_per_share numeric NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pending_at timestamp with time zone,
    seller_name text,
    logo_url text,
    chat_closed_at timestamp with time zone,
    chat_closed_by uuid,
    change_percent numeric DEFAULT 0 NOT NULL,
    min_buy_amount numeric,
    CONSTRAINT listings_price_per_share_check CHECK ((price_per_share > (0)::numeric)),
    CONSTRAINT listings_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT listings_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'paid'::text, 'sold'::text, 'cancelled'::text])))
);


--
-- Name: admin_approve_payment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_approve_payment(_listing_id uuid) RETURNS public.listings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  l public.listings;
  total numeric;
  existing public.holdings;
  new_qty integer;
  new_avg numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve payments';
  END IF;

  SELECT * INTO l FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.status <> 'paid' THEN RAISE EXCEPTION 'Trade is not awaiting approval'; END IF;

  total := l.quantity * l.price_per_share;
  UPDATE public.profiles SET balance = balance + total WHERE id = l.seller_id;

  SELECT * INTO existing FROM public.holdings
    WHERE user_id = l.buyer_id AND ticker = l.ticker FOR UPDATE;
  IF existing.id IS NULL THEN
    INSERT INTO public.holdings (user_id, ticker, company_name, quantity, avg_price)
      VALUES (l.buyer_id, l.ticker, l.company_name, l.quantity, l.price_per_share);
  ELSE
    new_qty := existing.quantity + l.quantity;
    new_avg := ((existing.quantity * existing.avg_price) + (l.quantity * l.price_per_share)) / new_qty;
    UPDATE public.holdings
      SET quantity = new_qty, avg_price = new_avg, updated_at = now()
      WHERE id = existing.id;
  END IF;

  UPDATE public.listings SET status = 'sold' WHERE id = _listing_id RETURNING * INTO l;
  RETURN l;
END; $$;


--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric NOT NULL,
    method text NOT NULL,
    destination text NOT NULL,
    status text DEFAULT 'processing'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tax_paid_at timestamp with time zone,
    tax_tx_code text,
    CONSTRAINT withdrawals_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: admin_approve_withdrawal(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_approve_withdrawal(_id uuid) RETURNS public.withdrawals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE w public.withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;

  SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL OR w.status NOT IN ('pending','processing') THEN
    RAISE EXCEPTION 'Withdrawal not pending';
  END IF;

  UPDATE public.withdrawals SET status='completed' WHERE id=_id RETURNING * INTO w;
  RETURN w;
END; $$;


--
-- Name: autoinvest_passkeys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autoinvest_passkeys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    min_amount numeric NOT NULL,
    duration_days integer NOT NULL,
    return_percent numeric NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    used_by uuid,
    used_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    max_amount numeric DEFAULT 1000000 NOT NULL,
    CONSTRAINT autoinvest_passkeys_duration_days_check CHECK ((duration_days > 0)),
    CONSTRAINT autoinvest_passkeys_min_amount_check CHECK ((min_amount > (0)::numeric)),
    CONSTRAINT autoinvest_passkeys_return_percent_check CHECK ((return_percent >= (0)::numeric))
);


--
-- Name: admin_create_passkey(text, numeric, numeric, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_create_passkey(_code text, _min_amount numeric, _max_amount numeric, _duration_days integer, _return_percent numeric) RETURNS public.autoinvest_passkeys
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE p public.autoinvest_passkeys;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _min_amount <= 0 OR _max_amount <= 0 OR _max_amount < _min_amount
     OR _duration_days <= 0 OR _return_percent < 0 THEN
    RAISE EXCEPTION 'Invalid values';
  END IF;
  INSERT INTO public.autoinvest_passkeys
    (code, min_amount, max_amount, duration_days, return_percent, created_by)
  VALUES (upper(trim(_code)), _min_amount, _max_amount, _duration_days, _return_percent, auth.uid())
  RETURNING * INTO p;
  RETURN p;
END; $$;


--
-- Name: admin_credit_user_balance(uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_credit_user_balance(_user_id uuid, _amount numeric, _note text) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: admin_list_users(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_users() RETURNS TABLE(id uuid, username text, balance numeric, suspended boolean, email text, phone text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, email_confirmed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.balance,
    COALESCE(p.suspended, false) AS suspended,
    u.email::text AS email,
    COALESCE(p.phone, u.phone, u.raw_user_meta_data->>'phone')::text AS phone,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at DESC NULLS LAST;
END;
$$;


--
-- Name: admin_reject_deposit(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_reject_deposit(_id uuid, _note text DEFAULT NULL::text) RETURNS public.deposits
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE d public.deposits;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.deposits SET status = 'rejected', admin_note = _note, updated_at = now()
    WHERE id = _id AND status <> 'approved' RETURNING * INTO d;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Deposit not found or already approved'; END IF;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (d.user_id, 'deposit', 'Deposit could not be confirmed',
    'We could not confirm your M-PESA deposit of KES ' || d.amount::text ||
    COALESCE('. Reason: ' || _note, '.') || ' Please contact ZiiDi customer care.');
  RETURN d;
END;
$$;


--
-- Name: admin_reject_kyc(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_reject_kyc(_id uuid, _reason text) RETURNS public.kyc_verifications
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r public.kyc_verifications;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.kyc_verifications SET status='rejected', reject_reason=_reason, reviewed_at=now(), reviewed_by=auth.uid(), updated_at=now()
  WHERE id=_id RETURNING * INTO r;
  RETURN r;
END; $$;


--
-- Name: admin_reject_withdrawal(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_reject_withdrawal(_id uuid, _reason text) RETURNS public.withdrawals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE w public.withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL OR w.status NOT IN ('pending','processing') THEN
    RAISE EXCEPTION 'Withdrawal not pending';
  END IF;
  UPDATE public.withdrawals SET status='rejected' WHERE id=_id RETURNING * INTO w;
  UPDATE public.profiles SET balance = balance + w.amount WHERE id = w.user_id;
  INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (w.user_id, 'withdrawal', 'Withdrawal rejected',
      'Your withdrawal of KES ' || w.amount::text || ' was rejected. Reason: ' || COALESCE(_reason,'not specified') || '. The amount has been returned to your balance.');
  RETURN w;
END; $$;


--
-- Name: disputes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disputes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    opened_by uuid NOT NULL,
    opened_role text NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    resolution text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT disputes_opened_role_check CHECK ((opened_role = ANY (ARRAY['buyer'::text, 'seller'::text]))),
    CONSTRAINT disputes_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'dismissed'::text])))
);


--
-- Name: admin_resolve_dispute(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_resolve_dispute(_id uuid, _action text, _resolution text) RETURNS public.disputes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE d public.disputes; l public.listings; total NUMERIC; existing public.holdings; new_qty INT; new_avg NUMERIC;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO d FROM public.disputes WHERE id = _id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Dispute not found'; END IF;
  IF d.status <> 'open' THEN RAISE EXCEPTION 'Dispute already closed'; END IF;

  SELECT * INTO l FROM public.listings WHERE id = d.listing_id FOR UPDATE;

  IF _action = 'release' THEN
    -- release shares to buyer (like admin_approve_payment)
    IF l.status IN ('pending','paid') THEN
      total := l.quantity * l.price_per_share;
      UPDATE public.profiles SET balance = balance + total WHERE id = l.seller_id;
      SELECT * INTO existing FROM public.holdings WHERE user_id = l.buyer_id AND ticker = l.ticker FOR UPDATE;
      IF existing.id IS NULL THEN
        INSERT INTO public.holdings (user_id, ticker, company_name, quantity, avg_price)
        VALUES (l.buyer_id, l.ticker, l.company_name, l.quantity, l.price_per_share);
      ELSE
        new_qty := existing.quantity + l.quantity;
        new_avg := ((existing.quantity * existing.avg_price) + (l.quantity * l.price_per_share)) / new_qty;
        UPDATE public.holdings SET quantity = new_qty, avg_price = new_avg, updated_at = now() WHERE id = existing.id;
      END IF;
      UPDATE public.listings SET status = 'sold' WHERE id = l.id;
    END IF;
    IF l.buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
      VALUES (l.buyer_id, l.id, 'dispute',
        'Dispute resolved in your favour',
        'ZiiDi Customer Care has released ' || l.quantity || ' × ' || l.ticker || ' shares to your portfolio.');
    END IF;
  ELSIF _action = 'refund' THEN
    -- cancel listing back to active with no buyer
    IF l.status IN ('pending','paid') THEN
      UPDATE public.listings SET status = 'active', buyer_id = NULL, pending_at = NULL WHERE id = l.id;
    END IF;
    IF d.opened_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
      VALUES (d.opened_by, l.id, 'dispute',
        'Dispute resolved — trade cancelled',
        'ZiiDi Customer Care cancelled the trade for ' || l.quantity || ' × ' || l.ticker || '. If you had paid, contact support with proof of payment.');
    END IF;
  ELSIF _action = 'dismiss' THEN
    IF d.opened_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
      VALUES (d.opened_by, l.id, 'dispute',
        'Dispute reviewed by ZiiDi Customer Care',
        COALESCE(_resolution,'After review, no action was required. Repeated false disputes may lead to account suspension.'));
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;

  UPDATE public.disputes SET
    status = CASE WHEN _action = 'dismiss' THEN 'dismissed' ELSE 'resolved' END,
    resolution = _resolution,
    resolved_by = auth.uid(),
    resolved_at = now(),
    updated_at = now()
  WHERE id = _id RETURNING * INTO d;

  RETURN d;
END; $$;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_send_as_seller(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_send_as_seller(_listing_id uuid, _content text) RETURNS public.messages
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: admin_send_user_mail(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_send_user_mail(_user_id uuid, _subject text, _body text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF length(coalesce(_subject,'')) = 0 OR length(coalesce(_body,'')) = 0 THEN RAISE EXCEPTION 'Subject and body required'; END IF;
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (_user_id, 'admin_mail', _subject, _body);
END; $$;


--
-- Name: withdrawal_tax_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawal_tax_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tax_percent numeric DEFAULT 15 NOT NULL,
    till_number text DEFAULT ''::text NOT NULL,
    till_business_name text DEFAULT ''::text NOT NULL,
    paybill_number text DEFAULT ''::text NOT NULL,
    paybill_account text DEFAULT ''::text NOT NULL,
    instructions text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    active_method text DEFAULT 'till'::text NOT NULL,
    min_withdrawal numeric DEFAULT 500 NOT NULL,
    max_withdrawal numeric DEFAULT 1000000 NOT NULL,
    tax_enabled boolean DEFAULT true NOT NULL,
    CONSTRAINT withdrawal_tax_settings_active_method_check CHECK ((active_method = ANY (ARRAY['till'::text, 'paybill'::text])))
);


--
-- Name: admin_set_tax_enabled(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_tax_enabled(_enabled boolean) RETURNS public.withdrawal_tax_settings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r public.withdrawal_tax_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.withdrawal_tax_settings SET tax_enabled = _enabled, updated_at = now()
   WHERE id = (SELECT id FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1) RETURNING * INTO r;
  RETURN r;
END $$;


--
-- Name: gen_account_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gen_account_id() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE v text;
BEGIN
  LOOP
    v := 'ZD' || lpad((floor(random()*1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE account_id = v);
  END LOOP;
  RETURN v;
END $$;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    balance numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    suspended boolean DEFAULT false NOT NULL,
    phone text,
    account_id text DEFAULT public.gen_account_id() NOT NULL
);

ALTER TABLE ONLY public.profiles REPLICA IDENTITY FULL;


--
-- Name: admin_set_user_suspended(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_user_suspended(_user_id uuid, _suspended boolean) RETURNS public.profiles
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: admin_toggle_passkey(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_toggle_passkey(_id uuid, _active boolean) RETURNS public.autoinvest_passkeys
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE p public.autoinvest_passkeys;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.autoinvest_passkeys SET is_active = _active, updated_at = now() WHERE id = _id RETURNING * INTO p;
  RETURN p;
END; $$;


--
-- Name: lock_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lock_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    min_amount numeric DEFAULT 100 NOT NULL,
    max_amount numeric DEFAULT 10000000 NOT NULL,
    lock_period_hours integer DEFAULT 24 NOT NULL,
    daily_rate numeric DEFAULT 0.07 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_update_lock_settings(numeric, numeric, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_lock_settings(_min_amount numeric, _max_amount numeric, _lock_period_hours integer, _daily_rate numeric) RETURNS public.lock_settings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE s public.lock_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _min_amount <= 0 OR _max_amount <= 0 OR _max_amount < _min_amount THEN RAISE EXCEPTION 'Invalid amounts'; END IF;
  IF _lock_period_hours < 1 THEN RAISE EXCEPTION 'Lock period must be at least 1 hour'; END IF;
  IF _daily_rate < 0 OR _daily_rate > 1 THEN RAISE EXCEPTION 'Daily rate must be 0-1'; END IF;
  UPDATE public.lock_settings SET
    min_amount = _min_amount, max_amount = _max_amount,
    lock_period_hours = _lock_period_hours, daily_rate = _daily_rate,
    updated_at = now()
  RETURNING * INTO s;
  RETURN s;
END; $$;


--
-- Name: stock_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    min_total numeric DEFAULT 25000 NOT NULL,
    max_total numeric DEFAULT 2000000 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    default_min_buy numeric DEFAULT 25000 NOT NULL
);


--
-- Name: admin_update_stock_settings(numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_stock_settings(_min numeric, _max numeric) RETURNS public.stock_settings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r public.stock_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _min <= 0 OR _max <= 0 OR _min > _max THEN RAISE EXCEPTION 'Invalid range'; END IF;
  SELECT * INTO r FROM public.stock_settings ORDER BY updated_at DESC LIMIT 1;
  IF r.id IS NULL THEN
    INSERT INTO public.stock_settings (min_total, max_total, updated_by) VALUES (_min, _max, auth.uid()) RETURNING * INTO r;
  ELSE
    UPDATE public.stock_settings SET min_total=_min, max_total=_max, updated_at=now(), updated_by=auth.uid()
      WHERE id=r.id RETURNING * INTO r;
  END IF;
  RETURN r;
END; $$;


--
-- Name: admin_update_stock_settings(numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_stock_settings(_min numeric, _max numeric, _default_min_buy numeric) RETURNS public.stock_settings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE s public.stock_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _min <= 0 OR _max <= 0 OR _min > _max THEN RAISE EXCEPTION 'Invalid range'; END IF;
  IF _default_min_buy <= 0 THEN RAISE EXCEPTION 'Invalid minimum buy amount'; END IF;

  SELECT * INTO s FROM public.stock_settings ORDER BY updated_at DESC LIMIT 1;
  IF s.id IS NULL THEN
    INSERT INTO public.stock_settings (min_total, max_total, default_min_buy, updated_by)
    VALUES (_min, _max, _default_min_buy, auth.uid()) RETURNING * INTO s;
  ELSE
    UPDATE public.stock_settings
      SET min_total = _min, max_total = _max, default_min_buy = _default_min_buy,
          updated_at = now(), updated_by = auth.uid()
      WHERE id = s.id RETURNING * INTO s;
  END IF;
  RETURN s;
END; $$;


--
-- Name: admin_update_tax_settings(numeric, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_tax_settings(_tax_percent numeric, _till_number text, _till_business_name text, _paybill_number text, _paybill_account text, _instructions text) RETURNS public.withdrawal_tax_settings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r public.withdrawal_tax_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _tax_percent < 0 OR _tax_percent > 100 THEN RAISE EXCEPTION 'Invalid percent'; END IF;

  SELECT * INTO r FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1;
  IF r.id IS NULL THEN
    INSERT INTO public.withdrawal_tax_settings
      (tax_percent, till_number, till_business_name, paybill_number, paybill_account, instructions, updated_by)
    VALUES (_tax_percent, coalesce(_till_number,''), coalesce(_till_business_name,''),
            coalesce(_paybill_number,''), coalesce(_paybill_account,''), coalesce(_instructions,''), auth.uid())
    RETURNING * INTO r;
  ELSE
    UPDATE public.withdrawal_tax_settings SET
      tax_percent = _tax_percent,
      till_number = coalesce(_till_number,''),
      till_business_name = coalesce(_till_business_name,''),
      paybill_number = coalesce(_paybill_number,''),
      paybill_account = coalesce(_paybill_account,''),
      instructions = coalesce(_instructions,''),
      updated_at = now(),
      updated_by = auth.uid()
    WHERE id = r.id
    RETURNING * INTO r;
  END IF;
  RETURN r;
END; $$;


--
-- Name: admin_update_tax_settings(numeric, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_tax_settings(_tax_percent numeric, _till_number text, _till_business_name text, _paybill_number text, _paybill_account text, _instructions text, _active_method text DEFAULT 'till'::text) RETURNS public.withdrawal_tax_settings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r public.withdrawal_tax_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _tax_percent < 0 OR _tax_percent > 100 THEN RAISE EXCEPTION 'Invalid percent'; END IF;
  IF _active_method NOT IN ('till','paybill') THEN _active_method := 'till'; END IF;

  SELECT * INTO r FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1;
  IF r.id IS NULL THEN
    INSERT INTO public.withdrawal_tax_settings
      (tax_percent, till_number, till_business_name, paybill_number, paybill_account, instructions, active_method, updated_by)
    VALUES (_tax_percent, coalesce(_till_number,''), coalesce(_till_business_name,''),
            coalesce(_paybill_number,''), coalesce(_paybill_account,''), coalesce(_instructions,''), _active_method, auth.uid())
    RETURNING * INTO r;
  ELSE
    UPDATE public.withdrawal_tax_settings SET
      tax_percent = _tax_percent,
      till_number = coalesce(_till_number,''),
      till_business_name = coalesce(_till_business_name,''),
      paybill_number = coalesce(_paybill_number,''),
      paybill_account = coalesce(_paybill_account,''),
      instructions = coalesce(_instructions,''),
      active_method = _active_method,
      updated_at = now(),
      updated_by = auth.uid()
    WHERE id = r.id
    RETURNING * INTO r;
  END IF;
  RETURN r;
END; $$;


--
-- Name: admin_update_tax_settings(numeric, text, text, text, text, text, text, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_tax_settings(_tax_percent numeric, _till_number text, _till_business_name text, _paybill_number text, _paybill_account text, _instructions text, _active_method text DEFAULT 'till'::text, _min_withdrawal numeric DEFAULT NULL::numeric, _max_withdrawal numeric DEFAULT NULL::numeric) RETURNS public.withdrawal_tax_settings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r public.withdrawal_tax_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF _tax_percent < 0 OR _tax_percent > 100 THEN RAISE EXCEPTION 'Invalid percent'; END IF;
  IF _active_method NOT IN ('till','paybill') THEN _active_method := 'till'; END IF;
  IF _min_withdrawal IS NOT NULL AND _max_withdrawal IS NOT NULL
     AND _min_withdrawal > _max_withdrawal THEN
    RAISE EXCEPTION 'Minimum cannot exceed maximum';
  END IF;

  SELECT * INTO r FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1;
  IF r.id IS NULL THEN
    INSERT INTO public.withdrawal_tax_settings
      (tax_percent, till_number, till_business_name, paybill_number, paybill_account,
       instructions, active_method, min_withdrawal, max_withdrawal, updated_by)
    VALUES (_tax_percent, coalesce(_till_number,''), coalesce(_till_business_name,''),
            coalesce(_paybill_number,''), coalesce(_paybill_account,''),
            coalesce(_instructions,''), _active_method,
            coalesce(_min_withdrawal, 500), coalesce(_max_withdrawal, 1000000), auth.uid())
    RETURNING * INTO r;
  ELSE
    UPDATE public.withdrawal_tax_settings SET
      tax_percent = _tax_percent,
      till_number = coalesce(_till_number,''),
      till_business_name = coalesce(_till_business_name,''),
      paybill_number = coalesce(_paybill_number,''),
      paybill_account = coalesce(_paybill_account,''),
      instructions = coalesce(_instructions,''),
      active_method = _active_method,
      min_withdrawal = coalesce(_min_withdrawal, r.min_withdrawal),
      max_withdrawal = coalesce(_max_withdrawal, r.max_withdrawal),
      updated_at = now(),
      updated_by = auth.uid()
    WHERE id = r.id
    RETURNING * INTO r;
  END IF;
  RETURN r;
END; $$;


--
-- Name: transfer_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transfer_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    min_amount numeric DEFAULT 50 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: admin_update_transfer_settings(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_transfer_settings(_min numeric) RETURNS public.transfer_settings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r public.transfer_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _min IS NULL OR _min < 0 THEN RAISE EXCEPTION 'Invalid minimum'; END IF;
  UPDATE public.transfer_settings SET min_amount=_min, updated_at=now(), updated_by=auth.uid()
    WHERE id = (SELECT id FROM public.transfer_settings ORDER BY updated_at DESC LIMIT 1) RETURNING * INTO r;
  RETURN r;
END $$;


--
-- Name: buy_bond(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buy_bond(_bond_type text) RETURNS public.listings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  admin_id uuid;
  ticker_code text;
  company text;
  amount numeric;
  l public.listings;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF _bond_type = 'fixed' THEN
    ticker_code := 'FXD-BOND'; company := 'Fixed Coupon Bond (1–30 yrs, semi-annual)'; amount := 100000;
  ELSIF _bond_type = 'infra' THEN
    ticker_code := 'IFB-BOND'; company := 'Infrastructure Bond (5–25 yrs @ 15%)'; amount := 250000;
  ELSIF _bond_type = 'zero' THEN
    ticker_code := 'ZCB-BOND'; company := 'Zero-Coupon Bond (@15%, sell anytime)'; amount := 50000;
  ELSE
    RAISE EXCEPTION 'Unknown bond type';
  END IF;

  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin'
    AND user_id <> auth.uid() ORDER BY created_at ASC LIMIT 1;
  IF admin_id IS NULL THEN
    SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  END IF;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'Bond desk unavailable'; END IF;

  INSERT INTO public.listings (ticker, company_name, quantity, price_per_share, status, seller_id, buyer_id, pending_at)
  VALUES (ticker_code, company, 1, amount, 'pending', admin_id, auth.uid(), now())
  RETURNING * INTO l;

  RETURN l;
END; $$;


--
-- Name: holdings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holdings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ticker text NOT NULL,
    company_name text,
    quantity integer DEFAULT 0 NOT NULL,
    avg_price numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: buy_from_balance(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buy_from_balance(_listing_id uuid, _quantity integer DEFAULT NULL::integer) RETURNS public.holdings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  src public.listings;
  h public.holdings;
  existing public.holdings;
  total numeric;
  bal numeric;
  qty integer;
  new_qty integer;
  new_avg numeric;
  min_buy numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO src FROM public.listings WHERE id = _listing_id;
  IF src.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF src.seller_id = auth.uid() THEN RAISE EXCEPTION 'Cannot buy your own listing'; END IF;

  qty := COALESCE(_quantity, src.quantity);
  IF qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  total := qty * src.price_per_share;

  SELECT COALESCE(src.min_buy_amount, s.default_min_buy, 25000) INTO min_buy
  FROM (SELECT default_min_buy FROM public.stock_settings ORDER BY updated_at DESC LIMIT 1) s;
  min_buy := COALESCE(min_buy, COALESCE(src.min_buy_amount, 25000));
  IF total < min_buy THEN
    RAISE EXCEPTION 'Minimum buy for % is KES %. Increase the number of shares.', src.ticker, round(min_buy,2);
  END IF;

  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF COALESCE(bal,0) < total THEN
    RAISE EXCEPTION 'Insufficient balance. Deposit funds to buy (need KES %)', total;
  END IF;

  UPDATE public.profiles SET balance = balance - total WHERE id = auth.uid();

  INSERT INTO public.listings (ticker, company_name, quantity, price_per_share, seller_id, buyer_id, status, pending_at, logo_url, seller_name)
  VALUES (src.ticker, src.company_name, qty, src.price_per_share, src.seller_id, auth.uid(), 'sold', now(), src.logo_url, src.seller_name);

  SELECT * INTO existing FROM public.holdings
    WHERE user_id = auth.uid() AND ticker = src.ticker FOR UPDATE;
  IF existing.id IS NULL THEN
    INSERT INTO public.holdings (user_id, ticker, company_name, quantity, avg_price)
    VALUES (auth.uid(), src.ticker, src.company_name, qty, src.price_per_share)
    RETURNING * INTO h;
  ELSE
    new_qty := existing.quantity + qty;
    new_avg := ((existing.quantity * existing.avg_price) + (qty * src.price_per_share)) / new_qty;
    UPDATE public.holdings SET quantity = new_qty, avg_price = new_avg, updated_at = now()
      WHERE id = existing.id RETURNING * INTO h;
  END IF;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'purchase', 'Shares purchased',
    qty || ' × ' || src.ticker || ' purchased from your ZiiDi balance for KES ' || total::text ||
    '. Shares are now in your portfolio, ready to resell.');

  RETURN h;
END; $$;


--
-- Name: cancel_purchase(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_purchase(_listing_id uuid) RETURNS public.listings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE l public.listings;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF auth.uid() NOT IN (l.seller_id, l.buyer_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF l.status <> 'pending' THEN RAISE EXCEPTION 'Cannot cancel'; END IF;
  UPDATE public.listings SET status = 'active', buyer_id = NULL, pending_at = NULL
   WHERE id = _listing_id RETURNING * INTO l;
  RETURN l;
END; $$;


--
-- Name: close_listing_chat(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_listing_chat(_listing_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: expire_pending_and_notify(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_pending_and_notify() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r record; mins int; reminder_title text;
BEGIN
  FOR r IN SELECT * FROM public.listings
     WHERE status = 'pending' AND pending_at IS NOT NULL
       AND pending_at < now() - interval '10 minutes' LOOP
    UPDATE public.listings SET status = 'active', buyer_id = NULL, pending_at = NULL WHERE id = r.id;
    IF r.buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
      VALUES (r.buyer_id, r.id, 'cancelled', 'Order auto-cancelled',
        'Your order for ' || r.quantity || ' × ' || r.ticker ||
        ' was cancelled automatically because payment was not completed within 10 minutes.');
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM public.listings
     WHERE status = 'pending' AND buyer_id IS NOT NULL AND pending_at IS NOT NULL LOOP
    mins := floor(extract(epoch FROM (now() - r.pending_at)) / 60)::int;
    IF mins IN (3, 6, 9) THEN
      reminder_title := 'Payment reminder (' || mins || ' min)';
      IF NOT EXISTS (SELECT 1 FROM public.notifications
         WHERE user_id = r.buyer_id AND listing_id = r.id AND title = reminder_title) THEN
        INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
        VALUES (r.buyer_id, r.id, 'reminder', reminder_title,
          'Please complete payment for ' || r.quantity || ' × ' || r.ticker ||
          '. Your order will auto-cancel in ' || (10 - mins) || ' minute(s).');
      END IF;
    END IF;
  END LOOP;
END; $$;


--
-- Name: fail_crypto_deposit(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fail_crypto_deposit(_payment_id text, _reason text DEFAULT NULL::text) RETURNS public.deposits
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE d public.deposits;
BEGIN
  UPDATE public.deposits
     SET status = 'failed', admin_note = COALESCE(_reason, admin_note), updated_at = now()
   WHERE checkout_request_id = _payment_id AND status = 'pending'
   RETURNING * INTO d;
  RETURN d;
END;
$$;


--
-- Name: fail_stk_deposit(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fail_stk_deposit(_checkout_request_id text, _reason text) RETURNS public.deposits
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE d public.deposits;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE checkout_request_id = _checkout_request_id FOR UPDATE;
  IF d.id IS NULL THEN RETURN NULL; END IF;
  IF d.status <> 'pending' THEN RETURN d; END IF;

  UPDATE public.deposits
     SET status = 'rejected', admin_note = COALESCE(_reason, 'M-PESA payment was not completed'), updated_at = now()
   WHERE id = d.id
   RETURNING * INTO d;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (d.user_id, 'deposit', 'Deposit not completed',
    'Your M-PESA deposit of KES ' || d.amount::text || ' was not completed: ' ||
    COALESCE(_reason, 'the payment prompt was cancelled or timed out') || '. You can try again.');

  RETURN d;
END;
$$;


--
-- Name: find_transfer_recipient(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_transfer_recipient(_q text) RETURNS TABLE(id uuid, username text, account_id text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: get_my_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_balance() RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((SELECT balance FROM public.profiles WHERE id = auth.uid()), 0)
$$;


--
-- Name: get_usernames(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_usernames(_ids uuid[]) RETURNS TABLE(id uuid, username text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p.id, p.username FROM public.profiles p WHERE p.id = ANY(_ids);
$$;


--
-- Name: guard_not_suspended(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_not_suspended() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_suspended(auth.uid()) THEN
    RAISE EXCEPTION 'Your account has been suspended. Please contact ZiiDi Trader support.';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  base_username text;
  final_username text;
  phone_val text;
BEGIN
  base_username := trim(COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Trader'));
  IF base_username = '' THEN
    base_username := 'Trader';
  END IF;

  final_username := base_username;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) THEN
    final_username := base_username || '_' || substr(NEW.id::text, 1, 6);
  END IF;

  phone_val := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone');

  INSERT INTO public.profiles (id, username, balance, phone)
  VALUES (NEW.id, final_username, 0, phone_val)
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone);

  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: investments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid,
    plan_name text NOT NULL,
    amount numeric NOT NULL,
    interest_rate numeric NOT NULL,
    duration_hours integer NOT NULL,
    expected_return numeric NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    invested_at timestamp with time zone DEFAULT now() NOT NULL,
    matures_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invest_in_plan(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invest_in_plan(_plan_id uuid, _amount numeric) RETURNS public.investments
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: is_suspended(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_suspended(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((SELECT suspended FROM public.profiles WHERE id = _user_id), false)
$$;


--
-- Name: lock_deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lock_deposits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    principal numeric NOT NULL,
    daily_rate numeric NOT NULL,
    lock_period_hours integer NOT NULL,
    locked_at timestamp with time zone DEFAULT now() NOT NULL,
    unlock_at timestamp with time zone NOT NULL,
    released_at timestamp with time zone,
    interest_credited numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lock_deposits_principal_check CHECK ((principal > (0)::numeric)),
    CONSTRAINT lock_deposits_status_check CHECK ((status = ANY (ARRAY['active'::text, 'released'::text])))
);


--
-- Name: lock_funds(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_funds(_amount numeric) RETURNS public.lock_deposits
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE s public.lock_settings; bal numeric; d public.lock_deposits;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO s FROM public.lock_settings ORDER BY updated_at DESC LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Lock is not configured'; END IF;
  IF _amount < s.min_amount THEN RAISE EXCEPTION 'Minimum lock is KES %', s.min_amount; END IF;
  IF _amount > s.max_amount THEN RAISE EXCEPTION 'Maximum lock is KES %', s.max_amount; END IF;
  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF bal < _amount THEN RAISE EXCEPTION 'Insufficient available balance'; END IF;
  UPDATE public.profiles SET balance = balance - _amount WHERE id = auth.uid();
  INSERT INTO public.lock_deposits (user_id, principal, daily_rate, lock_period_hours, unlock_at)
  VALUES (auth.uid(), _amount, s.daily_rate, s.lock_period_hours,
          now() + make_interval(hours => s.lock_period_hours))
  RETURNING * INTO d;
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'lock', 'Funds locked in ZiiDi Lock',
    'KES ' || _amount::text || ' locked at ' || (s.daily_rate*100)::text ||
    '% daily. Unlocks at ' || to_char(d.unlock_at, 'YYYY-MM-DD HH24:MI') || '.');
  RETURN d;
END; $$;


--
-- Name: mark_paid(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_paid(_listing_id uuid) RETURNS public.listings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE l public.listings;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Only the buyer can confirm payment'; END IF;
  IF l.status <> 'pending' THEN RAISE EXCEPTION 'Listing not awaiting payment'; END IF;
  UPDATE public.listings SET status = 'paid' WHERE id = _listing_id RETURNING * INTO l;
  RETURN l;
END; $$;


--
-- Name: mark_withdrawal_tax_paid(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_withdrawal_tax_paid(_id uuid) RETURNS public.withdrawals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE w public.withdrawals; admin_row record;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF w.user_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;

  UPDATE public.withdrawals SET tax_paid_at = COALESCE(tax_paid_at, now())
    WHERE id = _id RETURNING * INTO w;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (w.user_id, 'withdrawal', 'MMF tax payment recorded',
    'Your ' || w.method || ' withdrawal of KES ' || w.amount::text ||
    ' is now awaiting final admin approval. Funds will be released shortly.');

  FOR admin_row IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (admin_row.user_id, 'withdrawal', 'Tax paid — withdrawal ready for release',
      'User confirmed MMF tax for ' || w.method || ' withdrawal of KES ' || w.amount::text ||
      '. Approve to release funds.');
  END LOOP;

  RETURN w;
END; $$;


--
-- Name: autoinvests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autoinvests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    passkey_id uuid,
    code text NOT NULL,
    principal numeric NOT NULL,
    return_percent numeric NOT NULL,
    duration_days integer NOT NULL,
    projected_return numeric NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    matures_at timestamp with time zone NOT NULL,
    matured_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mature_autoinvest(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mature_autoinvest(_id uuid) RETURNS public.autoinvests
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE a public.autoinvests; total numeric;
BEGIN
  SELECT * INTO a FROM public.autoinvests WHERE id = _id FOR UPDATE;
  IF a.id IS NULL OR a.user_id <> auth.uid() THEN RAISE EXCEPTION 'Not found'; END IF;
  IF a.status <> 'active' THEN RAISE EXCEPTION 'Already matured'; END IF;
  IF now() < a.matures_at THEN RAISE EXCEPTION 'Not matured yet'; END IF;
  total := a.principal + a.projected_return;
  UPDATE public.profiles SET balance = balance + total WHERE id = auth.uid();
  UPDATE public.autoinvests SET status = 'matured', matured_at = now() WHERE id = _id RETURNING * INTO a;
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'autoinvest', 'Auto Invest matured',
    'KES ' || total::text || ' credited (principal KES ' || a.principal::text || ' + return KES ' || a.projected_return::text || ').');
  RETURN a;
END; $$;


--
-- Name: notification_email_target(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notification_email_target(_user_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE e text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF NOT (
    auth.uid() = _user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = _user_id AND n.created_at > now() - interval '2 minutes'
    )
  ) THEN
    RETURN NULL;
  END IF;
  SELECT email INTO e FROM auth.users WHERE id = _user_id;
  RETURN e;
END; $$;


--
-- Name: open_dispute(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_dispute(_listing_id uuid, _reason text) RETURNS public.disputes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  l public.listings; d public.disputes; role_val TEXT; admin_row RECORD; is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'Please describe the issue'; END IF;

  SELECT * INTO l FROM public.listings WHERE id = _listing_id;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;

  SELECT public.has_role(auth.uid(),'admin') INTO is_admin;

  IF auth.uid() = l.buyer_id THEN role_val := 'buyer';
  ELSIF auth.uid() = l.seller_id THEN role_val := 'seller';
  ELSIF is_admin THEN role_val := 'seller';  -- admin acts on behalf of seller silently
  ELSE RAISE EXCEPTION 'Only trade participants can raise a dispute';
  END IF;

  IF EXISTS (SELECT 1 FROM public.disputes WHERE listing_id = _listing_id AND status = 'open') THEN
    RAISE EXCEPTION 'A dispute is already open for this trade';
  END IF;

  INSERT INTO public.disputes (listing_id, opened_by, opened_role, reason)
  VALUES (_listing_id, auth.uid(), role_val, _reason)
  RETURNING * INTO d;

  -- If admin raised it on behalf of seller, notify buyer as ZiiDi Customer Care (no admin mention)
  -- and do NOT notify the "opener" (admin) with a customer-facing message.
  IF is_admin AND auth.uid() <> l.buyer_id AND auth.uid() <> l.seller_id THEN
    IF l.buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
      VALUES (l.buyer_id, _listing_id, 'dispute',
        'Trade under review by ZiiDi Customer Care',
        'Your trade for ' || l.quantity || ' × ' || l.ticker ||
        ' is under review. If payment was marked sent without actually paying, this may lead to permanent suspension of your account.');
    END IF;
  ELSE
    -- Normal participant flow: notify opener + counterparty
    INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
    VALUES (auth.uid(), _listing_id, 'dispute',
      'Dispute raised — ZiiDi Customer Care is reviewing',
      'Our customer care team is now reviewing your dispute for ' || l.quantity || ' × ' || l.ticker ||
      '. Please note: false claims or fraudulent activity may lead to permanent suspension of your account.');

    IF role_val = 'buyer' AND l.seller_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
      VALUES (l.seller_id, _listing_id, 'dispute',
        'Dispute filed against your trade',
        'ZiiDi Customer Care has been notified about the trade for ' || l.quantity || ' × ' || l.ticker ||
        '. Any attempt to withhold released shares after payment may lead to suspension of your account.');
    ELSIF role_val = 'seller' AND l.buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
      VALUES (l.buyer_id, _listing_id, 'dispute',
        'Dispute filed against your trade',
        'ZiiDi Customer Care has been notified about the trade for ' || l.quantity || ' × ' || l.ticker ||
        '. Marking payment as sent without actually paying may lead to permanent suspension of your account.');
    END IF;
  END IF;

  -- Notify all admins internally
  FOR admin_row IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, listing_id, kind, title, body)
    VALUES (admin_row.user_id, _listing_id, 'dispute',
      'New dispute opened',
      role_val || ' raised a dispute on ' || l.ticker || ' (listing ' || substring(_listing_id::text,1,8) || '). Review in Admin Panel.');
  END LOOP;

  RETURN d;
END; $$;


--
-- Name: protect_profile_sensitive_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_profile_sensitive_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Trusted server-side routines run as the function owner (e.g. postgres) and
  -- are allowed to move balances. Direct client updates run as anon/authenticated.
  IF current_user IN ('anon', 'authenticated')
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.balance IS DISTINCT FROM OLD.balance THEN
      RAISE EXCEPTION 'Balance cannot be modified directly';
    END IF;
    IF COALESCE(NEW.suspended,false) IS DISTINCT FROM COALESCE(OLD.suspended,false) THEN
      RAISE EXCEPTION 'Suspension status cannot be modified directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: release_shares(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_shares(_listing_id uuid) RETURNS public.listings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE l public.listings; total NUMERIC; existing public.holdings; new_qty INTEGER; new_avg NUMERIC;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Only the seller can release'; END IF;
  IF l.status <> 'paid' THEN RAISE EXCEPTION 'Payment not received yet'; END IF;
  total := l.quantity * l.price_per_share;
  UPDATE public.profiles SET balance = balance + total WHERE id = l.seller_id;

  SELECT * INTO existing FROM public.holdings WHERE user_id = l.buyer_id AND ticker = l.ticker FOR UPDATE;
  IF existing.id IS NULL THEN
    INSERT INTO public.holdings (user_id, ticker, company_name, quantity, avg_price)
      VALUES (l.buyer_id, l.ticker, l.company_name, l.quantity, l.price_per_share);
  ELSE
    new_qty := existing.quantity + l.quantity;
    new_avg := ((existing.quantity * existing.avg_price) + (l.quantity * l.price_per_share)) / new_qty;
    UPDATE public.holdings SET quantity = new_qty, avg_price = new_avg, updated_at = now() WHERE id = existing.id;
  END IF;

  UPDATE public.listings SET status = 'sold' WHERE id = _listing_id RETURNING * INTO l;
  RETURN l;
END; $$;


--
-- Name: sell_from_holdings(text, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sell_from_holdings(_ticker text, _quantity integer, _price numeric) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  h public.holdings;
  cost_basis numeric;
  multiplier numeric;
  effective_price numeric;
  proceeds numeric;
BEGIN
  IF _quantity <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT * INTO h FROM public.holdings WHERE user_id = auth.uid() AND ticker = _ticker FOR UPDATE;
  IF h.id IS NULL OR h.quantity < _quantity THEN RAISE EXCEPTION 'Not enough shares in portfolio'; END IF;

  cost_basis := _quantity * h.avg_price;

  IF cost_basis >= 100000 THEN
    multiplier := 2.00;      -- +100%
  ELSIF cost_basis >= 50000 THEN
    multiplier := 1.70;      -- +70%
  ELSIF cost_basis >= 20000 THEN
    multiplier := 1.35;      -- +35%
  ELSE
    multiplier := 1.00;      -- no forced increase
  END IF;

  effective_price := round((h.avg_price * multiplier)::numeric, 2);

  IF h.quantity = _quantity THEN
    DELETE FROM public.holdings WHERE id = h.id;
  ELSE
    UPDATE public.holdings SET quantity = quantity - _quantity, updated_at = now() WHERE id = h.id;
  END IF;

  proceeds := round((_quantity * effective_price)::numeric, 2);
  UPDATE public.profiles SET balance = balance + proceeds WHERE id = auth.uid();

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'sale', 'Shares sold — balance credited',
    'You sold ' || _quantity || ' × ' || _ticker || ' at KES ' || effective_price::text ||
    ' (+' || round(((multiplier - 1) * 100)::numeric, 0)::text || '% market gain). KES ' ||
    proceeds::text || ' has been credited to your available balance.');
  RETURN proceeds;
END; $$;


--
-- Name: settle_crypto_deposit(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_crypto_deposit(_payment_id text, _receipt text DEFAULT NULL::text) RETURNS public.deposits
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE d public.deposits;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE checkout_request_id = _payment_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Deposit not found for payment %', _payment_id; END IF;
  IF d.status = 'approved' THEN RETURN d; END IF;

  UPDATE public.profiles SET balance = COALESCE(balance,0) + d.amount WHERE id = d.user_id;

  UPDATE public.deposits
     SET status = 'approved',
         approved_at = now(),
         updated_at = now(),
         tx_ref = COALESCE(NULLIF(_receipt, ''), tx_ref)
   WHERE id = d.id
   RETURNING * INTO d;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (d.user_id, 'deposit', 'Crypto deposit confirmed — account credited',
    'Your crypto deposit of KES ' || d.amount::text || ' was confirmed on-chain and credited to your ZiiDi account balance.');

  RETURN d;
END;
$$;


--
-- Name: settle_stk_deposit(text, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_stk_deposit(_checkout_request_id text, _receipt text DEFAULT NULL::text, _amount numeric DEFAULT NULL::numeric) RETURNS public.deposits
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE d public.deposits;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE checkout_request_id = _checkout_request_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Deposit not found for checkout %', _checkout_request_id; END IF;
  IF d.status = 'approved' THEN RETURN d; END IF;

  UPDATE public.profiles SET balance = COALESCE(balance,0) + COALESCE(_amount, d.amount) WHERE id = d.user_id;

  UPDATE public.deposits
     SET status = 'approved',
         approved_at = now(),
         updated_at = now(),
         mpesa_receipt = COALESCE(NULLIF(_receipt, ''), mpesa_receipt),
         tx_ref = COALESCE(NULLIF(_receipt, ''), tx_ref),
         amount = COALESCE(_amount, amount)
   WHERE id = d.id
   RETURNING * INTO d;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (d.user_id, 'deposit', 'Deposit confirmed — account credited',
    'Your M-PESA deposit of KES ' || d.amount::text || ' was confirmed automatically and credited to your ZiiDi account balance.');

  RETURN d;
END;
$$;


--
-- Name: start_autoinvest(text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_autoinvest(_code text, _amount numeric) RETURNS public.autoinvests
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  p public.autoinvest_passkeys; bal numeric; has_holdings boolean;
  a public.autoinvests; proj numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  SELECT EXISTS(SELECT 1 FROM public.holdings WHERE user_id = auth.uid()) INTO has_holdings;

  IF NOT has_holdings AND COALESCE(bal,0) <= 0 THEN
    RAISE EXCEPTION 'Buy at least one share or fund your account to unlock Auto Invest';
  END IF;

  SELECT * INTO p FROM public.autoinvest_passkeys WHERE code = upper(trim(_code)) FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Invalid passkey'; END IF;
  IF NOT p.is_active THEN RAISE EXCEPTION 'Passkey is disabled'; END IF;
  IF _amount < p.min_amount THEN RAISE EXCEPTION 'Amount below passkey minimum (KES %)', p.min_amount; END IF;
  IF _amount > p.max_amount THEN RAISE EXCEPTION 'Amount above passkey maximum (KES %)', p.max_amount; END IF;

  IF bal < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  UPDATE public.profiles SET balance = balance - _amount WHERE id = auth.uid();
  proj := round((_amount * p.return_percent / 100.0)::numeric, 2);

  INSERT INTO public.autoinvests (user_id, passkey_id, code, principal, return_percent, duration_days, projected_return, matures_at)
  VALUES (auth.uid(), p.id, p.code, _amount, p.return_percent, p.duration_days, proj,
          now() + make_interval(days => p.duration_days))
  RETURNING * INTO a;

  UPDATE public.autoinvest_passkeys SET used_by = auth.uid(), used_at = now()
    WHERE id = p.id AND used_by IS NULL;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'autoinvest', 'Auto Invest started',
    'KES ' || _amount::text || ' auto-invested at ' || p.return_percent::text ||
    '% for ' || p.duration_days::text || ' day(s). Projected return KES ' || proj::text || '.');
  RETURN a;
END; $$;


--
-- Name: start_purchase(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_purchase(_listing_id uuid) RETURNS public.listings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE src public.listings; l public.listings;
BEGIN
  SELECT * INTO src FROM public.listings WHERE id = _listing_id;
  IF src.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF src.seller_id = auth.uid() THEN RAISE EXCEPTION 'Cannot buy your own listing'; END IF;
  INSERT INTO public.listings (ticker, company_name, quantity, price_per_share, seller_id, buyer_id, status, pending_at, seller_name, logo_url)
  VALUES (src.ticker, src.company_name, src.quantity, src.price_per_share, src.seller_id, auth.uid(), 'pending', now(), src.seller_name, src.logo_url)
  RETURNING * INTO l;
  RETURN l;
END; $$;


--
-- Name: submit_kyc(text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_kyc(_full_name text, _id_type text, _id_number text, _id_front text, _id_back text, _selfie text) RETURNS public.kyc_verifications
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: submit_withdrawal_tax_code(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_withdrawal_tax_code(_id uuid, _code text) RETURNS public.withdrawals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE w public.withdrawals; c text := upper(trim(coalesce(_code,''))); a record;
BEGIN
  IF c !~ '^[A-Z0-9]{8,12}$' THEN RAISE EXCEPTION 'Enter a valid transaction code (8-12 letters/numbers)'; END IF;
  SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF w.user_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
  UPDATE public.withdrawals SET tax_tx_code = c, tax_paid_at = now() WHERE id = _id RETURNING * INTO w;
  INSERT INTO public.notifications (user_id, kind, title, body) VALUES (w.user_id, 'withdrawal', 'MMF tax code submitted',
    'Your tax payment code ' || c || ' for the KES ' || w.amount::text || ' withdrawal is pending verification.');
  FOR a IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, kind, title, body) VALUES (a.user_id, 'withdrawal', 'MMF tax code submitted',
      'Code ' || c || ' for ' || w.method || ' withdrawal of KES ' || w.amount::text || '. Verify and approve.');
  END LOOP;
  RETURN w;
END $_$;


--
-- Name: transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    amount numeric NOT NULL,
    recipient_label text,
    sender_label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: transfer_funds(text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transfer_funds(_recipient text, _amount numeric) RETURNS public.transfers
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: unlock_funds(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unlock_funds(_lock_id uuid) RETURNS public.lock_deposits
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE d public.lock_deposits; days numeric; interest numeric; total numeric;
BEGIN
  SELECT * INTO d FROM public.lock_deposits WHERE id = _lock_id FOR UPDATE;
  IF d.id IS NULL OR d.user_id <> auth.uid() THEN RAISE EXCEPTION 'Lock not found'; END IF;
  IF d.status <> 'active' THEN RAISE EXCEPTION 'Already released'; END IF;
  IF now() < d.unlock_at THEN RAISE EXCEPTION 'Funds are still locked until %', to_char(d.unlock_at,'YYYY-MM-DD HH24:MI'); END IF;
  days := extract(epoch FROM (now() - d.locked_at)) / 86400.0;
  interest := round((d.principal * d.daily_rate * days)::numeric, 2);
  total := d.principal + interest;
  UPDATE public.profiles SET balance = balance + total WHERE id = auth.uid();
  UPDATE public.lock_deposits
    SET status = 'released', released_at = now(), interest_credited = interest
    WHERE id = _lock_id RETURNING * INTO d;
  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (auth.uid(), 'unlock', 'ZiiDi Lock released',
    'KES ' || total::text || ' credited to your balance (principal KES ' || d.principal::text ||
    ' + interest KES ' || interest::text || ').');
  RETURN d;
END; $$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


--
-- Name: withdraw_funds(numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.withdraw_funds(_amount numeric, _method text, _destination text) RETURNS public.withdrawals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE bal numeric; w public.withdrawals; s public.withdrawal_tax_settings; eff_min numeric := 100000;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF _method NOT IN ('mpesa','bank','card') THEN RAISE EXCEPTION 'Unsupported method'; END IF;
  IF length(coalesce(_destination,'')) < 3 THEN RAISE EXCEPTION 'Destination required'; END IF;

  SELECT * INTO s FROM public.withdrawal_tax_settings ORDER BY updated_at DESC LIMIT 1;
  IF s.id IS NOT NULL THEN eff_min := GREATEST(100000, s.min_withdrawal); END IF;
  IF _amount < eff_min THEN
    RAISE EXCEPTION 'Minimum withdrawal is KES %', to_char(eff_min, 'FM999,999,999');
  END IF;
  IF s.id IS NOT NULL AND _amount > s.max_withdrawal THEN
    RAISE EXCEPTION 'Maximum withdrawal is KES %', to_char(s.max_withdrawal, 'FM999,999,999');
  END IF;

  SELECT balance INTO bal FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF bal < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.profiles SET balance = balance - _amount WHERE id = auth.uid();
  INSERT INTO public.withdrawals (user_id, amount, method, destination, status)
    VALUES (auth.uid(), _amount, _method, _destination, 'pending')
    RETURNING * INTO w;
  INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (auth.uid(), 'withdrawal', 'Withdrawal submitted',
      'Your ' || _method || ' withdrawal of KES ' || _amount::text || ' is pending admin approval.');
  RETURN w;
END; $$;


--
-- Name: community_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    excerpt text,
    body text NOT NULL,
    category text,
    cover_url text,
    author_name text,
    published boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: deposit_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deposit_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    min_deposit numeric DEFAULT 25000 NOT NULL,
    max_deposit numeric DEFAULT 2000000 NOT NULL,
    paybill_number text DEFAULT '714777'::text NOT NULL,
    account_number text DEFAULT '420200858228'::text NOT NULL,
    business_name text DEFAULT 'SAFARICOM ZIIDI MMF'::text NOT NULL,
    instructions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    till_number text DEFAULT ''::text NOT NULL,
    till_business_name text DEFAULT ''::text NOT NULL,
    active_method text DEFAULT 'paybill'::text NOT NULL,
    stk_enabled boolean DEFAULT true NOT NULL,
    mobile_enabled boolean DEFAULT true NOT NULL,
    crypto_enabled boolean DEFAULT false NOT NULL,
    crypto_kes_per_usd numeric DEFAULT 130 NOT NULL
);


--
-- Name: investment_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investment_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    interest_rate numeric DEFAULT 0 NOT NULL,
    duration_hours integer DEFAULT 24 NOT NULL,
    min_amount numeric DEFAULT 0 NOT NULL,
    max_amount numeric DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mpesa_balance_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mpesa_balance_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
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
    requested_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mpesa_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mpesa_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone text NOT NULL,
    amount numeric NOT NULL,
    remarks text DEFAULT 'Payout'::text NOT NULL,
    occasion text,
    status text DEFAULT 'pending'::text NOT NULL,
    conversation_id text,
    originator_conversation_id text,
    transaction_id text,
    receiver_name text,
    result_code text,
    result_desc text,
    raw_response jsonb,
    raw_result jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mpesa_payouts_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    listing_id uuid,
    kind text DEFAULT 'info'::text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.notifications REPLICA IDENTITY FULL;


--
-- Name: platform_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    media_type text DEFAULT 'none'::text NOT NULL,
    media_url text DEFAULT ''::text NOT NULL,
    published boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_content_category_check CHECK ((category = ANY (ARRAY['journey'::text, 'awareness'::text, 'promos'::text, 'general'::text]))),
    CONSTRAINT platform_content_media_type_check CHECK ((media_type = ANY (ARRAY['none'::text, 'youtube'::text, 'video'::text, 'image'::text]))),
    CONSTRAINT platform_content_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 180)))
);


--
-- Name: promo_flashes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_flashes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    sender_role text NOT NULL,
    sender_id uuid,
    body text NOT NULL,
    read_by_admin boolean DEFAULT false NOT NULL,
    read_by_user boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['user'::text, 'admin'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: autoinvest_passkeys; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.autoinvest_passkeys (id, code, min_amount, duration_days, return_percent, is_active, used_by, used_at, created_by, created_at, updated_at, max_amount) FROM stdin;
\.


--
-- Data for Name: autoinvests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.autoinvests (id, user_id, passkey_id, code, principal, return_percent, duration_days, projected_return, status, started_at, matures_at, matured_at, created_at) FROM stdin;
\.


--
-- Data for Name: community_posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.community_posts (id, title, excerpt, body, category, cover_url, author_name, published, created_by, created_at, updated_at) FROM stdin;
7acde25b-f038-4210-bc2a-5866ca5eaa81	Welcome to ZiiDi Community	Trends, tips and testimonials from the ZiiDi trading floor.	ZiiDi Trader is regulated by CBK and CMA. Our community channel brings weekly market outlooks, member testimonials, and platform announcements.	Announcement	\N	ZiiDi Team	t	\N	2026-08-26 23:10:51.09214+00	2026-08-26 23:10:51.09214+00
\.


--
-- Data for Name: deposit_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.deposit_settings (id, min_deposit, max_deposit, paybill_number, account_number, business_name, instructions, created_at, updated_at, till_number, till_business_name, active_method, stk_enabled, mobile_enabled, crypto_enabled, crypto_kes_per_usd) FROM stdin;
09dbe1e7-b5b6-4880-bf7f-4d13cabdccfb	25000	2000000	4329231	ZiiDi MMF	SAFARICOM ZIIDI MMF	Use M-PESA Paybill to fund your ZiiDi account, then paste the M-PESA confirmation code below.	2026-08-26 23:10:56.199767+00	2026-10-01 10:44:15.489228+00			paybill	f	t	f	130
\.


--
-- Data for Name: deposits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.deposits (id, user_id, amount, phone, tx_ref, status, admin_note, approved_at, created_at, updated_at, checkout_request_id, merchant_request_id, mpesa_receipt, channel) FROM stdin;
02e7d1a2-3bf0-4f9c-b85b-0ddfcc4da486	556578af-566b-4695-bd82-ff43a6f4f360	50000	0182333250	WJRVJBEVBE	approved	\N	2026-10-01 10:44:41.043103+00	2026-10-01 10:44:31.642703+00	2026-10-01 10:44:41.043103+00	\N	\N	\N	manual
91fab0f4-fa84-45a0-abd1-f2e8ddce68da	556578af-566b-4695-bd82-ff43a6f4f360	250000	0182333250	EUIEIWF	approved	\N	2026-10-01 11:03:01.157398+00	2026-10-01 11:02:55.179443+00	2026-10-01 11:03:01.157398+00	\N	\N	\N	manual
e1acc086-5c63-457a-8a1f-f399ab4930e8	556578af-566b-4695-bd82-ff43a6f4f360	250000	0182333250	TFYFYTFY	approved	\N	2026-10-01 11:05:31.228801+00	2026-10-01 11:05:21.871917+00	2026-10-01 11:05:31.228801+00	\N	\N	\N	manual
fa9244f2-7fd5-47f3-a6bb-1d07b36ef2df	556578af-566b-4695-bd82-ff43a6f4f360	250000	0182333250	KDCBKWEC	approved	\N	2026-10-01 11:21:06.370799+00	2026-10-01 11:21:02.256346+00	2026-10-01 11:21:06.370799+00	\N	\N	\N	manual
\.


--
-- Data for Name: disputes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.disputes (id, listing_id, opened_by, opened_role, reason, status, resolution, resolved_by, resolved_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: holdings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.holdings (id, user_id, ticker, company_name, quantity, avg_price, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: investment_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.investment_plans (id, name, description, interest_rate, duration_hours, min_amount, max_amount, active, sort_order, created_at, updated_at) FROM stdin;
2b0f1357-eb0a-4bfa-b711-a14dc0e3cdb5	Btcfx Starter Plan	The BTCFX Starter Plan is designed for investors seeking a simple, low-entry way to grow capital with a predictable short-term return.	100	24	35000	250000	t	1	2026-08-26 23:10:50.12768+00	2026-08-26 23:10:50.12768+00
000c1acf-9862-41ee-9eed-00d77e965fb2	Btcfx Premium Plan	The BTCFX Premium Plan is designed for investors seeking a simple, balanced way to grow capital with strong short-term returns.	120	48	75000	500000	t	2	2026-08-26 23:10:50.12768+00	2026-08-26 23:10:50.12768+00
c3e442ea-7bff-4c09-8b6e-cae05030c152	BtcFx Vip Plan	The BTCFX VIP Plan is designed for investors seeking a simple and high-yield investment vehicle for larger capital allocations.	150	72	150000	2000000	t	3	2026-08-26 23:10:50.12768+00	2026-08-26 23:10:50.12768+00
\.


--
-- Data for Name: investments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.investments (id, user_id, plan_id, plan_name, amount, interest_rate, duration_hours, expected_return, status, invested_at, matures_at, created_at) FROM stdin;
\.


--
-- Data for Name: kyc_verifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.kyc_verifications (id, user_id, full_name, id_type, id_number, id_front_url, id_back_url, selfie_url, status, reject_reason, reviewed_at, reviewed_by, created_at, updated_at) FROM stdin;
6ee685af-de4e-4260-a444-cab1a208e70b	556578af-566b-4695-bd82-ff43a6f4f360	James	national_id	3827823	data:image/png;base64,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	data:image/png;base64,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	data:image/jpeg;base64,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	verified	\N	2026-10-01 10:51:45.56263+00	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	2026-10-01 10:51:34.424379+00	2026-10-01 10:51:45.56263+00
\.


--
-- Data for Name: listings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.listings (id, seller_id, buyer_id, ticker, company_name, quantity, price_per_share, status, created_at, pending_at, seller_name, logo_url, chat_closed_at, chat_closed_by, change_percent, min_buy_amount) FROM stdin;
db01184d-0d87-467d-9bc7-d58034191658	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	SCOM	Safaricom PLC	5000	38.75	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/safaricom.co.ke	\N	\N	0	\N
4ca217da-5153-4bd6-bcab-9457242de800	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	EQTY	Equity Group Holdings	3000	45.20	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/equitygroupholdings.com	\N	\N	0	\N
bb3ce2a7-1f5b-49cd-a2c5-ed829d0c3294	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	KCB	KCB Group	3500	32.10	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/kcbgroup.com	\N	\N	0	\N
db6216be-8e24-4e23-b619-4361ba304827	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	ABSA	Absa Bank Kenya	4000	15.85	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/absabank.co.ke	\N	\N	0	\N
c5fc1663-440f-4b8f-b986-307e4fcdb0d3	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	COOP	Co-operative Bank of Kenya	4500	13.20	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/co-opbank.co.ke	\N	\N	0	\N
c55e8dc3-ab16-466a-b80f-89fbdf3ff1d3	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	EABL	East African Breweries	1500	168.50	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/eabl.com	\N	\N	0	\N
ed7957a7-447f-416d-ac14-41660f8fa8cc	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	BAT	British American Tobacco Kenya	200	410.00	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/batkenya.com	\N	\N	0	\N
e1628b3e-961e-4beb-abe3-5f92e03a3d92	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	NCBA	NCBA Group	2500	48.60	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/ncbagroup.com	\N	\N	0	\N
c10c530c-5e8d-49c2-a0d8-1f71cecc2bd7	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	SCBK	Standard Chartered Bank Kenya	800	245.00	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/sc.com	\N	\N	0	\N
3a9f82fb-fab0-4aa9-9d22-26cf082c5c04	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	DTBK	Diamond Trust Bank Kenya	1200	66.75	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/dtbafrica.com	\N	\N	0	\N
9cb59785-dcf9-4f00-a81b-8251e8f576cd	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	JUB	Jubilee Holdings	900	190.25	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/jubileeholdings.com	\N	\N	0	\N
5829e9fc-cc4d-4c7e-8c52-a650c7264aae	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	BAMB	Bamburi Cement	1000	51.50	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/bamburicement.com	\N	\N	0	\N
8a6dcea6-6d9a-48f7-9ce6-fc2de4efd891	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	KEGN	KenGen	8000	4.85	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/kengen.co.ke	\N	\N	0	\N
2252c1ec-30dc-4fb0-a468-bb9913c10116	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	KPLC	Kenya Power & Lighting	12000	3.20	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/kplc.co.ke	\N	\N	0	\N
c14db74d-98af-4c27-af46-0cea75f61944	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	CIC	CIC Insurance Group	15000	2.55	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/cic.co.ke	\N	\N	0	\N
91970891-be65-4aa4-8bc0-c79485b99b96	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	BRIT	Britam Holdings	6000	6.15	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/britam.com	\N	\N	0	\N
d284ce23-ec34-4c88-be37-da85613e72fb	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	SASN	Sasini PLC	3000	22.40	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/sasini.co.ke	\N	\N	0	\N
97a0249c-11d8-452a-ac9c-7b17c3f49c39	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	HFCK	HF Group	8000	4.10	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/hfgroup.co.ke	\N	\N	0	\N
d86cbb36-fb3e-4bbe-9cce-3a67ef1ab9dd	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	UNGA	Unga Group	1800	22.90	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/unga.com	\N	\N	0	\N
6b06f662-8380-488d-aae3-5a5571f4db52	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	KNRE	Kenya Re-Insurance	12000	2.10	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/kenyare.co.ke	\N	\N	0	\N
c89b2f17-95fb-40a8-8c96-b2dc9500e718	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	TOTL	TotalEnergies Marketing Kenya	900	28.35	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/totalenergies.co.ke	\N	\N	0	\N
9974f785-da69-4e98-9198-871dc2bee749	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	CRDB	CRDB Bank	700	675.00	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/crdbbank.co.tz	\N	\N	0	\N
d8b68233-cc72-47cd-afb2-0d0de51d4136	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	SBIC	Stanbic Holdings	300	155.75	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/stanbicbank.co.ke	\N	\N	0	\N
23f48513-0b04-43b0-95ed-c65fd0be3b3c	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	IMH	I&M Group	1500	34.90	active	2026-08-26 23:10:54.192339+00	\N	ZiiDi Broker	https://logo.clearbit.com/imbankgroup.com	\N	\N	0	\N
43b538cd-a734-4d02-8f69-966334b13e9f	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	ABSA	Absa Bank Kenya	1578	15.85	sold	2026-08-27 07:20:22.402349+00	2026-08-27 07:20:22.402349+00	ZiiDi Broker	https://logo.clearbit.com/absabank.co.ke	\N	\N	0	\N
a3e10796-b5fd-4aca-9f95-2c10c773b91c	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	ABSA	Absa Bank Kenya	1578	15.85	sold	2026-08-27 07:24:09.017201+00	2026-08-27 07:24:09.017201+00	ZiiDi Broker	https://logo.clearbit.com/absabank.co.ke	\N	\N	0	\N
74d61e72-9ec5-40b0-8624-9d60a91f0ba9	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	USDT	Tether USD	50000	129.5	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
e72cf1c3-da60-40b3-bb64-80264caa7cda	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	KQ	Kenya Airways	20000	3.85	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
dcd0aa6c-bb0b-4cc4-acae-7f3e260c781c	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	NMG	Nation Media Group	2000	15.20	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
0050f104-38de-4f42-b82e-d02d4180bbb0	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	SCAN	WPP Scangroup	5000	2.95	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
b1de7bed-eaa5-4122-a610-b8f903923cfd	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	SGL	Standard Group	3000	6.40	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
2fa721bc-7203-4535-8633-1cc9a214953a	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	LKL	Longhorn Publishers	6000	2.60	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
c6a23b75-81a5-48d2-b06a-d47691ea72d8	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	CTUM	Centum Investment	4000	10.50	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
2b56c2f1-6836-4e81-b535-4e022e208c0e	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	NSE	Nairobi Securities Exchange	5000	6.10	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
f384ad56-e528-4538-bdae-48fc06cbde89	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	LBTY	Liberty Kenya Holdings	3000	6.80	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
dbe7052b-8dc5-4ccf-b073-29e2c3182580	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	KAPC	Kapchorua Tea	800	250.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
046a4347-4c6a-4782-a76d-b08eb3b51ad4	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	WTK	Williamson Tea Kenya	500	215.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
c60c6d2f-2a7c-46cc-90d2-7f0fb3d3f6e2	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	KUKZ	Kakuzi	600	380.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
f726fa3c-0c9d-4b95-8f2e-86df3024ca79	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	LIMT	Limuru Tea	300	420.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
c1e1d434-f432-40ac-aa8b-1b83c1556ef8	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	EGAD	Eaagads	2000	13.50	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
a25fb851-6c14-4d00-9bee-518c4e60216f	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	CGEN	Car & General	1500	24.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
d4409c96-3c87-449d-ac4c-dff377d12835	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	PORT	EA Portland Cement	2000	33.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
42b1deb6-6f01-483b-ad2d-277c225d16c4	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	CRWN	Crown Paints Kenya	800	36.50	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
aef81992-cd19-4248-8ecd-bad94f3f2b42	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	CABL	East African Cables	10000	1.20	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
ea8275e6-f35c-45ee-abc0-632159f590d7	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	KENO	KenolKobil / Rubis	2000	15.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
7cb8877f-1670-4e56-b8af-373f8640b8ab	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	UMME	Umeme	4000	16.50	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
8ec8ef98-448e-42db-b134-54b6dd9a3ae6	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	CARB	Carbacid Investments	2500	18.20	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
1586a2b0-489a-4126-b903-277f22a7d664	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	BOC	BOC Kenya	600	85.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
0a3789c5-f510-4bc4-85fc-27a327877a5e	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	EVRD	Eveready East Africa	15000	1.10	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
d07663d9-85bb-4410-a786-6d98af9d5e1b	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	ORCH	Kenya Orchards	1000	19.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
7e103fb7-b8ab-44b8-87ed-dfa82a7ff993	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	HAFR	Home Afrika	30000	0.40	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
d92c2112-9842-4788-be08-d3350ed4e54e	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	TPSE	TPS Eastern Africa	3000	15.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
750a1ee9-5853-4fe5-8490-deeb9e75c1ed	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	XPRS	Express Kenya	5000	3.90	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
64e6d219-b44b-4324-834d-2715d8c74a34	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	SMER	Sameer Africa	8000	2.40	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
1fa01c1e-122c-4151-9f67-25a0ca101d3a	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	UCHM	Uchumi Supermarkets	40000	0.20	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
2433a1cd-946e-431f-8b0f-7ec0ba14dfc1	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	NBV	Nairobi Business Ventures	10000	1.60	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
a5b6fe64-a9eb-47fa-9d2e-a69b642b0cb3	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	OCH	Olympia Capital	4000	3.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
ab4d7545-9ab5-4a75-94a4-0298257b64b1	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	TCL	Trans-Century	30000	0.50	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
9c8cfed9-5a34-45bf-bb66-d61739f8cce2	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	FTGH	Flame Tree Group	6000	1.10	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
c13114c9-b309-4379-88ad-6e00d852467e	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	KURV	Kurwitu Ventures	500	1500.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
e754f8eb-dc8c-4b11-ba9b-b29d4bf4ceb0	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	HBE	Homeboyz Entertainment	5000	4.60	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
fa5ec279-5973-4f00-bf88-dd597aba12de	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	SLAM	Sanlam Kenya	4000	7.20	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
58240668-55bc-49d4-956f-352518b881b4	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	BKG	BK Group	3000	35.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
8976224a-0621-424f-a50d-74145ba99005	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	FAHR	ILAM Fahari I-REIT	10000	11.50	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
3abbe9e2-37f7-4f0d-a8aa-82c5420ff277	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	GLD	NewGold ETF	100	3200.00	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
bc8236a7-bb08-4ccf-aee4-3d975615e2e9	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	556578af-566b-4695-bd82-ff43a6f4f360	CABL	East African Cables	41666	1.20	sold	2026-10-01 10:46:43.136208+00	2026-10-01 10:46:43.136208+00	ZiiDi Broker	\N	\N	\N	0	\N
ec07edec-294b-49e6-863d-301fa584003b	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	BTC	Bitcoin (1 share = 0.0001 BTC)	50000	1400	active	2026-10-01 09:16:46.224026+00	\N	ZiiDi Broker	\N	\N	\N	0	\N
2d691537-ab2d-424b-9d58-60f4272e09cb	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	556578af-566b-4695-bd82-ff43a6f4f360	BTC	Bitcoin (1 share = 0.0001 BTC)	35	1400	sold	2026-10-01 10:49:21.023405+00	2026-10-01 10:49:21.023405+00	ZiiDi Broker	\N	\N	\N	0	\N
dfd35baf-e8f9-4c6e-8d62-4d8b2479b3e8	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	556578af-566b-4695-bd82-ff43a6f4f360	ABSA	Absa Bank Kenya	5299	15.85	sold	2026-10-01 10:52:26.55128+00	2026-10-01 10:52:26.55128+00	ZiiDi Broker	https://logo.clearbit.com/absabank.co.ke	\N	\N	0	\N
\.


--
-- Data for Name: lock_deposits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lock_deposits (id, user_id, principal, daily_rate, lock_period_hours, locked_at, unlock_at, released_at, interest_credited, status, created_at) FROM stdin;
\.


--
-- Data for Name: lock_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lock_settings (id, min_amount, max_amount, lock_period_hours, daily_rate, updated_at) FROM stdin;
c14d3d73-4cff-4a7c-acf5-b222c250e249	100	10000000	24	0.07	2026-08-26 23:10:50.334782+00
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (id, listing_id, sender_id, content, created_at) FROM stdin;
\.


--
-- Data for Name: mpesa_balance_checks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mpesa_balance_checks (id, status, conversation_id, originator_conversation_id, working_balance, available_balance, reserved_balance, uncleared_balance, result_code, result_desc, raw_response, raw_result, requested_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mpesa_payouts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mpesa_payouts (id, phone, amount, remarks, occasion, status, conversation_id, originator_conversation_id, transaction_id, receiver_name, result_code, result_desc, raw_response, raw_result, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, listing_id, kind, title, body, read, created_at) FROM stdin;
ee7a93f8-7e82-431b-a96d-27fea3e10f2d	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	\N	purchase	Shares purchased	1578 × ABSA purchased from your ZiiDi balance for KES 25011.30. Shares are now in your portfolio, ready to resell.	f	2026-08-27 07:20:22.402349+00
0e032b80-8d3f-47cd-a90a-69bd67672476	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	\N	auth	New sign-in to your account	You signed in on 8/27/2026, 7:21:40 AM from this device. If this wasn't you, reset your password immediately.	f	2026-08-27 07:21:40.753499+00
a01196df-f2e6-41c8-99f5-e56fbacb8933	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	\N	sale	Shares sold — balance credited	You sold 1578 × ABSA at KES 21.40 (+35% market gain). KES 33769.20 has been credited to your available balance.	f	2026-08-27 07:21:51.908438+00
d733d929-9cfa-436d-973a-27a209dd5153	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	\N	sale	Shares sold — ABSA	You sold 1578 × ABSA at +35% (KES 20,000 – 50,000). KES 33,769.20 has been credited to your available balance and is ready for withdrawal.	f	2026-08-27 07:21:52.126356+00
319f3aba-47eb-4ef8-964d-761d1c1c5ab9	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	\N	auth	New sign-in to your account	You signed in on 8/27/2026, 7:23:35 AM from this device. If this wasn't you, reset your password immediately.	f	2026-08-27 07:23:36.041565+00
c82b5d57-a7e8-48e5-907c-9bd28be5f225	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	\N	auth	New sign-in to your account	You signed in on 8/27/2026, 7:23:57 AM from this device. If this wasn't you, reset your password immediately.	f	2026-08-27 07:23:57.429002+00
a0137f02-4486-4173-887e-28647278b62c	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	\N	purchase	Shares purchased	1578 × ABSA purchased from your ZiiDi balance for KES 25011.30. Shares are now in your portfolio, ready to resell.	f	2026-08-27 07:24:09.017201+00
52521244-2e4b-431c-935b-e74c8d60e270	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	\N	purchase	Shares purchased — ABSA	Your purchase of 1578 × ABSA for KES 25,011.30 settled from your ZiiDi wallet and the shares are now in your portfolio.	f	2026-08-27 07:24:09.206974+00
aac95108-a728-44c4-a693-ff2f905f9892	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	\N	auth	New sign-in to your account	You signed in on 8/27/2026, 7:24:29 AM from this device. If this wasn't you, reset your password immediately.	f	2026-08-27 07:24:29.171244+00
713c6af8-7377-488f-89c1-73a0b7c5960c	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	\N	sale	Shares sold — balance credited	You sold 1578 × ABSA at KES 21.40 (+35% market gain). KES 33769.20 has been credited to your available balance.	f	2026-08-27 07:24:40.187038+00
3e001a3a-7875-4342-a776-aef0d7ffc0ce	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	\N	sale	Shares sold — ABSA	You sold 1578 × ABSA at +35% (KES 20,000 – 50,000). KES 33,769.20 has been credited to your available balance and is ready for withdrawal.	f	2026-08-27 07:24:45.779388+00
79f384b1-1e15-4d13-be00-049af17d79fb	2b84ddc5-c051-4745-b501-bfc57b9a1215	\N	auth	Welcome to Safaricom Ziidi Trader	Your account (mike99069@example.com) has been created successfully. Complete verification to start trading.	f	2026-08-27 07:29:25.244121+00
ef0313c3-d79a-43ce-b69f-a93a2d047dd4	00ca000e-6f85-4efd-95b4-d802b7b7502a	\N	auth	Welcome to Safaricom Ziidi Trader	Your account (registration1787816139@example.com) has been created successfully. Complete verification to start trading.	f	2026-08-27 07:35:42.493898+00
feda44a3-5385-4ab0-95f2-e43e41b2f2ae	828aae5d-0b08-4ed7-97b3-07713bd42e8e	\N	auth	Welcome to Safaricom Ziidi Trader	Your account (registration1787816153@example.com) has been created successfully. Complete verification to start trading.	f	2026-08-27 07:35:55.94799+00
faa6d5d3-10ef-4c93-848e-49a3971fd1ff	3fa73b36-c046-4dee-b10f-2dcb1fdf4ac7	\N	auth	Welcome to Safaricom Ziidi Trader	Your account (jumacyprian37@gmail.com) has been created successfully. Complete verification to start trading.	f	2026-10-01 08:46:03.79378+00
a2507006-02ee-46e5-8bd7-2fceee2e17f1	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	auth	New sign-in to your account	You signed in on 9/18/2026, 4:54:56 PM from this device. If this wasn't you, reset your password immediately.	t	2026-09-18 13:55:05.632306+00
8932eec6-68dc-4789-ac64-599b4f9d2141	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	auth	New sign-in to your account	You signed in on 10/1/2026, 11:49:34 AM from this device. If this wasn't you, reset your password immediately.	t	2026-10-01 08:49:35.556709+00
bf77b0a1-36aa-4e3b-8f07-c82c691fa0e3	fea1fdf3-279a-43fb-8a2a-42a0532a447c	\N	auth	New sign-in to your account	You signed in on 10/1/2026, 9:32:25 AM from this device. If this wasn't you, reset your password immediately.	f	2026-10-01 09:32:25.914242+00
4cf4c57e-d859-49f4-9e37-6758c257e9bd	fea1fdf3-279a-43fb-8a2a-42a0532a447c	\N	balance	Balance credited by admin	KES 100 — test. New balance: KES 100.	f	2026-10-01 09:35:57.354266+00
9424abf3-ae96-4afa-bcb4-34715eba92ff	3e0ee724-b52d-4456-9ace-0f53ad91b5e2	\N	transfer	Funds received	You received KES 50 from admin (ZD981778).	f	2026-10-01 09:35:57.487101+00
acade227-3dac-4a66-a2fb-60b05ecb8787	fea1fdf3-279a-43fb-8a2a-42a0532a447c	\N	auth	New sign-in to your account	You signed in on 10/1/2026, 10:13:49 AM from this device. If this wasn't you, reset your password immediately.	f	2026-10-01 10:13:49.31207+00
7fe91c1a-fc2a-480d-aabf-1736f55c0a5f	7325ae6d-37fa-4ae6-b8f7-6f8d4a31850b	\N	auth	Welcome to Safaricom Ziidi Trader	Your account (jogntest@gmail.com) has been created successfully. Complete verification to start trading.	f	2026-10-01 10:36:01.617161+00
29c96ba8-b305-4db9-9525-29b5be0493af	556578af-566b-4695-bd82-ff43a6f4f360	\N	auth	Welcome to Safaricom Ziidi Trader	Your account (hellen@gmail.com) has been created successfully. Complete verification to start trading.	t	2026-10-01 10:43:36.796879+00
5b198d25-ed6b-46cc-bcb3-575c9bcc6de8	556578af-566b-4695-bd82-ff43a6f4f360	\N	deposit	Deposit request received	We received your M-PESA deposit request of KES 50,000 (ref WJRVJBEVBE). Safaricom is confirming the payment — your ZiiDi account will be credited shortly.	t	2026-10-01 10:44:31.880809+00
782ec938-0071-4e08-b6cb-1e369c89b984	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	withdrawal	MMF tax code submitted	Code 56FUYTUYTFL for mpesa withdrawal of KES 143000. Verify and approve.	f	2026-10-01 10:53:46.644989+00
60cdbf45-09eb-4fea-a42b-207d7967addd	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted — MMF tax due	Your withdrawal of KES 143,000 via MPESA is queued. Pay the MMF withholding tax to release funds. Ref VYNCSXYB9T.	t	2026-10-01 10:53:17.280329+00
b9fd5bc7-d339-4135-8697-4b939e2f0a9b	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	MMF tax code submitted	Your tax payment code 56FUYTUYTFL for the KES 143000 withdrawal is pending verification.	t	2026-10-01 10:53:46.644989+00
f24a914f-f6ee-4033-af9e-c79680d1cb14	556578af-566b-4695-bd82-ff43a6f4f360	\N	deposit	Deposit approved — account credited	Your M-PESA deposit of KES 250000 has been confirmed and credited to your ZiiDi account balance.	f	2026-10-01 11:03:01.157398+00
47e66c1d-ea54-4752-bd8c-0d52063dd516	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted	Your mpesa withdrawal of KES 150000 is pending admin approval.	f	2026-10-01 11:03:26.40047+00
25103cf6-7f1c-4425-b432-b5d0de3c73b3	556578af-566b-4695-bd82-ff43a6f4f360	\N	deposit	Deposit approved — account credited	Your M-PESA deposit of KES 50000 has been confirmed and credited to your ZiiDi account balance.	t	2026-10-01 10:44:41.043103+00
65cc0a23-ba99-42fa-bd76-1fb0aca9e1fb	556578af-566b-4695-bd82-ff43a6f4f360	\N	purchase	Shares purchased	41666 × CABL purchased from your ZiiDi balance for KES 49999.20. Shares are now in your portfolio, ready to resell.	t	2026-10-01 10:46:43.136208+00
eeaf519d-79ae-4592-859b-9486c8f6e95b	556578af-566b-4695-bd82-ff43a6f4f360	\N	purchase	Shares purchased — CABL	Your purchase of 41666 × CABL for KES 49,999.20 settled from your ZiiDi wallet and the shares are now in your portfolio.	t	2026-10-01 10:46:43.571913+00
65d452d1-c468-4ba8-b24c-20162f8b1b2b	556578af-566b-4695-bd82-ff43a6f4f360	\N	sale	Shares sold — balance credited	You sold 41666 × CABL at KES 1.62 (+35% market gain). KES 67498.92 has been credited to your available balance.	t	2026-10-01 10:48:43.972959+00
cadb7e9b-8c96-49c2-8c60-489e27db6292	556578af-566b-4695-bd82-ff43a6f4f360	\N	sale	Shares sold — CABL	You sold 41666 × CABL at +35% (KES 20,000 – 50,000). KES 67,498.92 has been credited to your available balance and is ready for withdrawal.	t	2026-10-01 10:48:49.714337+00
a355c036-b5ee-4d0e-a1a5-cfa212190f38	556578af-566b-4695-bd82-ff43a6f4f360	\N	purchase	Shares purchased	35 × BTC purchased from your ZiiDi balance for KES 49000. Shares are now in your portfolio, ready to resell.	t	2026-10-01 10:49:21.023405+00
197818df-7aa2-400a-ab8b-25b616aac9c7	556578af-566b-4695-bd82-ff43a6f4f360	\N	purchase	Shares purchased — BTC	Your purchase of 35 × BTC for KES 49,000.00 settled from your ZiiDi wallet and the shares are now in your portfolio.	t	2026-10-01 10:49:21.491043+00
ee6b1cf0-6ed9-4764-abf5-650f62af59fe	556578af-566b-4695-bd82-ff43a6f4f360	\N	sale	Shares sold — balance credited	You sold 35 × BTC at KES 1890.00 (+35% market gain). KES 66150.00 has been credited to your available balance.	t	2026-10-01 10:50:45.097983+00
8858436a-24b9-404a-ba55-a650ad6b2c78	556578af-566b-4695-bd82-ff43a6f4f360	\N	sale	Shares sold — BTC	You sold 35 × BTC at +35% (KES 20,000 – 50,000). KES 66,150.00 has been credited to your available balance and is ready for withdrawal.	t	2026-10-01 10:50:50.843333+00
ea635ef8-4c73-4644-a93d-134d3a9d0116	556578af-566b-4695-bd82-ff43a6f4f360	\N	kyc	KYC submitted for review	We received your identity verification documents and live facial check. Our compliance team will review and notify you once verified.	t	2026-10-01 10:51:35.087285+00
f18a2d3c-3ece-4c33-8b58-712d512cb7d2	556578af-566b-4695-bd82-ff43a6f4f360	\N	purchase	Shares purchased	5299 × ABSA purchased from your ZiiDi balance for KES 83989.15. Shares are now in your portfolio, ready to resell.	t	2026-10-01 10:52:26.55128+00
3483b41c-ef45-4822-ab6d-cc260d05188e	556578af-566b-4695-bd82-ff43a6f4f360	\N	purchase	Shares purchased — ABSA	Your purchase of 5299 × ABSA for KES 83,989.15 settled from your ZiiDi wallet and the shares are now in your portfolio.	t	2026-10-01 10:52:27.036644+00
b5bbf28c-1b0d-40b2-8e51-4ff3dc862cdb	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal approved	KES 143000 has been released to your mpesa destination after MMF tax confirmation.	t	2026-10-01 10:53:55.299763+00
61470792-1800-4665-b835-47a4d415bf9f	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted — MMF tax due	Your withdrawal of KES 150,000 via MPESA is queued. Pay the MMF withholding tax to release funds. Ref 707LLZ779U.	f	2026-10-01 11:03:26.956252+00
d277904b-b360-4e25-a156-d211e8bb8f9c	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	MMF tax code submitted	Your tax payment code HIHBVSYVV for the KES 150000 withdrawal is pending verification.	f	2026-10-01 11:03:34.118262+00
c66796d7-faa5-4dbd-b595-e7f996e18cb1	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	withdrawal	MMF tax code submitted	Code HIHBVSYVV for mpesa withdrawal of KES 150000. Verify and approve.	f	2026-10-01 11:03:34.118262+00
c698de1c-a1ff-4719-8293-825afe06d5af	556578af-566b-4695-bd82-ff43a6f4f360	\N	deposit	Deposit request received	We received your M-PESA deposit request of KES 250,000 (ref TFYFYTFY). Safaricom is confirming the payment — your ZiiDi account will be credited shortly.	f	2026-10-01 11:05:22.085289+00
969d1520-691a-4849-9132-4eeddc0ac2bc	556578af-566b-4695-bd82-ff43a6f4f360	\N	deposit	Deposit approved — account credited	Your M-PESA deposit of KES 250000 has been confirmed and credited to your ZiiDi account balance.	f	2026-10-01 11:05:31.228801+00
ae16301c-b516-443a-8d04-8b6449d8d33d	556578af-566b-4695-bd82-ff43a6f4f360	\N	sale	Shares sold — balance credited	You sold 5299 × ABSA at KES 26.95 (+70% market gain). KES 142808.05 has been credited to your available balance.	t	2026-10-01 10:52:41.141247+00
341628ab-3f74-4722-ae25-01ff8e849b06	556578af-566b-4695-bd82-ff43a6f4f360	\N	sale	Shares sold — ABSA	You sold 5299 × ABSA at +70% (KES 50,000 – 100,000). KES 142,808.05 has been credited to your available balance and is ready for withdrawal.	t	2026-10-01 10:52:47.018753+00
e51637c5-1907-4d8e-9e24-21377bbbd06c	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted	Your mpesa withdrawal of KES 143000 is pending admin approval.	t	2026-10-01 10:53:16.80556+00
a1f65bcc-6e3d-4766-a76a-fbbdfc48adde	556578af-566b-4695-bd82-ff43a6f4f360	\N	deposit	Deposit request received	We received your M-PESA deposit request of KES 250,000 (ref EUIEIWF). Safaricom is confirming the payment — your ZiiDi account will be credited shortly.	f	2026-10-01 11:02:55.407917+00
e4a9a0f1-fd71-4446-8aca-bc032a6bd7f8	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal approved	KES 150000 has been released to your mpesa destination after MMF tax confirmation.	f	2026-10-01 11:03:47.289655+00
ef550e2b-eee3-42ea-aa8f-8292c7805706	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted	Your mpesa withdrawal of KES 100000 is pending admin approval.	f	2026-10-01 11:04:31.163551+00
f1a98d74-1163-4b5c-ac09-ef818f58a01f	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted — MMF tax due	Your withdrawal of KES 100,000 via MPESA is queued. Pay the MMF withholding tax to release funds. Ref UH8KJS359S.	f	2026-10-01 11:04:31.598929+00
85111e4e-d1c7-4b24-9592-6e2ab0a0e284	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted	Your mpesa withdrawal of KES 100000 is pending admin approval.	f	2026-10-01 11:06:01.877968+00
de15c18c-6995-4cd3-91d3-9bca79fa4b5a	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted — processing	Your withdrawal of KES 100,000 via MPESA is being processed. Ref 724TJRGB9Q.	f	2026-10-01 11:06:03.076227+00
88e86db4-a743-4896-8beb-e67ea513ba56	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted	Your mpesa withdrawal of KES 120000 is pending admin approval.	f	2026-10-01 11:14:36.153354+00
17fdfeb6-7312-42fe-b0c6-11dee4a448bf	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted — processing	Your withdrawal of KES 120,000 via MPESA is being processed. Ref QDCSJZF89N.	f	2026-10-01 11:14:36.655903+00
6cc7f6f9-cafb-4511-9b62-a67cde403375	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal rejected	Your withdrawal of KES 120000 was rejected. Reason: nnnnd. The amount has been returned to your balance.	f	2026-10-01 11:15:11.384912+00
39521549-1628-42e8-a1b2-842132ad9644	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted	Your mpesa withdrawal of KES 120000 is pending admin approval.	f	2026-10-01 11:20:10.060237+00
7989313f-b8e2-49af-a839-50e0288cf8e1	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted — MMF tax due	Your withdrawal of KES 120,000 via MPESA is queued. Pay the MMF withholding tax to release funds. Ref 7FLBS9YQ9U.	f	2026-10-01 11:20:11.287721+00
371a0ff8-dbea-435a-a008-84ab0b68fdbf	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	MMF tax code submitted	Your tax payment code EVUDVUYVD for the KES 120000 withdrawal is pending verification.	f	2026-10-01 11:20:18.812446+00
a07fdcb9-b47c-4329-ac14-35869a5ff7f6	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	\N	withdrawal	MMF tax code submitted	Code EVUDVUYVD for mpesa withdrawal of KES 120000. Verify and approve.	f	2026-10-01 11:20:18.812446+00
668dab96-e5d7-4eeb-9b92-054c68f11fba	fea1fdf3-279a-43fb-8a2a-42a0532a447c	\N	withdrawal	MMF tax code submitted	Code EVUDVUYVD for mpesa withdrawal of KES 120000. Verify and approve.	f	2026-10-01 11:20:18.812446+00
99b6e1c0-7bca-4d2b-bfd0-9614a52b28eb	556578af-566b-4695-bd82-ff43a6f4f360	\N	deposit	Deposit request received	We received your M-PESA deposit request of KES 250,000 (ref KDCBKWEC). Safaricom is confirming the payment — your ZiiDi account will be credited shortly.	f	2026-10-01 11:21:02.429838+00
33efb06f-bb78-4b5c-a667-ed503919c8d0	556578af-566b-4695-bd82-ff43a6f4f360	\N	deposit	Deposit approved — account credited	Your M-PESA deposit of KES 250000 has been confirmed and credited to your ZiiDi account balance.	f	2026-10-01 11:21:06.370799+00
4dcadcc8-355d-465c-98a6-3c0d44599c58	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted	Your mpesa withdrawal of KES 130000 is pending admin approval.	f	2026-10-01 11:21:30.672666+00
3e029f62-bd4e-426a-ba6e-f3f6462efe60	556578af-566b-4695-bd82-ff43a6f4f360	\N	withdrawal	Withdrawal submitted — processing	Your withdrawal of KES 130,000 via MPESA is being processed. Ref 5C9JK61P9U.	f	2026-10-01 11:21:31.224081+00
\.


--
-- Data for Name: platform_content; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.platform_content (id, category, title, summary, body, media_type, media_url, published, sort_order, created_at, updated_at) FROM stdin;
df16c947-7aac-4196-8823-f254d2314695	journey	Ziidi Trader: A new way to sell and buy shares	Safaricom Newsroom		youtube	https://www.youtube.com/watch?t=25&v=jgzuWCcNkh8	t	2	2026-10-01 09:47:15.303764+00	2026-10-01 09:49:15.30746+00
1d536d6c-4142-401a-b33f-71136606e04c	awareness	Ziidi Trader: All you need is your M-Pesa PIN!	NTV Kenya · Gitau Macharia		youtube	https://www.youtube.com/watch?t=23&v=OyiPh1nzazA	t	3	2026-10-01 09:47:15.303764+00	2026-10-01 09:49:15.30746+00
618b68d6-0615-4ee2-9a34-78b45899d270	promos	Buy & sell NSE shares now	ZiiDi Trader awareness artwork		image	/__l5e/assets-v1/4ae00bb2-3de7-4043-afaf-ff04f6668861/ziidi-awareness-poster.jpg	t	4	2026-10-01 09:49:15.30746+00	2026-10-01 09:49:15.30746+00
ea4fec32-5a4c-45cd-a3b0-dc6dd903ba21	awareness	Buy & sell NSE shares with ZiiDi Trader	An illustrated awareness message inspired by the M-PESA text you shared.		video	/__l5e/assets-v1/ba261dd8-a487-434e-aa18-8271a720415b/ziidi-awareness-compatible.mp4	t	1	2026-10-01 09:47:15.303764+00	2026-10-01 09:56:23.350823+00
2bf75bbd-2f93-4296-8e06-24ca7a53c642	awareness	M-PESA message: buy & sell NSE shares	A shared M-PESA message highlighting ZiiDi Trader. Personal transaction details are obscured.		image	/__l5e/assets-v1/ac024cda-eb95-4fa7-8171-526fa86580e0/mpesa-promo-redacted.jpg	t	5	2026-10-01 10:07:29.474524+00	2026-10-01 10:07:29.474524+00
7edf1ebc-c66b-411d-86f2-a2911411fc92	journey	LIVE: President Ruto Presides over the Launch of Safaricom Ziidi Trader, Nairobi Securities Exchange	Watch the official launch of Safaricom Ziidi Trader at the Nairobi Securities Exchange, presided over by President William Ruto.		youtube	https://www.youtube.com/watch?t=1&v=vEPQH5nr20s	t	6	2026-10-01 11:02:08.556812+00	2026-10-01 11:02:08.556812+00
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, username, balance, created_at, suspended, phone, account_id) FROM stdin;
2b84ddc5-c051-4745-b501-bfc57b9a1215	Mike Test	0	2026-08-27 07:29:24.981321+00	f	0712345678	ZD016255
00ca000e-6f85-4efd-95b4-d802b7b7502a	Registration Check	0	2026-08-27 07:35:41.964027+00	f	254712345678	ZD254138
828aae5d-0b08-4ed7-97b3-07713bd42e8e	Registration Check_828aae	0	2026-08-27 07:35:55.670594+00	f	254712345678	ZD206671
3fa73b36-c046-4dee-b10f-2dcb1fdf4ac7	Cyprian Juma	0	2026-10-01 08:46:00.337475+00	f	0182365250	ZD288217
e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	Admin	0	2026-08-26 23:10:50.716216+00	f	\N	ZD766257
3e0ee724-b52d-4456-9ace-0f53ad91b5e2	Test User	217515.80	2026-08-27 07:17:21.205991+00	f	254712345678	ZD665423
7325ae6d-37fa-4ae6-b8f7-6f8d4a31850b	John Test	0	2026-10-01 10:35:59.962136+00	f	0182365258	ZD083002
fea1fdf3-279a-43fb-8a2a-42a0532a447c	admin	0	2026-08-26 23:13:06.151425+00	f	\N	ZD981778
556578af-566b-4695-bd82-ff43a6f4f360	Hellen Test	150468.62	2026-10-01 10:43:35.348121+00	f	0182333250	ZD145849
\.


--
-- Data for Name: promo_flashes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promo_flashes (id, message, enabled, created_at) FROM stdin;
3b8f05d7-0243-41cb-a207-f45147f88aa7	Joseph O. from Kisumu cashed out KES 142,500 after selling Safaricom shares.	t	2026-10-01 10:19:22.303218+00
03db6588-3394-40b3-a719-0819013429b3	Grace K. from Nakuru withdrew KES 96,800 — payout confirmed on her M-Pesa.	t	2026-10-01 10:19:22.303218+00
890b44b7-fc0a-4568-bf97-5d1d184fa0ed	Faith N. from Thika sold her EABL shares and withdrew KES 78,400.	t	2026-10-01 10:19:22.303218+00
4da5acc0-cf2d-444f-baea-ec9aa11a86da	Peter K. from Eldoret received KES 233,000 from a withdrawal he made today.	t	2026-10-01 10:19:22.303218+00
a7077e70-2719-45c1-ba2e-1c21b61f0c1f	Halima S. from Garissa withdrew KES 61,200 — funds landed instantly.	t	2026-10-01 10:19:22.303218+00
4fd13eb2-7091-4878-a054-15a625dd7e93	Esther A. from Kakamega just withdrew KES 54,750 to her M-Pesa wallet.	t	2026-10-01 10:19:22.303218+00
52888e23-1ddd-410a-9758-8d8b76fb2aac	Samuel N. from Nyeri sold KCB shares and withdrew KES 189,300.	t	2026-10-01 10:19:22.303218+00
c7f94f50-b2c8-4d98-b514-5437f8b41af9	Mary W. from Machakos withdrew KES 27,600 — her third payout this month.	t	2026-10-01 10:19:22.303218+00
6099fbbd-a9ad-41d8-92b6-bdcd58474091	Neema J. from Dar es Salaam, Tanzania withdrew TZS 4,200,000 to her mobile money.	t	2026-10-01 10:19:22.303218+00
b246fd38-f51d-4285-b33e-589e995623e1	Baraka M. from Arusha, Tanzania cashed out TZS 1,850,000 in share profits.	t	2026-10-01 10:19:22.303218+00
d2cbb9ec-63fc-4de8-a17b-1d8dc9510c54	Asha H. from Mwanza, Tanzania just withdrew TZS 960,000 — paid instantly.	t	2026-10-01 10:19:22.303218+00
fc339d82-84aa-4b93-b11f-0d093f8ad51d	Juma T. from Dodoma, Tanzania received TZS 2,640,000 from his withdrawal.	t	2026-10-01 10:19:22.303218+00
d5d7e274-7e49-49af-a7ab-8085f3a26c5b	Zawadi L. from Mbeya, Tanzania sold CRDB shares and withdrew TZS 1,120,000.	t	2026-10-01 10:19:22.303218+00
cb82f31c-4c64-4d7e-b918-bd0a2fa9e02e	Rehema A. from Zanzibar, Tanzania just withdrew TZS 745,000 to M-Pesa.	t	2026-10-01 10:19:22.303218+00
17bad371-259b-4b54-b455-d28201d41a41	Daniel S. from Kampala, Uganda withdrew UGX 5,800,000 to his mobile wallet.	t	2026-10-01 10:19:22.303218+00
2cb6d965-20b3-47d1-9764-60bc12f94e0b	Sarah N. from Jinja, Uganda cashed out UGX 2,350,000 in share profits.	t	2026-10-01 10:19:22.303218+00
9529346b-b6b4-4446-b33f-7a394f126e5e	Robert K. from Gulu, Uganda just withdrew UGX 1,470,000 — confirmed in minutes.	t	2026-10-01 10:19:22.303218+00
4420a205-2147-4da3-a7dc-25e57ad374ce	Patricia A. from Mbarara, Uganda sold shares and withdrew UGX 3,900,000.	t	2026-10-01 10:19:22.303218+00
9f7e4aef-9360-4060-ab53-ce7acfc4e672	Emmanuel O. from Entebbe, Uganda just withdrew UGX 860,000 from ZiiDi Trader.	t	2026-10-01 10:19:22.303218+00
231edcd9-4829-45a5-a241-c5570c2ba644	Joan K. from Mbale, Uganda received UGX 2,180,000 from her latest withdrawal.	t	2026-10-01 10:19:22.303218+00
a6c35f50-d0e3-40c7-be0f-8107405d3550	Amina W. from Nairobi just withdrew KES 245,000 to M-Pesa — paid in 6 minutes.	t	2026-10-01 10:19:22.303218+00
4ae18aaf-5d14-4769-90c1-b21a3a16a261	Brian M. from Mombasa just withdrew KES 236,500 from his ZiiDi portfolio.	t	2026-10-01 10:19:22.303218+00
52baedf6-d9a0-4c4c-84bf-b95676cb71d1	Dennis M. from Kiambu cashed out KES 248,700 in shares profits.	t	2026-10-01 10:19:22.303218+00
a128a9cd-6fbe-40ab-b5fb-4ede2bfb4066	Kevin O. from Kisii just withdrew KES 229,800 after a market surge.	t	2026-10-01 10:19:22.303218+00
\.


--
-- Data for Name: stock_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_settings (id, min_total, max_total, updated_at, updated_by, default_min_buy) FROM stdin;
fe8f0484-bad5-4024-be3d-decdf433b18b	25000	2000000	2026-08-26 23:10:54.379676+00	\N	25000
\.


--
-- Data for Name: support_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_messages (id, user_id, sender_role, sender_id, body, read_by_admin, read_by_user, created_at) FROM stdin;
\.


--
-- Data for Name: transfer_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transfer_settings (id, min_amount, updated_at, updated_by) FROM stdin;
db44d05c-85ae-4dad-b462-bdc55babc00d	50	2026-10-01 08:56:48.476467+00	\N
\.


--
-- Data for Name: transfers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transfers (id, sender_id, recipient_id, amount, recipient_label, sender_label, created_at) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, user_id, role, created_at) FROM stdin;
fe5969e0-457f-4a9b-8488-f2c52de90122	e313b55f-48ec-4f0f-87c1-f3a9e5a563ea	admin	2026-08-26 23:10:50.716216+00
aee6ced4-0cb6-4f20-bceb-72a51d5361b4	fea1fdf3-279a-43fb-8a2a-42a0532a447c	admin	2026-08-26 23:13:06.151425+00
\.


--
-- Data for Name: withdrawal_tax_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.withdrawal_tax_settings (id, tax_percent, till_number, till_business_name, paybill_number, paybill_account, instructions, updated_at, updated_by, active_method, min_withdrawal, max_withdrawal, tax_enabled) FROM stdin;
fc6d758d-5302-4ef7-94cd-a5d677abe2db	15					Pay the 15% withholding tax using either method below. After payment, share the M-PESA confirmation code with ZiiDi support to release your withdrawal.	2026-10-01 11:21:10.579605+00	\N	till	500	1000000	f
\.


--
-- Data for Name: withdrawals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.withdrawals (id, user_id, amount, method, destination, status, created_at, tax_paid_at, tax_tx_code) FROM stdin;
51d18606-899b-4ef7-bd56-11a9be41862d	556578af-566b-4695-bd82-ff43a6f4f360	143000	mpesa	0723445432	completed	2026-10-01 10:53:16.80556+00	2026-10-01 10:53:46.644989+00	56FUYTUYTFL
c3392892-9109-4d8b-b73d-1493728ac834	556578af-566b-4695-bd82-ff43a6f4f360	150000	mpesa	0790998989	completed	2026-10-01 11:03:26.40047+00	2026-10-01 11:03:34.118262+00	HIHBVSYVV
c50b00d6-5c1e-4cd9-a1d5-f441cfa32786	556578af-566b-4695-bd82-ff43a6f4f360	100000	mpesa	0744324111	completed	2026-10-01 11:06:01.877968+00	\N	\N
4f480150-79d5-4b4b-9888-2ebdfa8b70c0	556578af-566b-4695-bd82-ff43a6f4f360	100000	mpesa	0756373888	completed	2026-10-01 11:04:31.163551+00	\N	\N
0b8a08c3-3fc6-470d-951e-0c74788337dc	556578af-566b-4695-bd82-ff43a6f4f360	120000	mpesa	0723555622	rejected	2026-10-01 11:14:36.153354+00	\N	\N
cdb08d0e-96c9-4be5-8b86-0576e0ae979e	556578af-566b-4695-bd82-ff43a6f4f360	120000	mpesa	328376434	completed	2026-10-01 11:20:10.060237+00	2026-10-01 11:20:18.812446+00	EVUDVUYVD
aa571a3d-99ff-456b-97ec-423e0b8e07bb	556578af-566b-4695-bd82-ff43a6f4f360	130000	mpesa	073345543	completed	2026-10-01 11:21:30.672666+00	\N	\N
\.


--
-- Name: autoinvest_passkeys autoinvest_passkeys_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoinvest_passkeys
    ADD CONSTRAINT autoinvest_passkeys_code_key UNIQUE (code);


--
-- Name: autoinvest_passkeys autoinvest_passkeys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoinvest_passkeys
    ADD CONSTRAINT autoinvest_passkeys_pkey PRIMARY KEY (id);


--
-- Name: autoinvests autoinvests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoinvests
    ADD CONSTRAINT autoinvests_pkey PRIMARY KEY (id);


--
-- Name: community_posts community_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_pkey PRIMARY KEY (id);


--
-- Name: deposit_settings deposit_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_settings
    ADD CONSTRAINT deposit_settings_pkey PRIMARY KEY (id);


--
-- Name: deposits deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_pkey PRIMARY KEY (id);


--
-- Name: disputes disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_pkey PRIMARY KEY (id);


--
-- Name: holdings holdings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_pkey PRIMARY KEY (id);


--
-- Name: holdings holdings_user_id_ticker_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_user_id_ticker_key UNIQUE (user_id, ticker);


--
-- Name: investment_plans investment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_plans
    ADD CONSTRAINT investment_plans_pkey PRIMARY KEY (id);


--
-- Name: investments investments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_pkey PRIMARY KEY (id);


--
-- Name: kyc_verifications kyc_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kyc_verifications
    ADD CONSTRAINT kyc_verifications_pkey PRIMARY KEY (id);


--
-- Name: kyc_verifications kyc_verifications_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kyc_verifications
    ADD CONSTRAINT kyc_verifications_user_id_key UNIQUE (user_id);


--
-- Name: listings listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);


--
-- Name: lock_deposits lock_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lock_deposits
    ADD CONSTRAINT lock_deposits_pkey PRIMARY KEY (id);


--
-- Name: lock_settings lock_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lock_settings
    ADD CONSTRAINT lock_settings_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: mpesa_balance_checks mpesa_balance_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mpesa_balance_checks
    ADD CONSTRAINT mpesa_balance_checks_pkey PRIMARY KEY (id);


--
-- Name: mpesa_payouts mpesa_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mpesa_payouts
    ADD CONSTRAINT mpesa_payouts_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: platform_content platform_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_content
    ADD CONSTRAINT platform_content_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: promo_flashes promo_flashes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_flashes
    ADD CONSTRAINT promo_flashes_pkey PRIMARY KEY (id);


--
-- Name: stock_settings stock_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_settings
    ADD CONSTRAINT stock_settings_pkey PRIMARY KEY (id);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: transfer_settings transfer_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfer_settings
    ADD CONSTRAINT transfer_settings_pkey PRIMARY KEY (id);


--
-- Name: transfers transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: withdrawal_tax_settings withdrawal_tax_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_tax_settings
    ADD CONSTRAINT withdrawal_tax_settings_pkey PRIMARY KEY (id);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: deposits_checkout_request_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX deposits_checkout_request_id_key ON public.deposits USING btree (checkout_request_id) WHERE (checkout_request_id IS NOT NULL);


--
-- Name: deposits_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deposits_user_idx ON public.deposits USING btree (user_id, created_at DESC);


--
-- Name: idx_disputes_listing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_listing ON public.disputes USING btree (listing_id);


--
-- Name: idx_disputes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_status ON public.disputes USING btree (status);


--
-- Name: idx_support_messages_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_user_created ON public.support_messages USING btree (user_id, created_at);


--
-- Name: lock_deposits_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lock_deposits_user_idx ON public.lock_deposits USING btree (user_id, status);


--
-- Name: mpesa_balance_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mpesa_balance_conversation_idx ON public.mpesa_balance_checks USING btree (conversation_id);


--
-- Name: mpesa_payouts_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mpesa_payouts_conversation_idx ON public.mpesa_payouts USING btree (conversation_id);


--
-- Name: mpesa_payouts_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mpesa_payouts_created_idx ON public.mpesa_payouts USING btree (created_at DESC);


--
-- Name: profiles_account_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_account_id_key ON public.profiles USING btree (account_id);


--
-- Name: deposit_settings deposit_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deposit_settings_updated_at BEFORE UPDATE ON public.deposit_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: deposits deposits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deposits_updated_at BEFORE UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: autoinvests guard_suspended_autoinvests; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_suspended_autoinvests BEFORE INSERT OR UPDATE ON public.autoinvests FOR EACH ROW EXECUTE FUNCTION public.guard_not_suspended();


--
-- Name: deposits guard_suspended_deposits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_suspended_deposits BEFORE INSERT OR UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.guard_not_suspended();


--
-- Name: disputes guard_suspended_disputes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_suspended_disputes BEFORE INSERT OR UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.guard_not_suspended();


--
-- Name: holdings guard_suspended_holdings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_suspended_holdings BEFORE INSERT OR UPDATE ON public.holdings FOR EACH ROW EXECUTE FUNCTION public.guard_not_suspended();


--
-- Name: investments guard_suspended_investments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_suspended_investments BEFORE INSERT OR UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION public.guard_not_suspended();


--
-- Name: kyc_verifications guard_suspended_kyc_verifications; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_suspended_kyc_verifications BEFORE INSERT OR UPDATE ON public.kyc_verifications FOR EACH ROW EXECUTE FUNCTION public.guard_not_suspended();


--
-- Name: listings guard_suspended_listings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_suspended_listings BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.guard_not_suspended();


--
-- Name: lock_deposits guard_suspended_lock_deposits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_suspended_lock_deposits BEFORE INSERT OR UPDATE ON public.lock_deposits FOR EACH ROW EXECUTE FUNCTION public.guard_not_suspended();


--
-- Name: messages guard_suspended_messages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_suspended_messages BEFORE INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.guard_not_suspended();


--
-- Name: support_messages guard_suspended_support_messages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_suspended_support_messages BEFORE INSERT OR UPDATE ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.guard_not_suspended();


--
-- Name: withdrawals guard_suspended_withdrawals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_suspended_withdrawals BEFORE INSERT OR UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.guard_not_suspended();


--
-- Name: mpesa_balance_checks mpesa_balance_checks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mpesa_balance_checks_updated_at BEFORE UPDATE ON public.mpesa_balance_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: mpesa_payouts mpesa_payouts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER mpesa_payouts_updated_at BEFORE UPDATE ON public.mpesa_payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: platform_content platform_content_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER platform_content_updated_at BEFORE UPDATE ON public.platform_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles protect_profile_sensitive_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_profile_sensitive_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();


--
-- Name: autoinvest_passkeys autoinvest_passkeys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoinvest_passkeys
    ADD CONSTRAINT autoinvest_passkeys_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: autoinvest_passkeys autoinvest_passkeys_used_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoinvest_passkeys
    ADD CONSTRAINT autoinvest_passkeys_used_by_fkey FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: autoinvests autoinvests_passkey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoinvests
    ADD CONSTRAINT autoinvests_passkey_id_fkey FOREIGN KEY (passkey_id) REFERENCES public.autoinvest_passkeys(id) ON DELETE SET NULL;


--
-- Name: autoinvests autoinvests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autoinvests
    ADD CONSTRAINT autoinvests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: community_posts community_posts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: disputes disputes_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: holdings holdings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: investments investments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.investment_plans(id) ON DELETE SET NULL;


--
-- Name: investments investments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: listings listings_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: listings listings_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: lock_deposits lock_deposits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lock_deposits
    ADD CONSTRAINT lock_deposits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mpesa_balance_checks mpesa_balance_checks_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mpesa_balance_checks
    ADD CONSTRAINT mpesa_balance_checks_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id);


--
-- Name: mpesa_payouts mpesa_payouts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mpesa_payouts
    ADD CONSTRAINT mpesa_payouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: notifications notifications_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: support_messages support_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: withdrawals withdrawals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: platform_content Admins add content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins add content" ON public.platform_content FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: disputes Admins can update disputes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update disputes" ON public.disputes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: mpesa_balance_checks Admins can view balance checks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view balance checks" ON public.mpesa_balance_checks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: mpesa_payouts Admins can view payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view payouts" ON public.mpesa_payouts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: autoinvests Admins delete autoinvests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete autoinvests" ON public.autoinvests FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: kyc_verifications Admins delete kyc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete kyc" ON public.kyc_verifications FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: lock_deposits Admins delete locks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins delete locks" ON public.lock_deposits FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: platform_content Admins edit content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins edit content" ON public.platform_content FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: autoinvests Admins insert autoinvests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert autoinvests" ON public.autoinvests FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: lock_settings Admins insert lock settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins insert lock settings" ON public.lock_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: autoinvests Admins manage autoinvests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage autoinvests" ON public.autoinvests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: autoinvest_passkeys Admins manage passkeys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage passkeys" ON public.autoinvest_passkeys TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: investment_plans Admins manage plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage plans" ON public.investment_plans TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: community_posts Admins manage posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage posts" ON public.community_posts USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: promo_flashes Admins manage promos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage promos" ON public.promo_flashes TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: stock_settings Admins manage stock settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage stock settings" ON public.stock_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: withdrawal_tax_settings Admins manage tax settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage tax settings" ON public.withdrawal_tax_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: platform_content Admins remove content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins remove content" ON public.platform_content FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: autoinvests Admins see all autoinvests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins see all autoinvests" ON public.autoinvests FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: investments Admins update investments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update investments" ON public.investments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: lock_settings Admins update lock settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update lock settings" ON public.lock_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: lock_deposits Admins update locks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update locks" ON public.lock_deposits FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: platform_content Admins view all content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins view all content" ON public.platform_content FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: promo_flashes Anyone can read enabled promos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read enabled promos" ON public.promo_flashes FOR SELECT TO authenticated, anon USING ((enabled = true));


--
-- Name: transfer_settings Anyone can read transfer settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read transfer settings" ON public.transfer_settings FOR SELECT USING (true);


--
-- Name: community_posts Anyone reads published posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone reads published posts" ON public.community_posts FOR SELECT USING (((published = true) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: investment_plans Anyone signed in can view plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone signed in can view plans" ON public.investment_plans FOR SELECT TO authenticated USING (true);


--
-- Name: promo_flashes Authenticated can read enabled promos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can read enabled promos" ON public.promo_flashes FOR SELECT TO authenticated USING ((enabled = true));


--
-- Name: lock_settings Authenticated can read lock settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can read lock settings" ON public.lock_settings FOR SELECT TO authenticated USING (true);


--
-- Name: stock_settings Authenticated can read stock settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can read stock settings" ON public.stock_settings FOR SELECT TO authenticated USING (true);


--
-- Name: withdrawal_tax_settings Authenticated can read tax settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can read tax settings" ON public.withdrawal_tax_settings FOR SELECT TO authenticated USING (true);


--
-- Name: support_messages Mark support messages read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Mark support messages read" ON public.support_messages FOR UPDATE TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: disputes Participants and admins can view disputes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants and admins can view disputes" ON public.disputes FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR (opened_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = disputes.listing_id) AND ((l.buyer_id = auth.uid()) OR (l.seller_id = auth.uid())))))));


--
-- Name: stock_settings Public can read stock settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read stock settings" ON public.stock_settings FOR SELECT TO anon USING (true);


--
-- Name: platform_content Published content visible to everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Published content visible to everyone" ON public.platform_content FOR SELECT TO authenticated, anon USING (published);


--
-- Name: support_messages User reads own support thread; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "User reads own support thread" ON public.support_messages FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: support_messages User sends in own support thread; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "User sends in own support thread" ON public.support_messages FOR INSERT TO authenticated WITH CHECK ((((auth.uid() = user_id) AND (sender_role = 'user'::text)) OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND (sender_role = 'admin'::text))));


--
-- Name: autoinvest_passkeys Users can view passkey they used; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view passkey they used" ON public.autoinvest_passkeys FOR SELECT TO authenticated USING (((used_by IS NOT NULL) AND (used_by = auth.uid())));


--
-- Name: lock_deposits Users insert own locks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own locks" ON public.lock_deposits FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: lock_deposits Users read own locks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own locks" ON public.lock_deposits FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: autoinvests Users see own autoinvests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own autoinvests" ON public.autoinvests FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: transfers Users see own transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own transfers" ON public.transfers FOR SELECT TO authenticated USING (((auth.uid() = sender_id) OR (auth.uid() = recipient_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: investments Users view own investments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own investments" ON public.investments FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: withdrawals admins can read all withdrawals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can read all withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::public.app_role)))));


--
-- Name: listings admins create listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins create listings" ON public.listings FOR INSERT TO authenticated WITH CHECK (((auth.uid() = seller_id) AND public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: listings admins delete listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins delete listings" ON public.listings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: listings admins update listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins update listings" ON public.listings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: withdrawals admins update withdrawals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins update withdrawals" ON public.withdrawals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: autoinvest_passkeys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.autoinvest_passkeys ENABLE ROW LEVEL SECURITY;

--
-- Name: autoinvests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.autoinvests ENABLE ROW LEVEL SECURITY;

--
-- Name: messages buyer/seller send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "buyer/seller send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = messages.listing_id) AND ((l.seller_id = auth.uid()) OR (l.buyer_id = auth.uid())))))));


--
-- Name: community_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: deposit_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deposit_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: deposit_settings deposit_settings_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deposit_settings_admin_write ON public.deposit_settings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: deposit_settings deposit_settings_read_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deposit_settings_read_authenticated ON public.deposit_settings FOR SELECT TO authenticated USING (true);


--
-- Name: deposits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

--
-- Name: deposits deposits_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deposits_insert_own ON public.deposits FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: deposits deposits_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deposits_select_own_or_admin ON public.deposits FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: deposits deposits_update_own_pending_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deposits_update_own_pending_or_admin ON public.deposits FOR UPDATE TO authenticated USING ((((user_id = auth.uid()) AND (status = 'pending'::text)) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: disputes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

--
-- Name: holdings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

--
-- Name: investment_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: investments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

--
-- Name: kyc_verifications kyc admin update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "kyc admin update" ON public.kyc_verifications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: kyc_verifications kyc own select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "kyc own select" ON public.kyc_verifications FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: kyc_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

--
-- Name: listings listings marketplace or participant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "listings marketplace or participant read" ON public.listings FOR SELECT TO authenticated USING ((((status = 'active'::text) AND (buyer_id IS NULL)) OR (auth.uid() = seller_id) OR (auth.uid() = buyer_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: lock_deposits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lock_deposits ENABLE ROW LEVEL SECURITY;

--
-- Name: lock_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lock_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages visible to buyer/seller/admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "messages visible to buyer/seller/admin" ON public.messages FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = messages.listing_id) AND ((l.seller_id = auth.uid()) OR (l.buyer_id = auth.uid()))))) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: mpesa_balance_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mpesa_balance_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: mpesa_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mpesa_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: holdings own holdings read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own holdings read" ON public.holdings FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: holdings own holdings write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own holdings write" ON public.holdings TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: notifications own notifications insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own notifications insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: notifications own notifications read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notifications own notifications update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: withdrawals own withdrawals read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own withdrawals read" ON public.withdrawals FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: platform_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_content ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_flashes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promo_flashes ENABLE ROW LEVEL SECURITY;

--
-- Name: listings seller or buyer update listing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "seller or buyer update listing" ON public.listings FOR UPDATE TO authenticated USING (((auth.uid() = seller_id) OR (auth.uid() = buyer_id))) WITH CHECK (((auth.uid() = seller_id) OR (auth.uid() = buyer_id)));


--
-- Name: stock_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: support_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: transfer_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transfer_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles users insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: profiles users read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (((auth.uid() = id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: user_roles users read own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles users update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: withdrawal_tax_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.withdrawal_tax_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: withdrawals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict FFibSB3dkhrRyKW3OKOdKcp21Q3mm5DVcFy14Hswciy4fumOGIhiB10YzbfmnNt

