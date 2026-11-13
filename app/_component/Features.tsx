import { Check } from "lucide-react";
import { features } from "@/lib/landing-content";
import { FeatureMockView } from "@/app/_component/FeatureMocks";
import { SectionIntro } from "@/app/_component/SectionIntro";

export function Features() {
  return (
    <section id={features.id} className="relative scroll-mt-18 overflow-x-clip px-6 py-24 md:py-36">
      <SectionIntro eyebrow={features.eyebrow} heading={features.heading} subtitle={features.subtitle} />

      <div className="mx-auto mt-20 flex max-w-6xl flex-col gap-24 md:mt-28 md:gap-36">
        {features.items.map((feature, index) => {
          const Icon = feature.icon;
          // Every other row puts the mock on the left, so the page zig-zags.
          const flipped = index % 2 === 1;
          return (
            <div key={feature.title} className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
              <div className={flipped ? "md:order-2" : undefined}>
                <div className="flex items-center gap-3">
                  <span className="relative inline-flex size-11 items-center justify-center rounded-xl bg-[linear-gradient(180deg,oklch(0.3_0.05_55),oklch(0.2_0.02_55))] text-primary shadow-[inset_0_1px_0_oklch(1_0_0/0.12),0_8px_24px_-8px_oklch(0.74_0.16_55/0.5)] ring-1 ring-primary/35">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground/70 uppercase">
                    {String(index + 1).padStart(2, "0")} / {String(features.items.length).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-6 text-3xl font-semibold tracking-[-0.025em] md:text-4xl">{feature.title}</h3>
                <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground md:text-[1.05rem]">
                  {feature.description}
                </p>
                <ul className="mt-8 space-y-3.5">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-sm text-foreground/90">
                      <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 ring-1 ring-primary/30">
                        <Check className="size-3 text-primary" strokeWidth={3} />
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`relative ${flipped ? "md:order-1" : ""}`}>
                <div aria-hidden className="glow-orb -inset-10 -z-10 opacity-40" />
                <FeatureMockView mock={feature.mock} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
