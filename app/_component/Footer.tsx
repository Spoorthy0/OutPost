import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { footer } from "@/lib/landing-content";

export async function Footer() {
  "use cache";
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/6 bg-card/40 px-6 pt-16 pb-8">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex">
            <Image src="/brand/logo-navbar-dark.png" alt="Outpost" width={314} height={160} className="h-9 w-auto" />
          </Link>
          <p className="mt-4 max-w-xs text-sm text-pretty text-muted-foreground">{footer.tagline}</p>
        </div>

        {footer.columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">{column.title}</p>
            <ul className="mt-4 space-y-3 text-sm">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-foreground/80 transition-colors hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mx-auto mt-14 flex max-w-5xl flex-col items-center justify-between gap-3 border-t border-white/6 pt-6 text-xs text-muted-foreground sm:flex-row">
        <p>© {year} Outpost. All rights reserved.</p>
        <p className="inline-flex items-center gap-1.5">
          {footer.madeBy.before}
          <Heart aria-label="love" className="size-3.5 fill-primary text-primary" />
          {footer.madeBy.after}
        </p>
      </div>
    </footer>
  );
}
