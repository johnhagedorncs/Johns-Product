export type JobTier = "A" | "B" | "C";

export type TrackerStatus =
  | "queued"
  | "messaged"
  | "replied"
  | "chat"
  | "referred"
  | "no";

export type FitAction = "apply_now" | "apply_and_outreach" | "skip";

export interface JobFitResult {
  score: number;
  reasons: string[];
  gaps: string[];
  redFlags: string[];
  action: FitAction;
}

export interface Job {
  id: string;
  company: string;
  title: string;
  location: string;
  tier: JobTier;
  jobUrl: string;
  postedAt: string;
  teamHint: string;
  requirements: string[];
  description?: string;
  early?: boolean;
  /** Set from seed, AI fit store, or merge — omitted until scored */
  fitScore?: number;
  fit?: JobFitResult;
}

export interface OutreachContact {
  jobId: string;
  name: string;
  linkedinUrl: string;
  relationship: string;
  roleRelevance: string;
  why: string;
  draftMessage: string;
  rankScore: number;
}

export interface TrackerRow {
  id: string;
  date: string;
  company: string;
  role: string;
  jobUrl: string;
  person: string;
  linkedinUrl: string;
  reason: string;
  status: TrackerStatus;
  nextFollowup: string;
  connectionNote?: string;
  emailDraft?: string;
  coffeeQuestions?: string[];
}
