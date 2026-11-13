import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cta } from "@/lib/landing-content";

export function CallToAction() {
  return (
    <section className="px-6 py-24 md:py-32">
      {/* Frame marks sit on the wrapper because the card's overflow-hidden would clip them. */}
      <div className="survey-frame mx-auto max-w-5xl">
        <div className="edge-glow-brand rounded-[1.75rem] shadow-[0_40px_120px_-40px_oklch(0.74_0.16_55/0.45)]">
          <div className="topo-bg overflow-hidden rounded-[1.75rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,oklch(0.26_0.05_55),var(--card)_70%)] px-6 py-16 text-center md:px-16 md:py-24">
            <Image
              src="/brand/mascot-dark.png"
              alt=""
              width={56}
              height={56}
              className="mx-auto mb-6 size-14 drop-shadow-[0_8px_24px_oklch(0.74_0.16_55/0.5)]"
            />
            <p className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-primary/90 uppercase">
              <span aria-hidden className="size-1.5 rotate-45 bg-primary" />
              {cta.eyebrow}
            </p>
            <h2 className="mx-auto mt-4 max-w-2xl text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance md:text-6xl">
              <span className="text-heading-fade">{cta.heading.before}</span>
              <span className="text-brand">{cta.heading.highlight}</span>
              <span className="text-heading-fade">{cta.heading.after}</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg leading-relaxed text-pretty text-muted-foreground md:text-lg">{cta.subtitle}</p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="sheen h-12 rounded-xl px-6 text-sm">
                <Link href={cta.primaryCta.href}>
                  {cta.primaryCta.label}
                  <ArrowRight data-icon="inline-end" className="transition-transform group-hover/button:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-6 text-sm backdrop-blur-sm">
                <Link href={cta.secondaryCta.href}>{cta.secondaryCta.label}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
