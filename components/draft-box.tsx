"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export function DraftBox({
  connectionNote,
  email,
  onConnectionChange,
  onEmailChange,
}: {
  connectionNote: string;
  email: string;
  onConnectionChange?: (value: string) => void;
  onEmailChange?: (value: string) => void;
}) {
  const [tab, setTab] = useState<"note" | "email">("note");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const value = tab === "note" ? connectionNote : email;
  const limit = tab === "note" ? 300 : null;
  const over = limit != null && value.length > limit;

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setToast("Copied");
    setTimeout(() => {
      setCopied(false);
      setToast("");
    }, 1600);
  }

  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex gap-1 rounded-full bg-muted p-1" role="tablist">
        {(
          [
            ["note", "Connection note"],
            ["email", "Email"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={value}
        onChange={(event) =>
          tab === "note"
            ? onConnectionChange?.(event.target.value)
            : onEmailChange?.(event.target.value)
        }
        rows={6}
        className="rounded-2xl border border-border bg-muted/60 p-3 font-mono text-sm text-foreground transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={tab === "note" ? "Connection note" : "Email draft"}
      />
      <div className="flex items-center justify-between">
        <span className={cn("font-mono text-xs", over ? "text-destructive" : "text-muted-foreground")}>
          {limit ? `${value.length}/${limit}` : `${value.length} chars`}
        </span>
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {toast ? (
        <p
          role="status"
          className="absolute -bottom-8 right-0 rounded-full bg-foreground px-3 py-1 text-xs text-background"
        >
          {toast}
        </p>
      ) : null}
    </div>
  );
}
