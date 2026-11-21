import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

export const Route = createFileRoute("/subscribe")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: SubscribeRedirect,
});

function SubscribeRedirect() {
  const search = useSearch({ from: "/subscribe" });
  const navigate = useNavigate();

  useEffect(() => {
    const target = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/";
    void navigate({ to: target as any, replace: true });
  }, [navigate, search]);

  return null;
}
