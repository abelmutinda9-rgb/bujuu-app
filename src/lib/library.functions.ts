/** Per-user library: My List, Continue Watching and Watch History. RLS limits every row to its owner. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const titleSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  title: z.string().min(1).max(200),
  posterPath: z.string().max(100).nullable(),
  backdropPath: z.string().max(100).nullable(),
});

export const myList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("watchlist")
      .select("tmdb_id, media_type, title, poster_path, backdrop_path, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Could not load My List.");
    return data;
  });

export const toggleMyList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => titleSchema.extend({ add: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    if (data.add) {
      const { error } = await db.from("watchlist").upsert(
        {
          user_id: context.userId,
          tmdb_id: data.tmdbId,
          media_type: data.mediaType,
          title: data.title,
          poster_path: data.posterPath,
          backdrop_path: data.backdropPath,
        },
        { onConflict: "user_id,tmdb_id,media_type", ignoreDuplicates: true },
      );
      if (error) throw new Error("Could not add to My List.");
    } else {
      const { error } = await db
        .from("watchlist")
        .delete()
        .eq("user_id", context.userId)
        .eq("tmdb_id", data.tmdbId)
        .eq("media_type", data.mediaType);
      if (error) throw new Error("Could not remove from My List.");
    }
    return { inList: data.add };
  });

export const saveProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    titleSchema
      .extend({
        season: z.number().int().min(0).max(200),
        episode: z.number().int().min(0).max(5000),
        watchedSeconds: z.number().int().min(0).max(24 * 3600),
        durationSeconds: z.number().int().min(0).max(24 * 3600).nullable(),
        logHistory: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { error } = await db.from("playback_progress").upsert(
      {
        user_id: context.userId,
        tmdb_id: data.tmdbId,
        media_type: data.mediaType,
        title: data.title,
        poster_path: data.posterPath,
        backdrop_path: data.backdropPath,
        season: data.season,
        episode: data.episode,
        watched_seconds: data.watchedSeconds,
        duration_seconds: data.durationSeconds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tmdb_id,media_type" },
    );
    if (error) throw new Error("Could not save progress.");
    if (data.logHistory) {
      await db.from("watch_history").insert({
        user_id: context.userId,
        tmdb_id: data.tmdbId,
        media_type: data.mediaType,
        title: data.title,
        poster_path: data.posterPath,
        season: data.mediaType === "tv" ? data.season : null,
        episode: data.mediaType === "tv" ? data.episode : null,
      });
    }
    return { ok: true };
  });

export const continueWatching = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("playback_progress")
      .select("tmdb_id, media_type, title, poster_path, backdrop_path, season, episode, watched_seconds, duration_seconds, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw new Error("Could not load Continue Watching.");
    return data;
  });

export const watchHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("watch_history")
      .select("id, tmdb_id, media_type, title, poster_path, season, episode, watched_at")
      .eq("user_id", context.userId)
      .order("watched_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load history.");
    return data;
  });

export const clearHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("watch_history").delete().eq("user_id", context.userId);
    await context.supabase.from("playback_progress").delete().eq("user_id", context.userId);
    return { ok: true };
  });
