"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Sparkles } from "lucide-react";
import { createWorkspace } from "@/actions/workspace";
import { getActivePromptUsage } from "@/actions/usage";
import { useFetch } from "@/hooks/use-fetch";
import { Button } from "@/components/ui/button";
import MicButton from "@/components/MicButton";
import { useUpgradeDialog } from "@/components/UpgradeDialog";
import { UPGRADE_REASONS } from "@/lib/plan-limits";
import { submitOnEnter } from "@/lib/utils";
import { DashboardGreeting } from "./DashboardGreeting";

const MAX_NAME_LENGTH = 48;

const EXAMPLE_PROMPTS = [
  "Design a blog database and document each table",
  "Map out a user onboarding flow",
  "Plan the architecture for a chat app",
];

// "design a blog schema: users, posts..." -> "Design a blog schema: users, posts", cut on a word.
function nameFromPrompt(prompt: string) {
  const firstLine = prompt.trim().split("\n")[0];
  const name =
    firstLine.length <= MAX_NAME_LENGTH
      ? firstLine
      : firstLine.slice(0, MAX_NAME_LENGTH).replace(/\s+\S*$/, "");
  const clean = name.replace(/[\s.,:;!?-]+$/, "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// Creates a workspace from the prompt and opens it; the workspace's agent sends the prompt
// as its first message (see AgentToggleButton).
export function DashboardPrompt() {
  const [prompt, setPrompt] = useState("");
  const [listening, setListening] = useState(false);
  const router = useRouter();
  const { fn: createWorkspaceFn, loading } = useFetch(createWorkspace);
  const openUpgrade = useUpgradeDialog();
  const busy = loading ?? false;
  
  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    // The new workspace belongs to the active account, so its prompts are the ones that count.
    // Out of prompts: offer the upgrade instead of opening a workspace whose agent can't answer.
    const usage = await getActivePromptUsage().catch(() => null);
    if (usage && usage.used >= usage.limit) return openUpgrade(UPGRADE_REASONS.prompts);
    const result = await createWorkspaceFn(nameFromPrompt(trimmed), trimmed);
    if (!result) return;
    if ("limit" in result) return openUpgrade(UPGRADE_REASONS[result.limit]);
    router.push(`/workspace/${result.workspace.id}?prompt=${encodeURIComponent(trimmed)}`);
  };

  return (
    <section className="topo-bg relative mx-auto mb-16 w-full max-w-4xl px-6 pt-12 pb-10 text-center">
      <div aria-hidden className="glow-orb -z-10 top-0 left-1/2 h-72 w-[640px] -translate-x-1/2 opacity-60" />
      <p className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/6 px-3 py-1 text-[11px] font-medium text-primary/90">
        <Sparkles className="size-3" />
        Outpost Agent
      </p>
      <DashboardGreeting />
      <p className="mt-3 text-pretty text-muted-foreground">Describe it, and the agent drafts the doc and the canvas for you.</p>

      <div className="edge-glow mx-auto mt-8 max-w-3xl rounded-3xl bg-[linear-gradient(180deg,oklch(0.2_0.006_285/0.92),oklch(0.16_0.005_285/0.92))] p-3 text-left shadow-[0_30px_80px_-30px_oklch(0_0_0/0.9),0_0_0_1px_oklch(1_0_0/0.06)] backdrop-blur-xl transition-shadow duration-300 focus-within:shadow-[0_30px_80px_-30px_oklch(0_0_0/0.9),0_0_0_1px_oklch(0.74_0.16_55/0.5),0_0_0_5px_oklch(0.74_0.16_55/0.12),0_20px_60px_-20px_oklch(0.74_0.16_55/0.35)]">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={submitOnEnter(handleSubmit)}
          placeholder="e.g. Design the database for a food delivery app and document it"
          rows={2}
          disabled={busy}
          readOnly={listening}
          autoFocus
          className="field-sizing-content max-h-60 min-h-14 w-full resize-none bg-transparent px-2 pt-1 text-base leading-6 outline-none placeholder:text-muted-foreground/70"
        />
        <div className="mt-1 flex items-center justify-between gap-2 pl-2">
          <span className="hidden items-center gap-1 text-xs text-muted-foreground/70 sm:flex">
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px]">Shift</kbd>+
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px]">Enter</kbd>
            for a new line
          </span>
          <span className="sm:hidden" />
          <div className="flex items-center gap-1.5">
            <MicButton value={prompt} onChange={setPrompt} onListeningChange={setListening} disabled={busy} />
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!prompt.trim() || busy}
              aria-label="Create workspace"
              className="size-9 rounded-full"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
        {EXAMPLE_PROMPTS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setPrompt(example)}
            disabled={busy}
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/3 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur-sm transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-primary/6 hover:text-foreground"
          >
            <Sparkles className="size-3 text-primary/60 transition-colors group-hover:text-primary" />
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}