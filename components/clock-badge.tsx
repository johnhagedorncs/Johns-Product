import { isFreshPosting, relativePosted } from "@/lib/jobs";
import { cn } from "cn";

export function ClockBadge({ postedAt }: { postedAt: string }) {
  const fresh = isFreshPosting(postedAt);
  return (
    <span
      className={cn(
        "font-mono text-xs",
        fresh ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {relativePosted(postedAt)}
    </span>
  );
}
