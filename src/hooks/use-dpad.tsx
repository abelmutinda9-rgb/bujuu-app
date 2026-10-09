import { useEffect } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

type Dir = "up" | "down" | "left" | "right";

function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function move(dir: Dir) {
  const active = document.activeElement as HTMLElement | null;
  const all = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
  if (all.length === 0) return;

  if (!active || !all.includes(active)) {
    all[0]?.focus();
    return;
  }

  const a = active.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const el of all) {
    if (el === active) continue;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const dx = x - ax;
    const dy = y - ay;

    const forward =
      dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    if (forward <= 4) continue;

    const lateral = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = forward + lateral * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (best) {
    best.focus();
    best.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
}

/** Global D-pad / TV remote spatial navigation. */
export function useDpadNavigation() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      switch (e.key) {
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          if (typing) return;
          e.preventDefault();
          move(e.key.replace("Arrow", "").toLowerCase() as Dir);
          break;
        }
        case "Enter": {
          const active = document.activeElement as HTMLElement | null;
          if (!typing && active && active !== document.body) active.click();
          break;
        }
        default: {
          // Android TV "Back" hardware key
          if (e.keyCode === 461) window.history.back();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
