-- Profiles: one row per signed-in account (internal immutable id = auth user id)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text,
  display_name text,
  provider text,
  provider_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Link existing paid-access tables to accounts (nullable: existing rows untouched)
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_user_id_key ON public.subscribers (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS platform text;
CREATE INDEX IF NOT EXISTS devices_user_id_idx ON public.devices (user_id) WHERE revoked_at IS NULL;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments (user_id);