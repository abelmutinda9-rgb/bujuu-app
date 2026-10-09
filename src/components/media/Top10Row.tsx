import type { MediaItem } from "@/services/tmdb";
import { posterUrl } from "@/services/tmdb";

interface Top10RowProps {
  title: string;
  items: MediaItem[] | undefined;
  isLoading?: boolean;
  onSelect: (item: MediaItem) => void;
}

export function Top10Row({ title, items, isLoading, onSelect }: Top10RowProps) {
  return (
    <section className="mt-8">
      <h2 className="px-4 text-base font-semibold lg:px-8 lg:text-xl">{title}</h2>
      <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:px-8 [&::-webkit-scrollbar]:hidden">
        {isLoading || !items
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 w-40 shrink-0 animate-pulse snap-start rounded-md bg-card lg:h-52 lg:w-56" />
            ))
          : items.slice(0, 10).map((item, index) => {
              const src = posterUrl(item.posterPath);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className="group flex shrink-0 snap-start items-end text-left"
                >
                  <span
                    aria-hidden
                    className="-mr-4 select-none text-[5.5rem] font-black leading-[0.75] tracking-tighter text-transparent lg:-mr-6 lg:text-[8rem]"
                    style={{ WebkitTextStroke: "2px rgba(255,255,255,0.55)" }}
                  >
                    {index + 1}
                  </span>
                  <div className="aspect-[2/3] w-24 overflow-hidden rounded-md bg-card ring-1 ring-border transition-transform duration-200 group-hover:scale-[1.04] sm:w-28 lg:w-32">
                    {src ? (
                      <img src={src} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center px-2 text-center text-xs text-muted-foreground">
                        {item.title}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
      </div>
    </section>
  );
}
