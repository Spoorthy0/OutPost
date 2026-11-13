"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, SignInButton, SignUpButton, UserButton, OrganizationSwitcher, useAuth } from "@clerk/nextjs";
import { LayoutDashboard, KanbanSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanButton } from "../components/PlanButton";

const LANDING_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

const APP_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspaces", label: "Workspaces", icon: KanbanSquare },
];

// Shared across every route (root layout). The landing page gets its section links and a way into
// the app; inside the app, the logo leads home to the dashboard and the plan button takes its place.
export function SiteHeader() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const isLandingPage = pathname === "/";

  return (
    <header className="fixed inset-x-0 top-0 z-20 flex h-18 items-center justify-between bg-background/65 px-6 backdrop-blur-xl backdrop-saturate-150 md:px-10">
      {/* Bottom edge: a hairline that catches a little amber at the center. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,oklch(1_0_0/0.08)_20%,oklch(0.74_0.16_55/0.35)_50%,oklch(1_0_0/0.08)_80%,transparent)]"
      />

      <div className="flex items-center gap-8">
        <Link href={isSignedIn && !isLandingPage ? "/dashboard" : "/"} className="flex items-center transition-opacity hover:opacity-85">
          <Image src="/brand/logo-navbar-dark.png" alt="Outpost" width={314} height={160} className="h-9 w-auto" priority />
        </Link>

        {!isLandingPage && isSignedIn && (
          <nav aria-label="App" className="hidden items-center gap-1 text-sm md:flex">
            {APP_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                    active
                      ? "bg-white/8 text-foreground ring-1 ring-white/10"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <Icon className={`size-3.5 ${active ? "text-primary" : ""}`} />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {isLandingPage && (
        <nav
          aria-label="Sections"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-white/8 bg-white/3 p-1 text-sm text-muted-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.04)] md:flex"
        >
          {LANDING_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="rounded-full px-4 py-1.5 transition-colors hover:bg-white/6 hover:text-foreground">
              {label}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex items-center gap-3">
        {/* <Show> swaps branches once Clerk resolves the session, so the header reflects real auth state */}
        {/* Modal mode opens Clerk's form over the page; /sign-in and /sign-up stay for redirects. */}
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button variant="ghost" size="sm" className="text-muted-foreground">Sign in</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button size="sm" className="px-3.5">Get started</Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          {/* Membership-optional: hidePersonal=false lets a solo user stay on their personal
              account instead of being forced to create/join an org. */}
          <OrganizationSwitcher afterCreateOrganizationUrl="/dashboard" afterSelectOrganizationUrl="/dashboard" />
          {isLandingPage ? (
            <Button asChild size="sm" className="px-3.5">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <PlanButton />
          )}
          <UserButton />
        </Show>
      </div>
    </header>
  );
}
