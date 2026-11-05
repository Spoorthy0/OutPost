import { Check } from "lucide-react";
import { features } from "@/lib/landing-content";
import { FeatureMockView } from "@/app/_component/FeatureMocks";
import { SectionIntro } from "@/app/_component/SectionIntro";

export function Features() {
  return (
    <section id={features.id} className="scroll-mt-18 px-6 py-24 md:py-32">
      <SectionIntro eyebrow={features.eyebrow} heading={features.heading} subtitle={features.subtitle} />

      <div className="mx-auto mt-20 flex max-w-6xl flex-col gap-24 md:gap-32">
        {features.items.map((feature, index) => {
          const Icon = feature.icon;
          // Every other row puts the mock on the left, so the page zig-zags.
          const flipped = index % 2 === 1;
          return (
            <div key={feature.title} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
              <div className={flipped ? "md:order-2" : undefined}>
                <span className="inline-flex size-10 items-center justify-center rounded-lg border border-primary/30 bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight md:text-3xl">{feature.title}</h3>
                <p className="mt-3 text-pretty text-muted-foreground">{feature.description}</p>
                <ul className="mt-6 space-y-3">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-sm text-foreground/90">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={flipped ? "md:order-1" : undefined}>
                <FeatureMockView mock={feature.mock} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
