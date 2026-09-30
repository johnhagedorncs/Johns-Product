"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { OutreachContact } from "@/lib/types";

export type MessagedPayload = {
  person: string;
  linkedinUrl: string;
  reason: string;
  company: string;
  role: string;
  jobUrl: string;
};

type ContactCardProps = {
  contact: OutreachContact;
  rank: number;
  company: string;
  role: string;
  jobUrl: string;
  onMessaged?: (payload: MessagedPayload) => void;
};

export function ContactCard({
  contact,
  rank,
  company,
  role,
  jobUrl,
  onMessaged,
}: ContactCardProps) {
  const [draft, setDraft] = useState(contact.draftMessage);
  const [copied, setCopied] = useState(false);

  async function copyDraft() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">
            #{rank} {contact.name}
          </CardTitle>
          <Badge variant="secondary">score {contact.rankScore}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{contact.why}</p>
        <a
          href={contact.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:underline"
        >
          Open LinkedIn profile
        </a>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          className="text-sm"
          aria-label={`Draft message to ${contact.name}`}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={copyDraft}>
            {copied ? "Copied" : "Copy draft"}
          </Button>
          <Button
            type="button"
            onClick={() =>
              onMessaged?.({
                person: contact.name,
                linkedinUrl: contact.linkedinUrl,
                reason: contact.why,
                company,
                role,
                jobUrl,
              })
            }
          >
            Mark messaged
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
