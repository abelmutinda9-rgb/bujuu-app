REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, int, int) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;