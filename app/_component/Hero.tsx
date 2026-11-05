import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hero } from "@/lib/landing-content";

export function Hero() {
  const { eyebrow, headline, subtitle, primaryCta, secondaryCta, video } = hero;

  return (
    <section className="topo-bg flex flex-col items-center px-6 pt-24 pb-24 text-center md:pt-32">
      <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/60 px-3 py-1 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase backdrop-blur-sm">
        <span aria-hidden className="size-1.5 rotate-45 bg-primary" />
        {eyebrow}
      </p>

      <h1 className="max-w-4xl text-5xl leading-[1.05] font-semibold tracking-tight text-balance md:text-7xl">
        {headline.before}
        <span className="text-primary">{headline.highlight}</span>
        {headline.after}
      </h1>

      <p className="mt-6 max-w-xl text-base text-pretty text-muted-foreground md:text-lg">{subtitle}</p>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
        <Button asChild size="lg" className="h-11 px-5 text-sm">
          <Link href={primaryCta.href}>
            {primaryCta.label}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-11 px-5 text-sm">
          <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
        </Button>
      </div>

      {/* Tilt sits on the outer wrapper so the frame marks lean with the card; the frame wraps the
          card from outside because the card's overflow-hidden would clip them. */}
      <div className="scroll-tilt mt-20 w-full max-w-5xl md:mt-28">
        <div className="survey-frame">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl shadow-primary/10">
            <video
              className="aspect-video w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={video.poster}
              aria-label={video.label}
            >
              <source src={video.webm} type="video/webm" />
              <source src={video.mp4} type="video/mp4" />
            </video>
          </div>
        </div>
      </div>
    </section>
  );
}
