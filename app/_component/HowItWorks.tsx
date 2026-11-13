import { howItWorks } from "@/lib/landing-content";
import { SectionIntro } from "@/app/_component/SectionIntro";

export function HowItWorks() {
  return (
    <section id={howItWorks.id} className="topo-bg relative scroll-mt-18 px-6 py-24 md:py-36">
      <div aria-hidden className="hairline absolute inset-x-0 top-0" />
      <SectionIntro eyebrow={howItWorks.eyebrow} heading={howItWorks.heading} subtitle={howItWorks.subtitle} />

      <ol className="relative mx-auto mt-16 grid max-w-5xl gap-5 md:mt-20 md:grid-cols-3">
        {howItWorks.steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="edge-glow group relative rounded-2xl bg-card/80 p-7 shadow-[0_20px_50px_-25px_oklch(0_0_0/0.9)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-card"
            >
              <div className="flex items-center justify-between">
                <span className="relative flex size-11 items-center justify-center rounded-xl bg-background text-primary ring-1 ring-primary/30 shadow-[0_0_0_6px_var(--card),0_8px_24px_-8px_oklch(0.74_0.16_55/0.6)] transition-colors group-hover:bg-primary/10">
                  <Icon className="size-5" />
                </span>
                <span className="font-heading text-4xl font-semibold text-white/6 transition-colors group-hover:text-primary/20">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-pretty text-muted-foreground">{step.description}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
