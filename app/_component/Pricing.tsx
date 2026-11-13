import { pricing } from "@/lib/landing-content";
import { SectionIntro } from "@/app/_component/SectionIntro";
import { PricingTabs } from "@/app/_component/PricingTabs";

export function Pricing() {
  return (
    <section id={pricing.id} className="relative scroll-mt-18 px-6 py-24 md:py-32">
      <div aria-hidden className="hairline absolute inset-x-0 top-0" />
      <SectionIntro eyebrow={pricing.eyebrow} heading={pricing.heading} subtitle={pricing.subtitle} />
      <PricingTabs />
    </section>
  );
}
