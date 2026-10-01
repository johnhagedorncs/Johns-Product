export type JobTier = "A" | "B" | "C";

export type JobSource = "greenhouse" | "ashby" | "lever" | "simplify" | "linkedin" | "url";

export type TrackerStatus =
  | "queued"
  | "messaged"
  | "replied"
  | "chat"
  | "referred"
  | "no";

export type FitAction = "apply_now" | "apply_and_outreach" | "skip";

export type FitCheckLevel = "good" | "warn" | "block";

export interface FitCheck {
  label: string;
  level: FitCheckLevel;
  detail: string;
}

export interface JobFitResult {
  score: number;
  reasons: string[];
  gaps: string[];
  redFlags: string[];
  action: FitAction;
  /** "rules" = instant keyword/requirement check, "ai" = model read the resume and posting */
  basis?: "rules" | "ai";
  matchedSkills?: string[];
  missingSkills?: string[];
  checks?: FitCheck[];
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
  source?: JobSource;
  /** Every board this role showed up on after de-duplication */
  sources?: JobSource[];
  onWatchList?: boolean;
  /** LinkedIn company page slug (linkedin.com/company/<slug>) for employee searches */
  companyLinkedIn?: string;
  /** LinkedIn's applicant count text, e.g. "Over 200 applicants" */
  applicants?: string;
  /** Set from the fit check — omitted until scored */
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
