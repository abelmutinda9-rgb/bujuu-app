-- ============================================================================
-- BUJUU Cinema Migration: Unrestricted Free Playback & 12 Stream Providers
-- Server 6 (Vidzee) removed per user requirement.
-- All access gating (device trial, subscription, paywalls) removed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_stream_source(
  p_device_id text,
  p_tmdb_id integer,
  p_media_type text,
  p_season integer DEFAULT 1,
  p_episode integer DEFAULT 1,
  p_server integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_server_name text;
  v_server_idx integer;
  v_season integer := GREATEST(1, COALESCE(p_season, 1));
  v_episode integer := GREATEST(1, COALESCE(p_episode, 1));
  v_is_movie boolean := (p_media_type = 'movie');
BEGIN
  -- Normalize server index across 12 providers (0 to 11)
  v_server_idx := ((COALESCE(p_server, 0) % 12) + 12) % 12;

  CASE v_server_idx
    WHEN 0 THEN
      -- VidLink (Default English subtitles)
      v_server_name := 'VidLink';
      IF v_is_movie THEN
        v_url := 'https://vidlink.pro/movie/' || p_tmdb_id || '?primaryColor=e50914&sub.default=en';
      ELSE
        v_url := 'https://vidlink.pro/tv/' || p_tmdb_id || '/' || v_season || '/' || v_episode || '?primaryColor=e50914&sub.default=en';
      END IF;

    WHEN 1 THEN
      -- SuperEmbed / MultiEmbed
      v_server_name := 'SuperEmbed';
      IF v_is_movie THEN
        v_url := 'https://multiembed.mov/?video_id=' || p_tmdb_id || '&tmdb=1';
      ELSE
        v_url := 'https://multiembed.mov/?video_id=' || p_tmdb_id || '&tmdb=1&s=' || v_season || '&e=' || v_episode;
      END IF;

    WHEN 2 THEN
      -- Vidfast
      v_server_name := 'Vidfast';
      IF v_is_movie THEN
        v_url := 'https://vidfast.pro/movie/' || p_tmdb_id;
      ELSE
        v_url := 'https://vidfast.pro/tv/' || p_tmdb_id || '/' || v_season || '/' || v_episode;
      END IF;

    WHEN 3 THEN
      -- AutoEmbed (Default English subtitles)
      v_server_name := 'AutoEmbed';
      IF v_is_movie THEN
        v_url := 'https://player.autoembed.cc/embed/movie/' || p_tmdb_id || '?sub_default=true&sub_lang=en';
      ELSE
        v_url := 'https://player.autoembed.cc/embed/tv/' || p_tmdb_id || '/' || v_season || '/' || v_episode || '?sub_default=true&sub_lang=en';
      END IF;

    WHEN 4 THEN
      -- Videasy (Default English subtitles)
      v_server_name := 'Videasy';
      IF v_is_movie THEN
        v_url := 'https://player.videasy.net/movie/' || p_tmdb_id || '?sub_default=true';
      ELSE
        v_url := 'https://player.videasy.net/tv/' || p_tmdb_id || '/' || v_season || '/' || v_episode || '?sub_default=true';
      END IF;

    WHEN 5 THEN
      -- VixSrc
      v_server_name := 'VixSrc';
      IF v_is_movie THEN
        v_url := 'https://vixsrc.to/movie/' || p_tmdb_id;
      ELSE
        v_url := 'https://vixsrc.to/tv/' || p_tmdb_id || '/' || v_season || '/' || v_episode;
      END IF;

    WHEN 6 THEN
      -- VidSrc CC
      v_server_name := 'VidSrc CC';
      IF v_is_movie THEN
        v_url := 'https://vidsrc.cc/v2/embed/movie/' || p_tmdb_id;
      ELSE
        v_url := 'https://vidsrc.cc/v2/embed/tv/' || p_tmdb_id || '/' || v_season || '/' || v_episode;
      END IF;

    WHEN 7 THEN
      -- SmashyStream
      v_server_name := 'SmashyStream';
      IF v_is_movie THEN
        v_url := 'https://player.smashystream.com/movie/' || p_tmdb_id;
      ELSE
        v_url := 'https://player.smashystream.com/tv/' || p_tmdb_id || '?s=' || v_season || '&e=' || v_episode;
      END IF;

    WHEN 8 THEN
      -- 2Embed
      v_server_name := '2Embed';
      IF v_is_movie THEN
        v_url := 'https://www.2embed.cc/embed/' || p_tmdb_id;
      ELSE
        v_url := 'https://www.2embed.cc/embedtv/' || p_tmdb_id || '&s=' || v_season || '&e=' || v_episode;
      END IF;

    WHEN 9 THEN
      -- Vidy
      v_server_name := 'Vidy';
      IF v_is_movie THEN
        v_url := 'https://vidy.st/movie/' || p_tmdb_id;
      ELSE
        v_url := 'https://vidy.st/tv/' || p_tmdb_id || '/' || v_season || '/' || v_episode;
      END IF;

    WHEN 10 THEN
      -- Vidrock
      v_server_name := 'Vidrock';
      IF v_is_movie THEN
        v_url := 'https://vidrock.net/embed/movie/' || p_tmdb_id;
      ELSE
        v_url := 'https://vidrock.net/embed/tv/' || p_tmdb_id || '/' || v_season || '/' || v_episode;
      END IF;

    WHEN 11 THEN
      -- Vidvault
      v_server_name := 'Vidvault';
      IF v_is_movie THEN
        v_url := 'https://vidvault.to/movie/' || p_tmdb_id;
      ELSE
        v_url := 'https://vidvault.to/tv/' || p_tmdb_id || '/' || v_season || '/' || v_episode;
      END IF;

    ELSE
      v_server_name := 'VidLink';
      IF v_is_movie THEN
        v_url := 'https://vidlink.pro/movie/' || p_tmdb_id || '?primaryColor=e50914&sub.default=en';
      ELSE
        v_url := 'https://vidlink.pro/tv/' || p_tmdb_id || '/' || v_season || '/' || v_episode || '?primaryColor=e50914&sub.default=en';
      END IF;
  END CASE;

  -- Always return authorized
  RETURN jsonb_build_object(
    'authorized', true,
    'server_index', v_server_idx,
    'server_name', v_server_name,
    'stream_url', v_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_stream_source(text, integer, text, integer, integer, integer) TO anon, authenticated, service_role;
