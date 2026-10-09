import { Capacitor } from "@capacitor/core";
import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const REMOTE_BACKEND_BASE =
  (typeof process !== "undefined" && process.env?.VITE_BACKEND_URL) ||
  "https://c--5d3d5458-27cc-435a-851a-efc5f61a5689-prod.lovable.cloud";

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
  serverFns: {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!Capacitor.isNativePlatform()) return fetch(input, init);
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const target = `${REMOTE_BACKEND_BASE}${url.pathname}${url.search}`;
      return fetch(target, {
        ...init,
        credentials: "omit",
      });
    },
  },
}));
