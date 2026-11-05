import { howItWorks } from "@/lib/landing-content";
import { SectionIntro } from "@/app/_component/SectionIntro";

export function HowItWorks() {
  return (
    <section id={howItWorks.id} className="topo-bg scroll-mt-18 border-t border-white/6 px-6 py-24 md:py-32">
      <SectionIntro eyebrow={howItWorks.eyebrow} heading={howItWorks.heading} subtitle={howItWorks.subtitle} />

      <ol className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
        {howItWorks.steps.map((step, index) => (
          <li
            key={step.title}
            className="relative rounded-xl border border-white/10 bg-card/80 p-6 backdrop-blur-sm"
          >
            <span className="font-mono text-xs tracking-[0.2em] text-primary">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-4 text-xl font-semibold tracking-tight">{step.title}</h3>
            <p className="mt-2 text-sm text-pretty text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
