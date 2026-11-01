-- Device-bound server-side profile controls and one-time recovery codes.
-- Additive only: existing device/subscription rows are preserved.
CREATE TABLE IF NOT EXISTS public.device_controls (
  device_id uuid PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
  active_profile text NOT NULL DEFAULT 'adult' CHECK (active_profile IN ('adult', 'kids')),
  pin_salt text,
  pin_hash text,
  pin_failures integer NOT NULL DEFAULT 0 CHECK (pin_failures >= 0),
  pin_locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((pin_salt IS NULL) = (pin_hash IS NULL))
);
ALTER TABLE public.device_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_controls FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.device_controls TO service_role;

ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS recovery_token_hash text;
CREATE INDEX IF NOT EXISTS idx_devices_recovery_token_hash
  ON public.devices(recovery_token_hash) WHERE recovery_token_hash IS NOT NULL;
-- Legacy recovery_token is left untouched for data preservation; new server flows never read or accept it.

