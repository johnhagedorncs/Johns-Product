"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Inbox, Kanban, Loader2, Radar, Settings, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requestInboxScan } from "@/lib/inbox-session";
import { cn } from "cn";

const links = [
  { href: "/", label: "Inbox", icon: Inbox },
  { href: "/tracker", label: "Tracker", icon: Kanban },
  { href: "/people", label: "People", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function scanNow() {
    setSpinning(true);
    if (pathname !== "/") router.push("/");
    requestInboxScan();
  }

  useEffect(() => {
    function done() {
      setSpinning(false);
    }
    window.addEventListener("warm-scan-done", done);
    return () => window.removeEventListener("warm-scan-done", done);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Warm Apply
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={scanNow}
            disabled={spinning}
            className={cn(
              buttonVariants(),
              "bg-brand border-transparent transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {spinning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Radar className="size-4" />
            )}
            Scan now
          </button>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={() => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("warm-theme", next ? "dark" : "light");
        setDark(next);
      }}
      className="rounded-full border border-border px-3 py-1 text-xs font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}
