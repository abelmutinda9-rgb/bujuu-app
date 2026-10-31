-- Migration: watchlist, playback_progress, watch_history and scheduler_tokens

-- 1. Watchlist (My List)
CREATE TABLE IF NOT EXISTS public.watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tmdb_id INTEGER NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title TEXT NOT NULL,
    poster_path TEXT,
    backdrop_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT watchlist_user_tmdb_unique UNIQUE (user_id, tmdb_id, media_type)
);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'watchlist' AND policyname = 'watchlist_user_all') THEN
        CREATE POLICY watchlist_user_all ON public.watchlist
            FOR ALL
            TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_watchlist_user_created ON public.watchlist(user_id, created_at DESC);

-- 2. Playback progress (Continue Watching)
CREATE TABLE IF NOT EXISTS public.playback_progress (
    user_id UUID NOT NULL,
    tmdb_id INTEGER NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title TEXT NOT NULL,
    poster_path TEXT,
    backdrop_path TEXT,
    season INTEGER NOT NULL DEFAULT 1,
    episode INTEGER NOT NULL DEFAULT 1,
    watched_seconds INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tmdb_id, media_type)
);

ALTER TABLE public.playback_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'playback_progress' AND policyname = 'playback_progress_user_all') THEN
        CREATE POLICY playback_progress_user_all ON public.playback_progress
            FOR ALL
            TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_playback_progress_user_updated ON public.playback_progress(user_id, updated_at DESC);

-- 3. Watch history
CREATE TABLE IF NOT EXISTS public.watch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tmdb_id INTEGER NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title TEXT NOT NULL,
    poster_path TEXT,
    season INTEGER,
    episode INTEGER,
    watched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'watch_history' AND policyname = 'watch_history_user_all') THEN
        CREATE POLICY watch_history_user_all ON public.watch_history
            FOR ALL
            TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_watch_history_user_watched ON public.watch_history(user_id, watched_at DESC);
