CREATE TABLE public.subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_subscriber_idx ON public.subscriptions(subscriber_id, expires_at DESC);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  phone text NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_reference text,
  device_id uuid,
  subscriber_id uuid REFERENCES public.subscribers(id) ON DELETE SET NULL,
  applied_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_phone_idx ON public.payments(phone, created_at DESC);

CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid REFERENCES public.subscribers(id) ON DELETE CASCADE,
  secret_hash text NOT NULL,
  label text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX devices_subscriber_idx ON public.devices(subscriber_id) WHERE revoked_at IS NULL;

CREATE TABLE public.access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX access_codes_phone_idx ON public.access_codes(phone, created_at DESC);

CREATE TABLE public.media_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_cache_expires_idx ON public.media_cache(expires_at);

CREATE TABLE public.rate_limits (
  bucket text NOT NULL,
  key text NOT NULL,
  count int NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, key)
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  subscriber_id uuid,
  device_id uuid,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON public.audit_log(created_at DESC);

GRANT ALL ON public.subscribers TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.payments TO service_role;
GRANT ALL ON public.devices TO service_role;
GRANT ALL ON public.access_codes TO service_role;
GRANT ALL ON public.media_cache TO service_role;
GRANT ALL ON public.rate_limits TO service_role;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER payments_touch BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.check_rate_limit(_bucket text, _key text, _limit int, _window_seconds int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count int;
BEGIN
  INSERT INTO public.rate_limits (bucket, key, count, window_start)
  VALUES (_bucket, _key, 1, now())
  ON CONFLICT (bucket, key) DO UPDATE
    SET count = CASE WHEN public.rate_limits.window_start < now() - make_interval(secs => _window_seconds)
                     THEN 1 ELSE public.rate_limits.count + 1 END,
        window_start = CASE WHEN public.rate_limits.window_start < now() - make_interval(secs => _window_seconds)
                     THEN now() ELSE public.rate_limits.window_start END
  RETURNING count INTO _count;
  RETURN _count <= _limit;
END; $$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, int, int) TO service_role;