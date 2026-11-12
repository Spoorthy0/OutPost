"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
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
    <section className="topo-bg mx-auto mb-14 w-full max-w-4xl px-6 py-10 text-center">
      <DashboardGreeting />
      <p className="mt-2 text-muted-foreground">Describe it, and the agent drafts the doc and the canvas for you.</p>

      <div className="mx-auto mt-7 max-w-3xl rounded-3xl border border-white/12 bg-card/80 p-3 text-left shadow-2xl shadow-black/40 backdrop-blur transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
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
          <span className="text-xs text-muted-foreground/70">Shift + Enter for a new line</span>
          <div className="flex items-center gap-1.5">
            <MicButton value={prompt} onChange={setPrompt} onListeningChange={setListening} disabled={busy} />
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={!prompt.trim() || busy}
              aria-label="Create workspace"
              className="rounded-full shadow-lg shadow-primary/25"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-2">
        {EXAMPLE_PROMPTS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setPrompt(example)}
            disabled={busy}
            className="rounded-full border border-white/10 bg-white/3 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}