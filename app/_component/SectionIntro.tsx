// Eyebrow, heading and subtitle shared by the landing page's content sections.
export function SectionIntro({ eyebrow, heading, subtitle }: { eyebrow: string; heading: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
        <span aria-hidden className="size-1.5 rotate-45 bg-primary" />
        {eyebrow}
      </p>
      <h2 className="mt-4 text-4xl font-semibold tracking-tight text-balance md:text-5xl">{heading}</h2>
      <p className="mt-4 text-pretty text-muted-foreground md:text-lg">{subtitle}</p>
    </div>
  );
}
