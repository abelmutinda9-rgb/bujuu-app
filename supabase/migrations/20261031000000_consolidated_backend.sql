-- ====================================================================
-- BUJUU — CONSOLIDATED AUTHORITATIVE BACKEND MIGRATION
-- Target Supabase Project: uwhawjcknqilypbgoyxo
-- Safe, non-destructive: uses IF NOT EXISTS and preserves existing tables/data
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. TOUCH UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. PROFILES RECONCILIATION
-- Preserves existing columns (id, device_id, name, is_kids, pin, avatar, created_at)
-- and non-destructively adds Auth/User account columns.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  device_id text,
  name text,
  is_kids boolean DEFAULT false,
  pin text,
  avatar text DEFAULT 'bujuu_red',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_user_id text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_public_or_own_select') THEN
    CREATE POLICY profiles_public_or_own_select ON public.profiles
      FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_own_upsert') THEN
    CREATE POLICY profiles_own_upsert ON public.profiles
      FOR ALL USING (auth.uid() IS NULL OR auth.uid() = id)
      WITH CHECK (auth.uid() IS NULL OR auth.uid() = id);
  END IF;
END $$;

-- 4. DEVICES RECONCILIATION
-- Preserves existing device rows, 72h trials, tokens, and active subscriptions
CREATE TABLE IF NOT EXISTS public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  platform text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz,
  subscription_expires_at timestamptz,
  phone text,
  recovery_token text,
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS subscriber_id uuid,
  ADD COLUMN IF NOT EXISTS secret_hash text,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_recovery_token ON public.devices(recovery_token) WHERE recovery_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'devices' AND policyname = 'devices_read_policy') THEN
    CREATE POLICY devices_read_policy ON public.devices
      FOR SELECT USING (true);
  END IF;
END $$;

-- 5. PAYMENTS RECONCILIATION
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  phone text NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS subscriber_id uuid,
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS raw jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_phone ON public.payments(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_read_policy') THEN
    CREATE POLICY payments_read_policy ON public.payments
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 6. WATCHLIST (MY LIST)
CREATE TABLE IF NOT EXISTS public.watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title text NOT NULL,
  poster_path text,
  backdrop_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watchlist_user_tmdb_unique UNIQUE (user_id, tmdb_id, media_type)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user_created ON public.watchlist(user_id, created_at DESC);
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'watchlist' AND policyname = 'watchlist_user_all') THEN
    CREATE POLICY watchlist_user_all ON public.watchlist
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 7. PLAYBACK PROGRESS (CONTINUE WATCHING)
CREATE TABLE IF NOT EXISTS public.playback_progress (
  user_id uuid NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title text NOT NULL,
  poster_path text,
  backdrop_path text,
  season integer NOT NULL DEFAULT 1,
  episode integer NOT NULL DEFAULT 1,
  watched_seconds integer NOT NULL DEFAULT 0,
  duration_seconds integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tmdb_id, media_type)
);

