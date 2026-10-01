"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const EMAIL_LIMIT = 4000;

export function DraftBox({
  email,
  onChange,
}: {
  email: string;
  onChange?: (value: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const over = email.length > EMAIL_LIMIT;

  async function copy() {
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setToast("Copied");
    setTimeout(() => {
      setCopied(false);
      setToast("");
    }, 1600);
  }

  return (
    <div className="relative flex flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Email</p>
      <textarea
        value={email}
        onChange={(event) => onChange?.(event.target.value)}
        rows={16}
        className="rounded-2xl border border-border bg-muted/60 p-3 font-mono text-sm text-foreground transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Email"
      />
      <div className="flex items-center justify-between">
        <span className={cn("font-mono text-xs", over ? "text-destructive" : "text-muted-foreground")}>
          {email.length}/{EMAIL_LIMIT}
        </span>
        <Button type="button" variant="outline" onClick={copy} className="rounded-full px-4">
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
