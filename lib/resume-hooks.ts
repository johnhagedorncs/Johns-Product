export type ResumeHooks = {
  schools: string[];
  employers: string[];
  groups: string[];
};

const JOB_TITLE =
  /\b(intern|engineer|engineering|developer|lead|manager|analyst|researcher|scientist)\b/i;

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function schoolLabels(line: string): string[] {
  if (/ucsb|uc santa barbara|university of california,?\s*santa barbara/i.test(line)) {
    return ["UCSB", "UC Santa Barbara"];
  }
  const named = line.match(
    /\b([A-Z][\p{L}.'&-]+(?:\s+[A-Z][\p{L}.'&-]+){0,4}\s+(?:University|College))\b/u
  );
  if (named?.[1]) return [named[1]];
  if (/\b(university|college)\b/i.test(line)) {
    const compact = line.split(/[,(]/)[0]?.trim() ?? "";
    if (compact && compact.length <= 40) return [compact];
  }
  return [];
}

function isSchoolOrg(org: string): boolean {
  return /ucsb|university|college|information technology/i.test(org);
}

function companyOnNextLine(line: string): string {
  return line
    .replace(/\s+Remote$/i, "")
    .replace(/\s+[A-Z][\p{L}.]+(?:\s+[A-Z][\p{L}.]+)*,\s*[A-Z]{2}$/u, "")
    .trim();
}

export function resumeHooks(resumeText: string): ResumeHooks {
  const schools: string[] = [];
  const employers: string[] = [];
  const groups: string[] = [];
  const lines = resumeText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    schools.push(...schoolLabels(line));

    const role = line.match(/^(.{2,48}?)\s+[—–-]\s+(.+)$/);
    if (role && JOB_TITLE.test(role[2])) {
      const org = role[1].trim();
      if (!isSchoolOrg(org)) employers.push(org);
      continue;
    }

    const next = lines[index + 1] ?? "";
    const datedRole =
      JOB_TITLE.test(line) &&
      /\b(19|20)\d{2}\b/.test(line) &&
      !/\b(b\.s|m\.s|b\.a|m\.a|bachelor|master|minor|expected)\b/i.test(line);
    if (datedRole && next && !/^[•\-*]/.test(next)) {
      const org = companyOnNextLine(next);
      if (org && !isSchoolOrg(org)) employers.push(org);
    }

    if (
      line.length <= 80 &&
      !/[.!?]/.test(line) &&
      /\b(zeta beta tau|fraternity|gamma xi|alpha|beta|sigma|club|society)\b/i.test(
        line
      )
    ) {
      groups.push(line.split(",")[0]?.trim() ?? line);
    }
  }

  return {
    schools: unique(schools),
    employers: unique(employers),
    groups: unique(groups),
  };
}

export function hookLabels(hooks: ResumeHooks): string[] {
  return unique([...hooks.schools, ...hooks.groups, ...hooks.employers]);
}

export function mentionsResumeHook(text: string, hooks: string[]): boolean {
  if (hooks.length === 0) return false;
  const hay = text.toLowerCase();
  return hooks.some((hook) => {
    const needle = hook.trim().toLowerCase();
    return needle.length >= 3 && hay.includes(needle);
  });
}
