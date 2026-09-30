import type { ReactNode } from "react";
import { cn } from "cn";

const tones = {
  neutral: "bg-muted text-foreground",
  blue: "bg-secondary text-secondary-foreground",
  purple: "bg-accent text-accent-foreground",
  green: "bg-success/15 text-success",
  amber: "bg-warning/15 text-warning",
  rose: "bg-destructive/10 text-destructive",
} as const;

export function Chip({
  children,
  tone = "neutral",
  icon,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone]
      )}
    >
      {icon}
      {children}
    </span>
  );
}
