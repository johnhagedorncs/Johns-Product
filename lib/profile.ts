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
}

export function getProfile(): Profile {
  return profileSeed as Profile;
}
