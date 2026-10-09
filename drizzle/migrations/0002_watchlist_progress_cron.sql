CREATE TABLE public.watchlist (
  user_id uuid NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  title text NOT NULL,
  poster_path text,
  backdrop_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tmdb_id, media_type)
);
GRANT SELECT, INSERT, DELETE ON public.watchlist TO authenticated;
GRANT ALL ON public.watchlist TO service_role;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watchlist read" ON public.watchlist FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own watchlist add" ON public.watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own watchlist remove" ON public.watchlist FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.playback_progress (
  user_id uuid NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
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
CREATE INDEX playback_progress_recent ON public.playback_progress (user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playback_progress TO authenticated;
GRANT ALL ON public.playback_progress TO service_role;
ALTER TABLE public.playback_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress read" ON public.playback_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own progress add" ON public.playback_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own progress update" ON public.playback_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own progress remove" ON public.playback_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.watch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  title text NOT NULL,
  poster_path text,
  season integer,
  episode integer,
  watched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX watch_history_recent ON public.watch_history (user_id, watched_at DESC);
GRANT SELECT, INSERT, DELETE ON public.watch_history TO authenticated;
GRANT ALL ON public.watch_history TO service_role;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own history read" ON public.watch_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own history add" ON public.watch_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own history remove" ON public.watch_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Private token used only by the database scheduler to call the renewal endpoint.
CREATE TABLE public.scheduler_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.scheduler_tokens TO service_role;
ALTER TABLE public.scheduler_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.scheduler_tokens (name) VALUES ('renew') ON CONFLICT DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'bujuu-renew-daily',
  '0 21 * * *',
  $$SELECT net.http_post(
      url := 'https://lynnn.lovable.app/api/public/hooks/renew-subscriptions',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT token FROM public.scheduler_tokens WHERE name = 'renew')),
      body := '{}'::jsonb
  );$$
);