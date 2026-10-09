import type { MediaItem } from "@/services/tmdb";

import { MediaCard } from "./MediaCard";

interface MediaRowProps {
  title: string;
  items: MediaItem[] | undefined;
  isLoading?: boolean;
  onSelect: (item: MediaItem) => void;
}

export function MediaRow({ title, items, isLoading, onSelect }: MediaRowProps) {
  return (
    <section className="mt-8">
      <h2 className="px-4 text-base font-semibold lg:px-8 lg:text-xl">{title}</h2>
      <div className="mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:gap-3 lg:px-8 [&::-webkit-scrollbar]:hidden">
        {isLoading || !items
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] w-28 shrink-0 animate-pulse snap-start rounded-md bg-card sm:w-36 lg:w-40"
              />
            ))
          : items.map((item) => <MediaCard key={`${item.mediaType}-${item.id}`} item={item} onSelect={onSelect} />)}
      </div>
    </section>
  );
}
