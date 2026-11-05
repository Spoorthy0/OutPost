"use client";

import { PricingTable } from "@clerk/nextjs";
import { Tabs } from "radix-ui";
import { pricing } from "@/lib/landing-content";

// Personal shows the plans billed to a user, Team the plans billed to an organization.
export function PricingTabs() {
  const [first] = pricing.tabs;

  return (
    <Tabs.Root defaultValue={first.value} className="mx-auto mt-12 max-w-5xl">
      <Tabs.List
        aria-label="Plan type"
        className="mx-auto flex w-fit items-center gap-1 rounded-full border border-white/10 bg-card p-1"
      >
        {pricing.tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className="rounded-full px-5 py-1.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {pricing.tabs.map((tab) => (
        <Tabs.Content key={tab.value} value={tab.value} className="mt-12 outline-none">
          <PricingTable for={tab.payer} />
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
