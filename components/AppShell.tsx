"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";

// Workspace and shared-link pages are full-screen with their own header, so they skip the site header.
function SiteChrome() {
  const pathname = usePathname();
  const isFullScreenRoute = pathname?.startsWith("/workspace/") || pathname?.startsWith("/shared/");
  if (isFullScreenRoute) return null;

  return (
    <>
      <SiteHeader />
      {/* Room for the fixed header. */}
      <div aria-hidden className="h-18 shrink-0" />
    </>
  );
}

// Only the header reads the pathname, so only it sits inside Suspense: on a dynamic route like
// /workspace/[id] the pathname isn't known while prerendering, and with Cache Components a
// usePathname() outside Suspense blocks the whole route. Static routes still prerender the header.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <SiteChrome />
      </Suspense>
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