CREATE INDEX IF NOT EXISTS idx_playback_progress_user_updated ON public.playback_progress(user_id, updated_at DESC);
ALTER TABLE public.playback_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'playback_progress' AND policyname = 'playback_progress_user_all') THEN
    CREATE POLICY playback_progress_user_all ON public.playback_progress
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 8. WATCH HISTORY
CREATE TABLE IF NOT EXISTS public.watch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title text NOT NULL,
  poster_path text,
  season integer,
  episode integer,
  watched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watch_history_user_watched ON public.watch_history(user_id, watched_at DESC);
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'watch_history' AND policyname = 'watch_history_user_all') THEN
    CREATE POLICY watch_history_user_all ON public.watch_history
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 9. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'system',
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_user_all') THEN
    CREATE POLICY notifications_user_all ON public.notifications
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 10. REFERRAL PROGRAM & WITHDRAWALS (KSh 30 reward, KSh 100+ withdrawal)
CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referral_codes' AND policyname = 'referral_codes_read') THEN
    CREATE POLICY referral_codes_read ON public.referral_codes
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referral_codes' AND policyname = 'referral_codes_insert') THEN
    CREATE POLICY referral_codes_insert ON public.referral_codes
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'reversed')),
  payment_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_id <> referred_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'referrals_read') THEN
    CREATE POLICY referrals_read ON public.referrals
      FOR SELECT TO authenticated
      USING (auth.uid() = referrer_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.referral_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 30,
  kind text NOT NULL CHECK (kind IN ('reward', 'reversal')),
  payout_status text NOT NULL DEFAULT 'unpaid' CHECK (payout_status IN ('unpaid', 'paid', 'void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referral_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_referral_ledger_user ON public.referral_ledger(user_id);
ALTER TABLE public.referral_ledger ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referral_ledger' AND policyname = 'referral_ledger_read') THEN
    CREATE POLICY referral_ledger_read ON public.referral_ledger
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.referral_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount >= 100),
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  request_key text NOT NULL UNIQUE,
  provider text,
  provider_reference text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_withdrawals_user ON public.referral_withdrawals(user_id, created_at DESC);
ALTER TABLE public.referral_withdrawals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referral_withdrawals' AND policyname = 'referral_withdrawals_read') THEN
    CREATE POLICY referral_withdrawals_read ON public.referral_withdrawals
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 11. RPC FUNCTIONS: REFERRAL BALANCE & ATOMIC WITHDRAWAL
CREATE OR REPLACE FUNCTION public.referral_available_balance(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (COALESCE((SELECT sum(amount) FROM public.referral_ledger WHERE user_id = _user_id AND kind = 'reward'), 0)
        - COALESCE((SELECT sum(amount) FROM public.referral_withdrawals WHERE user_id = _user_id AND status IN ('pending','processing','paid')), 0))::int;
$$;

CREATE OR REPLACE FUNCTION public.reserve_referral_withdrawal(_user_id uuid, _phone text, _request_key text, _min integer DEFAULT 100)
RETURNS public.referral_withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _bal int;
  _row public.referral_withdrawals;
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
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.referral_available_balance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_referral_withdrawal(uuid, text, text, integer) TO authenticated, service_role;


-- ============================================================================
-- 10. AUTHORITATIVE SERVER-SIDE STREAMING URL RESOLUTION (6 EMBED SERVERS)
-- Enforces device authorization/active subscription on the backend before returning stream URLs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_stream_source(
  p_device_id TEXT,
  p_tmdb_id INTEGER,
  p_media_type TEXT,
  p_season INTEGER DEFAULT 1,
  p_episode INTEGER DEFAULT 1,
  p_server_index INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authorized BOOLEAN := FALSE;
  v_trial_active BOOLEAN := FALSE;
  v_server_count CONSTANT INTEGER := 6;
  v_idx INTEGER;
  v_s INTEGER := COALESCE(p_season, 1);
  v_e INTEGER := COALESCE(p_episode, 1);
  v_url TEXT;
  v_server_name TEXT;
BEGIN
  -- Verify if physical device holds an active trial
  SELECT (expires_at > NOW()) INTO v_trial_active
  FROM public.device_trials
  WHERE device_id = p_device_id;

  IF v_trial_active IS TRUE THEN
    v_authorized := TRUE;
  END IF;

  -- Verify if device is bound to an active paid subscriber
  IF v_authorized IS FALSE THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.devices d
      JOIN public.subscriptions s ON s.subscriber_id = d.subscriber_id
      WHERE d.id = p_device_id
        AND d.revoked_at IS NULL
        AND s.status = 'active'
        AND s.expires_at > NOW()
    ) INTO v_authorized;
  END IF;

  -- Block if unauthorized
  IF v_authorized IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'authorized', FALSE,
      'error', 'Subscription or active 3-day trial required to access video stream.'
    );
  END IF;

  v_idx := ABS(COALESCE(p_server_index, 0)) % v_server_count;

  IF v_idx = 0 THEN
    v_server_name := 'Server 1';
    IF p_media_type = 'tv' THEN
      v_url := 'https://vidfast.pro/tv/' || p_tmdb_id || '/' || v_s || '/' || v_e;
    ELSE
      v_url := 'https://vidfast.pro/movie/' || p_tmdb_id;
    END IF;
  ELSIF v_idx = 1 THEN
    v_server_name := 'Server 2';
    IF p_media_type = 'tv' THEN
      v_url := 'https://vidy.st/tv/' || p_tmdb_id || '/' || v_s || '/' || v_e;
    ELSE
      v_url := 'https://vidy.st/movie/' || p_tmdb_id;
    END IF;
  ELSIF v_idx = 2 THEN
    v_server_name := 'Server 3';
    IF p_media_type = 'tv' THEN
      v_url := 'https://vidrock.net/embed/tv/' || p_tmdb_id || '/' || v_s || '/' || v_e;
    ELSE
      v_url := 'https://vidrock.net/embed/movie/' || p_tmdb_id;
    END IF;
  ELSIF v_idx = 3 THEN
    v_server_name := 'Server 4';
    IF p_media_type = 'tv' THEN
      v_url := 'https://vidvault.to/tv/' || p_tmdb_id || '/' || v_s || '/' || v_e;
    ELSE
      v_url := 'https://vidvault.to/movie/' || p_tmdb_id;
    END IF;
  ELSIF v_idx = 4 THEN
    v_server_name := 'Server 5';
    IF p_media_type = 'tv' THEN
      v_url := 'https://vidsrc.mov/embed/tv/' || p_tmdb_id || '/' || v_s || '/' || v_e;
    ELSE
      v_url := 'https://vidsrc.mov/embed/movie/' || p_tmdb_id;
    END IF;
  ELSE
    v_server_name := 'Server 6';
    IF p_media_type = 'tv' THEN
      v_url := 'https://player.vidzee.wtf/embed/tv/' || p_tmdb_id || '/' || v_s || '/' || v_e;
    ELSE
      v_url := 'https://player.vidzee.wtf/embed/movie/' || p_tmdb_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'authorized', TRUE,
    'server_index', v_idx,
    'server_name', v_server_name,
    'stream_url', v_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_stream_source(TEXT, INTEGER, TEXT, INTEGER, INTEGER, INTEGER) TO anon, authenticated;
