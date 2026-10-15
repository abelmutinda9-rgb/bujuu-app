import { Capacitor, CapacitorHttp } from "@capacitor/core";
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

const corsMiddleware = createMiddleware().server(async ({ next, request }) => {
  const origin = request.headers.get("origin") || "";
  const isPreflight = request.method === "OPTIONS";

  if (isPreflight) {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, x-tsr-serverFn, x-tss-raw, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const response = await next();
  if (response instanceof Response && origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  return response;
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  origin: (origin) => {
    if (!origin) return true;
    const allowed = [
      "https://localhost",
      "http://localhost",
      "capacitor://localhost",
      "https://app.bujuu.tv",
      "https://lynnn.lovable.app",
      "https://buuju.lovable.app",
      "https://lynnn-phi.vercel.app",
      "https://bujuu-app.vercel.app",
    ];
    if (allowed.includes(origin)) return true;
    if (origin.endsWith(".vercel.app") || origin.endsWith(".lovable.app")) return true;
    return false;
  },
  allowRequestsWithoutOriginCheck: true,
});

export const REMOTE_BACKEND_BASE =
  (typeof process !== "undefined" && process.env?.VITE_BACKEND_URL) ||
  ((import.meta as any).env?.VITE_BACKEND_URL) ||
  "https://lynnn-phi.vercel.app";

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [corsMiddleware, errorMiddleware, csrfMiddleware],
  serverFns: {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const isNative = Capacitor.isNativePlatform();

      // Normalize relative paths to absolute backend URL
      const isRelative = rawUrl.startsWith("/") || rawUrl.startsWith("./");
      const targetUrl = isRelative
        ? `${REMOTE_BACKEND_BASE}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`
        : rawUrl;

      if (isNative) {
        try {
          // Native Android: use CapacitorHttp to bypass browser WebView CORS and origin checks
          const method = (init?.method || "GET").toUpperCase();
          const headers: Record<string, string> = {};
          if (init?.headers) {
            new Headers(init.headers).forEach((v, k) => {
              headers[k] = v;
            });
          }
          if (!headers["x-tsr-serverFn"]) {
            headers["x-tsr-serverFn"] = "true";
          }

          let data: any = undefined;
          if (init?.body) {
            if (typeof init.body === "string") {
              try {
                data = JSON.parse(init.body);
              } catch {
                data = init.body;
              }
            } else {
              data = init.body;
            }
          }

          const res = await CapacitorHttp.request({
            url: targetUrl,
            method,
            headers,
            data,
          });

          const resHeaders = new Headers();
          if (res.headers) {
            Object.entries(res.headers).forEach(([k, v]) => {
              resHeaders.set(k, String(v));
            });
          }

          const bodyText = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
          return new Response(bodyText, {
            status: res.status,
            headers: resHeaders,
          });
        } catch (e) {
          console.warn("CapacitorHttp native request failed, falling back to standard fetch:", e);
        }
      }

      // Web or fallback fetch
      const fetchTarget = isNative
        ? targetUrl
        : isRelative && typeof window !== "undefined" && window.location.origin.includes("lovable.app")
        ? targetUrl
        : rawUrl;

      return fetch(fetchTarget, {
        ...init,
        credentials: "omit",
      });
    },
  },
}));
