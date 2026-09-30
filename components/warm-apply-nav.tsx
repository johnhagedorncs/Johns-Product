import Link from "next/link";

const links = [
  { href: "/scan", label: "Scan" },
  { href: "/tracker", label: "Tracker" },
];

export function WarmApplyNav() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-6 py-4 md:px-8">
        <Link href="/" className="text-lg font-semibold text-foreground">
          Warm Apply
        </Link>
        <nav className="flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
