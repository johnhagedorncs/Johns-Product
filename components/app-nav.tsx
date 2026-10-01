"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Radar } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requestInboxScan } from "@/lib/inbox-session";
import { cn } from "cn";

const links = [
  { href: "/", label: "Inbox" },
  { href: "/tracker", label: "Tracker" },
  { href: "/people", label: "People" },
  { href: "/settings", label: "Settings" },
];

const NAV_MEMORY_KEY = "warm-apply-nav";

function sectionOf(pathname: string): string {
  if (pathname.startsWith("/tracker")) return "/tracker";
  if (pathname.startsWith("/people")) return "/people";
  if (pathname.startsWith("/settings")) return "/settings";
  return "/";
}

function readNavMemory(): Record<string, string> {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(NAV_MEMORY_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
  } catch {
    return {};
  }
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  const [lastPath, setLastPath] = useState<Record<string, string>>({});

  useEffect(() => {
    const next = { ...readNavMemory(), [sectionOf(pathname)]: pathname };
    sessionStorage.setItem(NAV_MEMORY_KEY, JSON.stringify(next));
    setLastPath(next);
  }, [pathname]);

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
    <header className="sticky top-0 z-20 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5">
        <div className="flex items-center gap-10">
        <Link
          href={lastPath["/"] ?? "/"}
          className="font-heading text-2xl whitespace-nowrap font-light tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Warm Apply
        </Link>
        <nav className="flex items-center gap-5" aria-label="Main">
          {links.map((link) => {
            const active = sectionOf(pathname) === link.href;
            return (
              <Link
                key={link.href}
                href={lastPath[link.href] ?? link.href}
                className={cn(
                  "inline-flex items-center gap-1.5 px-1.5 py-1 text-[15px] underline-offset-[6px] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "text-foreground underline decoration-1"
                    : "text-foreground/70 hover:text-foreground"
                )}
              >
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={scanNow}
            disabled={spinning}
            aria-label="Scan now"
            className={cn(
              buttonVariants(),
              "h-10 rounded-full border-transparent bg-brand px-5 transition-all duration-200 hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {spinning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Radar className="size-4" />
            )}
            <span>Scan now</span>
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
      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}
