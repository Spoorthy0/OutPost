import type { FeatureMock } from "@/lib/landing-content";

// Static, decorative previews of each surface. They're illustrations rather than copy, so their
// labels live here instead of in the content file, and they're hidden from screen readers.

function MockFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div aria-hidden className="overflow-hidden rounded-xl border border-white/10 bg-card shadow-xl shadow-black/30">
      <div className="flex items-center gap-2 border-b border-white/6 px-4 py-2.5">
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FlowchartMock() {
  const node = "fill-secondary stroke-white/15";
  const label = "fill-foreground text-[11px] font-medium";
  return (
    <MockFrame title="architecture.canvas">
      <svg viewBox="0 0 400 240" className="w-full">
        <defs>
          <pattern id="mock-dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className="fill-white/8" />
          </pattern>
          <marker id="mock-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" className="fill-muted-foreground" />
          </marker>
        </defs>
        <rect width="400" height="240" fill="url(#mock-dots)" />

        <g className="stroke-muted-foreground" strokeWidth="1.25" fill="none" markerEnd="url(#mock-arrow)">
          <path d="M110 120 H160" />
          <path d="M250 105 C 275 105, 275 60, 292 60" />
          <path d="M250 135 C 275 135, 275 180, 292 180" />
        </g>

        <rect x="30" y="100" width="80" height="40" rx="8" className={node} />
        <text x="70" y="124" textAnchor="middle" className={label}>Client</text>

        {/* The node the agent is currently placing */}
        <rect x="160" y="96" width="90" height="48" rx="8" className="fill-accent stroke-primary" strokeWidth="1.5" />
        <text x="205" y="124" textAnchor="middle" className="fill-accent-foreground text-[11px] font-medium">API</text>

        <rect x="292" y="40" width="84" height="40" rx="8" className={node} />
        <text x="334" y="64" textAnchor="middle" className={label}>Auth</text>

        <rect x="292" y="160" width="84" height="40" rx="20" className={node} />
        <text x="334" y="184" textAnchor="middle" className={label}>Postgres</text>

        <g transform="translate(244 146)">
          <path d="M0 0 L0 13 L4 10 L7 16 L9 15 L6 9 L11 9 z" className="fill-primary" />
          <rect x="12" y="12" width="40" height="16" rx="4" className="fill-primary" />
          <text x="32" y="23.5" textAnchor="middle" className="fill-primary-foreground text-[9px] font-semibold">Agent</text>
        </g>
      </svg>
    </MockFrame>
  );
}

function DocMock() {
  const line = "h-2 rounded-full bg-white/10";
  return (
    <MockFrame title="product-spec.doc">
      <div className="space-y-4">
        <div className="h-4 w-2/3 rounded-full bg-white/20" />
        <div className="space-y-2">
          <div className={`${line} w-full`} />
          <div className={`${line} w-11/12`} />
          <div className={`${line} w-4/5`} />
        </div>
        <div className="h-3 w-1/3 rounded-full bg-white/15" />
        {/* Section the agent is rewriting */}
        <div className="relative rounded-lg border border-primary/40 bg-accent/60 p-3">
          <span className="absolute -top-2.5 right-3 rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
            Agent is rewriting
          </span>
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-primary/40" />
            <div className="h-2 w-5/6 rounded-full bg-primary/40" />
            <div className="h-2 w-2/5 rounded-full bg-primary/40" />
          </div>
        </div>
        <div className="space-y-2">
          <div className={`${line} w-full`} />
          <div className={`${line} w-3/4`} />
        </div>
      </div>
    </MockFrame>
  );
}

const columns = [
  { name: "To do", cards: [["Design schema", "bg-chart-3"], ["Write API spec", "bg-chart-2"]] },
  { name: "In progress", cards: [["Auth flow", "bg-primary"], ["Onboarding copy", "bg-chart-3"]] },
  { name: "Done", cards: [["Project setup", "bg-chart-4"]] },
] as const;

function KanbanMock() {
  return (
    <MockFrame title="team-board">
      <div className="grid grid-cols-3 gap-3">
        {columns.map((column) => (
          <div key={column.name} className="rounded-lg bg-white/3 p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-medium text-muted-foreground">{column.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground/70">{column.cards.length}</span>
            </div>
            <div className="space-y-2">
              {column.cards.map(([title, tag]) => (
                <div key={title} className="rounded-md border border-white/8 bg-secondary p-2">
                  <span className={`mb-1.5 block h-1 w-6 rounded-full ${tag}`} />
                  <p className="text-[11px] leading-tight text-foreground/90">{title}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="size-3.5 rounded-full bg-white/15" />
                    <span className="h-1.5 w-6 rounded-full bg-white/8" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

export function FeatureMockView({ mock }: { mock: FeatureMock }) {
  switch (mock) {
    case "flowchart":
      return <FlowchartMock />;
    case "doc":
      return <DocMock />;
    case "kanban":
      return <KanbanMock />;
  }
}
