-- =============================================================================
-- BUJUU CONSOLIDATED DEVICE HANDSHAKE, STREAM RESOLVER & MAINTENANCE RPCS
-- =============================================================================

-- 1. Authoritative 72-Hour Device Handshake RPC
CREATE OR REPLACE FUNCTION public.device_handshake(
  p_device_id TEXT,
  p_platform TEXT DEFAULT 'Android'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dev RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_status TEXT;
  v_can_stream BOOLEAN := FALSE;
  v_days_remaining INTEGER := 0;
  v_recovery_token TEXT;
  v_trial_ends TIMESTAMPTZ;
BEGIN
  IF p_device_id IS NULL OR TRIM(p_device_id) = '' THEN
    RETURN jsonb_build_object(
      'status', 'expired',
      'can_stream', FALSE,
      'days_remaining', 0
    );
  END IF;

  -- Fetch existing device record
  SELECT * INTO v_dev
  FROM public.devices
  WHERE device_id = TRIM(p_device_id)
  LIMIT 1;

  IF v_dev.id IS NULL THEN
    -- First time device has ever connected: grant exactly 72-hour trial
    v_trial_ends := v_now + INTERVAL '3 days';
    v_recovery_token := 'BUJ-' || UPPER(SUBSTRING(MD5(p_device_id || v_now::text) FROM 1 FOR 6));

    INSERT INTO public.devices (
      device_id,
      platform,
      first_seen_at,
      trial_ends_at,
      subscription_expires_at,
      recovery_token,
      is_blocked,
      last_seen_at
    )
    VALUES (
      TRIM(p_device_id),
      COALESCE(p_platform, 'Android'),
      v_now,
      v_trial_ends,
      NULL,
      v_recovery_token,
      FALSE,
      v_now
    )
    RETURNING * INTO v_dev;
  ELSE
    -- Existing device: update last seen & platform
    UPDATE public.devices
    SET last_seen_at = v_now,
        platform = COALESCE(p_platform, platform),
        updated_at = v_now
    WHERE id = v_dev.id
    RETURNING * INTO v_dev;
  END IF;

  -- Blocked devices cannot stream
  IF v_dev.is_blocked IS TRUE THEN
    RETURN jsonb_build_object(
      'status', 'blocked',
      'can_stream', FALSE,
      'days_remaining', 0
    );
  END IF;

  -- Check paid subscription status first
  IF v_dev.subscription_expires_at IS NOT NULL AND v_dev.subscription_expires_at > v_now THEN
    v_status := 'active';
    v_can_stream := TRUE;
    v_days_remaining := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_dev.subscription_expires_at - v_now)) / 86400)::INTEGER);
  -- Check 3-day trial window
  ELSIF v_dev.trial_ends_at IS NOT NULL AND v_dev.trial_ends_at > v_now THEN
    v_status := 'trial';
    v_can_stream := TRUE;
    v_days_remaining := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_dev.trial_ends_at - v_now)) / 86400)::INTEGER);
  ELSE
    v_status := 'expired';
    v_can_stream := FALSE;
    v_days_remaining := 0;
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'can_stream', v_can_stream,
    'days_remaining', v_days_remaining,
    'trial_ends_at', v_dev.trial_ends_at,
    'subscription_expires_at', v_dev.subscription_expires_at,
    'phone', v_dev.phone,
    'recovery_token', v_dev.recovery_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.device_handshake(TEXT, TEXT) TO anon, authenticated;

-- 2. Maintenance routine to audit and track expired subscription states
CREATE OR REPLACE FUNCTION public.expire_stale_subscriptions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO v_expired_count
  FROM public.devices
  WHERE subscription_expires_at IS NOT NULL
    AND subscription_expires_at < NOW()
    AND (trial_ends_at IS NULL OR trial_ends_at < NOW());

  RETURN jsonb_build_object(
    'success', TRUE,
    'expired_devices_count', v_expired_count,
    'evaluated_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_subscriptions() TO anon, authenticated;
