import { Hero } from "@/app/_component/Hero";
import { AudienceStrip } from "@/app/_component/AudienceStrip";
import { Features } from "@/app/_component/Features";
import { HowItWorks } from "@/app/_component/HowItWorks";
import { Pricing } from "@/app/_component/Pricing";
import { CallToAction } from "@/app/_component/CallToAction";
import { Footer } from "@/app/_component/Footer";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <AudienceStrip />
      <Features />
      <HowItWorks />
      <Pricing />
      <CallToAction />
      <Footer />
    </main>
  );
}
