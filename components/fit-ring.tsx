import { cn } from "cn";

export function FitRing({ score }: { score?: number }) {
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

  return (
    <div
      className={cn("relative size-12 shrink-0", tone)}
      aria-label={score != null ? `Fit ${score} of 5` : "Fit not scored"}
    >
      <svg viewBox="0 0 44 44" className="size-12 -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={radius}
          className="stroke-border"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-xs font-semibold text-foreground">
        {score ?? "–"}
      </span>
    </div>
  );
}
