import { FileText, Shapes, SquareKanban, type LucideIcon } from "lucide-react";

// All landing-page copy lives here so wording changes never touch layout code.

export const hero = {
  eyebrow: "Early access",
  headline: { before: "Map the unknown together, with ", highlight: "Outpost", after: "" },
  subtitle:
    "An AI agent that draws and writes alongside you and your team, live. Sketch ideas on the canvas, shape them in docs, and ship faster.",
  primaryCta: { label: "Start building free", href: "/sign-up" },
  secondaryCta: { label: "How it works", href: "#how-it-works" },
  video: {
    webm: "/videos/hero.webm",
    mp4: "/videos/hero.mp4",
    poster: "/videos/hero-poster.jpg",
    label: "Outpost product demo",
  },
};

export const audience = {
  label: "Built for",
  items: ["Product teams", "Engineers", "Designers", "Founders", "Agencies", "Students"],
};

export type FeatureMock = "flowchart" | "doc" | "kanban";

export type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: [string, string, string];
  mock: FeatureMock;
};

export const features = {
  id: "product",
  eyebrow: "The workspace",
  heading: "Everything your team builds, in one place",
  subtitle:
    "Every surface your team needs sits side by side, and the agent works across all of them.",
  items: [
    {
      icon: Shapes,
      title: "Canvas",
      description:
        "An infinite whiteboard where the agent draws ERDs, architecture diagrams and flows shape by shape, then edits them in place when you ask.",
      bullets: [
        "Diagrams built live, one shape at a time",
        "Ask for a change and it updates in place",
        "Pan, zoom and sketch alongside the agent",
      ],
      mock: "flowchart",
    },
    {
      icon: FileText,
      title: "Doc",
      description:
        "A shared doc where the agent drafts specs, PRDs and meeting notes with you, and rewrites any section on request.",
      bullets: [
        "Drafts from a one-line prompt",
        "Rewrite, expand or tighten any section",
        "Everyone edits together in real time",
      ],
      mock: "doc",
    },
    {
      icon: SquareKanban,
      title: "Team board",
      description:
        "A kanban board for your team. The agent turns plans into tickets and keeps their status in sync as work moves.",
      bullets: [
        "Turn a doc or diagram into tickets",
        "Drag cards across columns as work moves",
        "Assign owners and see progress at a glance",
      ],
      mock: "kanban",
    },
  ] satisfies Feature[],
};

export const howItWorks = {
  id: "how-it-works",
  eyebrow: "How it works",
  heading: "From a sentence to a shared plan",
  subtitle: "No templates to learn. Say what you need and build on it with your team.",
  steps: [
    {
      title: "Describe it",
      description:
        "Tell the agent what you need in plain language: a database schema, a system diagram, a product spec or a launch plan.",
    },
    {
      title: "Watch the agent draw",
      description:
        "It builds on the canvas shape by shape and drafts the doc alongside, live, so you can follow every step.",
    },
    {
      title: "Keep iterating together",
      description:
        "Ask for changes, edit by hand and bring in teammates. The agent updates the work in place as it evolves.",
    },
  ],
};

export const cta = {
  eyebrow: "Get started",
  heading: { before: "Set up your team's ", highlight: "outpost", after: " today" },
  subtitle: "Free to start, no credit card required. Bring your team in whenever you're ready.",
  primaryCta: { label: "Start building free", href: "/sign-up" },
  secondaryCta: { label: "See pricing", href: "#pricing" },
};

export const footer = {
  tagline: "An AI agent that draws and writes alongside you and your team, live.",
  columns: [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#product" },
        { label: "How it works", href: "#how-it-works" },
        { label: "Pricing", href: "#pricing" },
      ],
    },
    {
      title: "Get started",
      links: [
        { label: "Sign up", href: "/sign-up" },
        { label: "Sign in", href: "/sign-in" },
        { label: "Dashboard", href: "/dashboard" },
      ],
    },
  ],
  madeBy: { before: "Made with", after: "by Spoorthy" },
};

export const pricing = {
  id: "pricing",
  eyebrow: "Pricing",
  heading: "Simple pricing that grows with your team",
  subtitle: "Start free. Upgrade when you need more from the agent and your workspace.",
  // Each tab renders Clerk's <PricingTable> for one payer type; the plans themselves live in Clerk.
  tabs: [
    { value: "personal", label: "Personal", payer: "user" },
    { value: "team", label: "Team", payer: "organization" },
  ] as const,
};
