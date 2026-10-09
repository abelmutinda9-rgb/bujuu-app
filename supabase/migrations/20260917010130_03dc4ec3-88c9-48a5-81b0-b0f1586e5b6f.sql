ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_charge_attempt_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS subscriptions_renewal_idx
  ON public.subscriptions (status, auto_renew, expires_at);