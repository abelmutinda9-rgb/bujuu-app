import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { rememberReferral } from "@/hooks/use-account";

export const Route = createFileRoute("/r/$code")({
  head: () => ({
    meta: [
      { title: "You're invited to bujuu" },
      { name: "description", content: "A friend invited you to watch movies and shows on bujuu." },
      { property: "og:title", content: "You're invited to bujuu" },
      { property: "og:description", content: "A friend invited you to watch movies and shows on bujuu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Invite,
});

function Invite() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (/^[A-Za-z0-9]{3,16}$/.test(code)) rememberReferral(code.toUpperCase());
    void navigate({ to: "/", replace: true });
  }, [code, navigate]);
  return null;
}
