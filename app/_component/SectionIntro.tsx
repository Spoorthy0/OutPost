// Eyebrow, heading and subtitle shared by the landing page's content sections.
export function SectionIntro({ eyebrow, heading, subtitle }: { eyebrow: string; heading: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/6 px-3 py-1 font-mono text-[11px] tracking-[0.2em] text-primary/90 uppercase">
        <span aria-hidden className="size-1.5 rotate-45 bg-primary" />
        {eyebrow}
      </p>
      <h2 className="text-heading-fade mt-5 text-4xl leading-[1.08] font-semibold tracking-[-0.03em] text-balance md:text-[3.25rem]">
        {heading}
      </h2>
      <p className="mx-auto mt-5 max-w-xl leading-relaxed text-pretty text-muted-foreground md:text-lg">{subtitle}</p>
    </div>
  );
}
