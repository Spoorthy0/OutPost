import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cta } from "@/lib/landing-content";

export function CallToAction() {
  return (
    <section className="px-6 py-24 md:py-32">
      {/* Frame marks sit on the wrapper because the card's overflow-hidden would clip them. */}
      <div className="survey-frame mx-auto max-w-5xl">
        <div className="topo-bg overflow-hidden rounded-3xl border border-primary/30 bg-card px-6 py-16 text-center shadow-2xl shadow-primary/10 md:px-16 md:py-20">
          <p className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            <span aria-hidden className="size-1.5 rotate-45 bg-primary" />
            {cta.eyebrow}
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            {cta.heading.before}
            <span className="text-primary">{cta.heading.highlight}</span>
            {cta.heading.after}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-muted-foreground md:text-lg">{cta.subtitle}</p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 px-5 text-sm">
              <Link href={cta.primaryCta.href}>
                {cta.primaryCta.label}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-5 text-sm">
              <Link href={cta.secondaryCta.href}>{cta.secondaryCta.label}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
