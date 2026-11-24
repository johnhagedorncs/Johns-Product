import profileSeed from "@/data/profile.json";

export interface Profile {
  name: string;
  summary: string;
  school: string;
  fraternity: string;
  location: string;
  targetRoles: string[];
  proofPoints: string[];
  pitch: string;
  /** Early career unless an uploaded resume says otherwise */
  level?: "entry" | "experienced";
  /** Saved resume used until a PDF is uploaded */
  resumeText?: string;
}

export function getProfile(): Profile {
  return profileSeed as Profile;
}

export function savedResumeText(): string {
  return getProfile().resumeText ?? "";
}
