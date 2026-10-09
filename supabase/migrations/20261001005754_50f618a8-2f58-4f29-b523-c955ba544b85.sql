CREATE TABLE public.referral_codes (
  user_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own referral code" ON public.referral_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','qualified','reversed')),
  payment_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_id <> referred_id)
);
CREATE INDEX referrals_referrer_idx ON public.referrals(referrer_id);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrer sees own referrals" ON public.referrals FOR SELECT TO authenticated USING (auth.uid() = referrer_id);
CREATE TRIGGER referrals_touch BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.referral_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reward','reversal')),
  payout_status text NOT NULL DEFAULT 'unpaid' CHECK (payout_status IN ('unpaid','paid','void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referral_id, kind)
);
CREATE INDEX referral_ledger_user_idx ON public.referral_ledger(user_id);
GRANT SELECT ON public.referral_ledger TO authenticated;
GRANT ALL ON public.referral_ledger TO service_role;
ALTER TABLE public.referral_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger" ON public.referral_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);