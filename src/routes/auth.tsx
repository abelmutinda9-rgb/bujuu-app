import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["login", "signup", "forgot", "otp"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => searchSchema.parse(search),
  component: AuthRedirect,
});

function AuthRedirect() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    const target = redirect && redirect.startsWith("/") ? redirect : "/";
    void navigate({ to: target, replace: true });
  }, [navigate, redirect]);

  return null;
}
