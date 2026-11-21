import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/renew-subscriptions")({
  loader: () => {
    return new Response(JSON.stringify({ status: "disabled" }), {
      headers: { "Content-Type": "application/json" },
    });
  },
});
