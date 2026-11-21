import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/r/$code")({
  component: InviteRedirect,
});

function InviteRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: "/", replace: true });
  }, [navigate]);
  return null;
}
