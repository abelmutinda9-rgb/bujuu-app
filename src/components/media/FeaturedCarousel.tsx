import { motion } from "framer-motion";
import { useState } from "react";

import { posterUrl, type MediaItem } from "@/services/tmdb";

interface Props {
  items: MediaItem[] | undefined;
  onSelect: (item: MediaItem) => void;
}

export function FeaturedCarousel({ items, onSelect }: Props) {
  const [paused, setPaused] = useState(false);
  if (!items?.length) return null;

  const loop = [...items, ...items];

  return (
    <section className="py-6">
      <h2 className="mb-3 px-4 text-base font-semibold lg:px-8">Featured</h2>
      <div className="overflow-hidden">
        <motion.div
          className="flex w-max gap-3 px-4 lg:px-8"
          animate={paused ? {} : { x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
        >
          {loop.map((item, i) => {
            const src = posterUrl(item.posterPath);
            return (
              <button
                key={`${item.mediaType}-${item.id}-${i}`}
                type="button"
                tabIndex={0}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                className="w-32 shrink-0 rounded-md outline-none transition-transform duration-200 hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-brand sm:w-40"
                aria-label={item.title}
              >
                <div className="aspect-[2/3] overflow-hidden rounded-md bg-card ring-1 ring-border">
                  {src && (
                    <img
                      src={src}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
