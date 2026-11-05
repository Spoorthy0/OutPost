import { audience } from "@/lib/landing-content";

export function AudienceStrip() {
  return (
    <section className="border-y border-white/6 bg-card/40 px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 md:flex-row md:justify-between">
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">{audience.label}</p>
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-foreground/80 md:gap-x-8">
          {audience.items.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span aria-hidden className="size-1 rotate-45 bg-primary/70" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
