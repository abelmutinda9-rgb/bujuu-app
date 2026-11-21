import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payhero-callback")({
  loader: () => {
    return new Response(JSON.stringify({ status: "disabled" }), {
      headers: { "Content-Type": "application/json" },
    });
  },
});
