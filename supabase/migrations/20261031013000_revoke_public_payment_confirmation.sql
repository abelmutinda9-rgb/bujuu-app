-- Add server-owned trial start/end timestamps without deleting or resetting any data.
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Existing devices do not receive a new trial merely because this migration ran.
UPDATE public.devices
SET trial_started_at = COALESCE(trial_started_at, created_at),
    trial_ends_at = COALESCE(trial_ends_at, now())
WHERE trial_started_at IS NULL OR trial_ends_at IS NULL;

ALTER TABLE public.devices
  ALTER COLUMN trial_started_at SET DEFAULT now(),
  ALTER COLUMN trial_started_at SET NOT NULL,
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '72 hours'),
  ALTER COLUMN trial_ends_at SET NOT NULL;

-- Prevent public clients from granting subscription access by asserting payment success.
-- The verified PayHero callback/server flow is the only trusted fulfillment path.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'confirm_payment_success'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END;
$$;
