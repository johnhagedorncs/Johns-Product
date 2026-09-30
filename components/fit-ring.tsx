import { cn } from "cn";

export function FitRing({ score, basis }: { score?: number; basis?: "rules" | "ai" }) {
  const value = score ?? 0;
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const dash = (Math.min(5, Math.max(0, value)) / 5) * circ;
  const tone =
    score == null
      ? "text-muted-foreground"
      : score >= 4
        ? "text-success"
        : score === 3
          ? "text-warning"
          : "text-muted-foreground";
  const label =
    score == null
      ? "Fit not scored"
      : `Fit ${score} of 5${basis === "ai" ? ", read by AI" : basis === "rules" ? ", quick estimate" : ""}`;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={cn("relative size-12 shrink-0", tone)} aria-label={label} role="img">
        <svg viewBox="0 0 44 44" className="size-12 -rotate-90" aria-hidden>
          <circle cx="22" cy="22" r={radius} className="stroke-border" strokeWidth="4" fill="none" />
          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            strokeOpacity={basis === "rules" ? 0.55 : 1}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-mono text-xs font-semibold text-foreground">
          {score ?? "–"}
        </span>
      </div>
      {basis ? (
        <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
          {basis === "ai" ? "AI" : "est."}
        </span>
      ) : null}
    </div>
  );
}
