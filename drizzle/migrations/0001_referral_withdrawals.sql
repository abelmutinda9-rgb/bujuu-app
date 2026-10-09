CREATE TABLE public.referral_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount >= 100),
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  request_key text NOT NULL UNIQUE,
  provider text,
  provider_reference text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_withdrawals TO authenticated;
GRANT ALL ON public.referral_withdrawals TO service_role;
ALTER TABLE public.referral_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own withdrawals read" ON public.referral_withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX referral_withdrawals_user_idx ON public.referral_withdrawals (user_id, created_at DESC);
-- At most one open (pending/processing) withdrawal per user.
CREATE UNIQUE INDEX referral_withdrawals_one_open ON public.referral_withdrawals (user_id) WHERE status IN ('pending','processing');
CREATE TRIGGER referral_withdrawals_touch BEFORE UPDATE ON public.referral_withdrawals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.referral_available_balance(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (COALESCE((SELECT sum(amount) FROM public.referral_ledger WHERE user_id = _user_id AND kind = 'reward'), 0)
        - COALESCE((SELECT sum(amount) FROM public.referral_withdrawals WHERE user_id = _user_id AND status IN ('pending','processing','paid')), 0))::int
$$;

-- Atomically reserves the user's ENTIRE available balance as one withdrawal.
CREATE OR REPLACE FUNCTION public.reserve_referral_withdrawal(_user_id uuid, _phone text, _request_key text, _min integer)
RETURNS public.referral_withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal int; _row public.referral_withdrawals;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('referral_withdrawal:' || _user_id::text));
  SELECT * INTO _row FROM public.referral_withdrawals WHERE request_key = _request_key;
  IF FOUND THEN
    IF _row.user_id <> _user_id THEN RAISE EXCEPTION 'invalid_request'; END IF;
    RETURN _row;
  END IF;
  IF EXISTS (SELECT 1 FROM public.referral_withdrawals WHERE user_id = _user_id AND status IN ('pending','processing')) THEN
    RAISE EXCEPTION 'withdrawal_in_progress';
  END IF;
  _bal := public.referral_available_balance(_user_id);
  IF _bal < _min THEN RAISE EXCEPTION 'below_minimum'; END IF;
  INSERT INTO public.referral_withdrawals (user_id, amount, phone, request_key)
  VALUES (_user_id, _bal, _phone, _request_key) RETURNING * INTO _row;
  RETURN _row;
END $$;

REVOKE ALL ON FUNCTION public.referral_available_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_referral_withdrawal(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referral_available_balance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_referral_withdrawal(uuid, text, text, integer) TO service_role;