import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hero } from "@/lib/landing-content";
import { LazyVideo } from "@/app/_component/LazyVideo";

export function Hero() {
  const { eyebrow, eyebrowNote, headline, subtitle, primaryCta, secondaryCta, assurances, video } = hero;

  return (
    <section className="topo-bg flex flex-col items-center overflow-x-clip px-6 pt-20 pb-24 text-center md:pt-28">
      {/* Ambient light behind the headline and the product frame. */}
      <div aria-hidden className="glow-orb -z-10 -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 opacity-70" />
      <div aria-hidden className="glow-orb -z-10 top-[55%] left-1/2 h-[480px] w-[1100px] -translate-x-1/2 opacity-50" />

      <p className="rise-in mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-background/60 py-1 pr-3.5 pl-1.5 text-xs text-muted-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.05)] backdrop-blur-md">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] text-primary uppercase ring-1 ring-primary/30">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          {eyebrow}
        </span>
        {eyebrowNote}
      </p>

      <h1
        className="rise-in max-w-4xl text-5xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance md:text-7xl lg:text-[5.25rem]"
        style={{ animationDelay: "80ms" }}
      >
        <span className="text-heading-fade">{headline.before}</span>
        <span className="text-brand">{headline.highlight}</span>
        {headline.after && <span className="text-heading-fade">{headline.after}</span>}
      </h1>

      <p
        className="rise-in mt-7 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground md:text-lg"
        style={{ animationDelay: "160ms" }}
      >
        {subtitle}
      </p>

      <div className="rise-in mt-10 flex flex-col items-center gap-3 sm:flex-row" style={{ animationDelay: "240ms" }}>
        <Button asChild size="lg" className="sheen h-12 rounded-xl px-6 text-sm">
          <Link href={primaryCta.href}>
            {primaryCta.label}
            <ArrowRight data-icon="inline-end" className="transition-transform group-hover/button:translate-x-0.5" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-6 text-sm backdrop-blur-sm">
          <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
        </Button>
      </div>

      <ul
        className="rise-in mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
        style={{ animationDelay: "320ms" }}
      >
        {assurances.map((item) => (
          <li key={item} className="flex items-center gap-1.5">
            <Check className="size-3.5 text-primary" />
            {item}
          </li>
        ))}
      </ul>

      {/* Tilt sits on the outer wrapper so the frame marks lean with the card; the frame wraps the
          card from outside because the card's overflow-hidden would clip them. */}
      <div className="scroll-tilt mt-20 w-full max-w-5xl md:mt-24">
        <div className="survey-frame">
          <div className="edge-glow-brand rounded-[1.25rem] bg-white/3 p-1.5 shadow-[0_40px_120px_-30px_oklch(0.74_0.16_55/0.35),0_20px_60px_-20px_oklch(0_0_0/0.8)] backdrop-blur-sm">
            <div className="overflow-hidden rounded-2xl border border-white/8 bg-card">
              <div aria-hidden className="flex items-center gap-2 border-b border-white/6 bg-white/2 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-white/12" />
                <span className="size-2.5 rounded-full bg-white/12" />
                <span className="size-2.5 rounded-full bg-white/12" />
                <span className="mx-auto rounded-md bg-white/4 px-10 py-0.5 font-mono text-[10px] text-muted-foreground/80">
                  outpost / workspace
                </span>
                <span className="w-12" />
              </div>
              <LazyVideo
                className="aspect-video w-full object-cover"
                webm={video.webm}
                mp4={video.mp4}
                poster={video.poster}
                label={video.label}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
