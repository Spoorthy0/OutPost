import { pricing } from "@/lib/landing-content";
import { SectionIntro } from "@/app/_component/SectionIntro";
import { PricingTabs } from "@/app/_component/PricingTabs";

export function Pricing() {
  return (
    <section id={pricing.id} className="scroll-mt-18 border-t border-white/6 px-6 py-24 md:py-32">
      <SectionIntro eyebrow={pricing.eyebrow} heading={pricing.heading} subtitle={pricing.subtitle} />
      <PricingTabs />
    </section>
  );
}
