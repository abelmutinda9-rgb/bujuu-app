-- ============================================================================
-- BUJUU Cinema Migration: Remote App Configuration & Server Management
-- Allows remote control of servers, providers, and app settings without APK updates.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow public read access to app configuration
DROP POLICY IF EXISTS "Public read access for app_config" ON public.app_config;
CREATE POLICY "Public read access for app_config"
  ON public.app_config
  FOR SELECT
  TO public
  USING (true);

-- Allow service_role to manage app_config
DROP POLICY IF EXISTS "Service role manage app_config" ON public.app_config;
CREATE POLICY "Service role manage app_config"
  ON public.app_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert or update default stream providers configuration
INSERT INTO public.app_config (key, value, description)
VALUES (
  'stream_providers',
  jsonb_build_array(
    jsonb_build_object('id', 'vidlink', 'name', 'Server 1 (VidLink)', 'badge', 'Fast', 'urlPattern', 'https://vidlink.pro/{type}/{id}{season_ep}?primaryColor=e50914&sub.default=en', 'enabled', true, 'priority', 1),
    jsonb_build_object('id', 'autoembed', 'name', 'Server 2 (AutoEmbed)', 'badge', 'HD', 'urlPattern', 'https://autoembed.co/{type}/tmdb/{id}{season_ep}', 'enabled', true, 'priority', 2),
    jsonb_build_object('id', 'superembed', 'name', 'Server 3 (SuperEmbed)', 'badge', 'Multi', 'urlPattern', 'https://multiembed.mov/?video_id={id}&tmdb=1{season_ep}', 'enabled', true, 'priority', 3),
    jsonb_build_object('id', 'videasy', 'name', 'Server 4 (Videasy)', 'badge', 'Backup', 'urlPattern', 'https://player.videasy.net/{type}/{id}{season_ep}', 'enabled', true, 'priority', 4),
    jsonb_build_object('id', '2embed', 'name', 'Server 5 (2Embed)', 'badge', 'Classic', 'urlPattern', 'https://www.2embed.cc/{type}/{id}{season_ep}', 'enabled', true, 'priority', 5),
    jsonb_build_object('id', 'vidsrc_rip', 'name', 'Server 6 (VidSrc RIP)', 'badge', 'Alt', 'urlPattern', 'https://vidsrc.rip/embed/{type}/{id}{season_ep}', 'enabled', true, 'priority', 6),
    jsonb_build_object('id', 'vidsrc_to', 'name', 'Server 7 (VidSrc TO)', 'badge', 'Alt', 'urlPattern', 'https://vidsrc.to/embed/{type}/{id}{season_ep}', 'enabled', true, 'priority', 7),
    jsonb_build_object('id', 'smashystream', 'name', 'Server 8 (SmashyStream)', 'badge', 'Alt', 'urlPattern', 'https://player.smashystream.com/{type}/{id}{season_ep}', 'enabled', true, 'priority', 8),
    jsonb_build_object('id', 'vidy', 'name', 'Server 9 (Vidy)', 'badge', 'Alt', 'urlPattern', 'https://vidy.st/{type}/{id}{season_ep}', 'enabled', true, 'priority', 9),
    jsonb_build_object('id', 'vidrock', 'name', 'Server 10 (Vidrock)', 'badge', 'Alt', 'urlPattern', 'https://vidrock.net/embed/{type}/{id}{season_ep}', 'enabled', true, 'priority', 10),
    jsonb_build_object('id', 'vidvault', 'name', 'Server 11 (Vidvault)', 'badge', 'Alt', 'urlPattern', 'https://vidvault.to/{type}/{id}{season_ep}', 'enabled', true, 'priority', 11),
    jsonb_build_object('id', 'vixsrc', 'name', 'Server 12 (VixSrc)', 'badge', 'Alt', 'urlPattern', 'https://vixsrc.to/{type}/{id}{season_ep}', 'enabled', true, 'priority', 12)
  ),
  'Configurable streaming providers list. Modify from database to change servers without app updates.'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

-- Default app settings
INSERT INTO public.app_config (key, value, description)
VALUES (
  'app_settings',
  jsonb_build_object(
    'cache_posters', true,
    'default_subtitles', 'en',
    'auto_landscape_fullscreen', true,
    'theme', 'cinematic_black'
  ),
  'Global app behavior flags.'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();
