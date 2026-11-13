import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shown for a share link that doesn't exist, was turned off or reset, or whose owner's plan no
// longer includes public sharing. It doesn't say which, so links can't be probed.
export default function SharedLinkNotFound() {
  return (
    <main className="topo-bg flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div aria-hidden className="glow-orb -z-10 top-1/4 left-1/2 h-80 w-[560px] -translate-x-1/2 opacity-50" />

      <div className="edge-glow w-full max-w-md rounded-3xl bg-card/80 p-10 shadow-[0_30px_80px_-30px_oklch(0_0_0/0.9)] backdrop-blur-xl">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25">
          <LinkIcon className="size-6" />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">This link isn&apos;t available</h1>
        <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
          The owner may have turned off sharing or created a new link. Ask them to send you the current one.
        </p>
        <Button asChild size="lg" className="mt-8 h-11 rounded-xl px-5">
          <Link href="/">
            Discover Outpost
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>

      <Link href="/" className="mt-8 flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <Image src="/brand/mascot-dark.png" alt="" width={16} height={16} className="size-4" />
        Outpost: an AI agent that draws and writes with your team
      </Link>
    </main>
  );
}
