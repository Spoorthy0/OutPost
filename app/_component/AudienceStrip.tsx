import { audience } from "@/lib/landing-content";

export function AudienceStrip() {
  return (
    <section className="relative px-6 py-10">
      <div aria-hidden className="hairline absolute inset-x-0 top-0" />
      <div aria-hidden className="hairline absolute inset-x-0 bottom-0" />
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 md:flex-row md:justify-between">
        <p className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground/80 uppercase">{audience.label}</p>
        <ul className="flex flex-wrap items-center justify-center gap-2 text-sm text-foreground/80">
          {audience.items.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 rounded-full border border-white/8 bg-white/2 px-3.5 py-1.5 transition-colors hover:border-primary/30 hover:text-foreground"
            >
              <span aria-hidden className="size-1 rotate-45 bg-primary/80" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
