# Warm Route

Find fresh new-grad roles, see how your resume actually matches each posting, and get a ranked warm path into the company — the same day the role goes up.

## What it does

- **Scan** — pulls roles from three places in one click:
  - your watch list (`data/companies.json`) through the public Greenhouse, Ashby, and Lever job-board APIs;
  - the [SimplifyJobs New-Grad-Positions](https://github.com/SimplifyJobs/New-Grad-Positions) list on GitHub;
  - LinkedIn's public (logged-out) job search, past week, entry level.
  Duplicates across sources are merged; the earliest post date wins.
- **Fit score** — every role gets an instant check of the posting against your resume: skill overlap, years required, graduation window, clearance / PhD / citizenship, role family, location, early-career signals. With an OpenAI key, the model then reads the top roles against the resume and the check caps its score (hard blockers → 2, not-early-career → 4).
- **Resume match + tailoring** — matched and missing skills, gaps, and line-by-line rewording for the posting.
- **Warm paths** — ranked LinkedIn and Google searches for people at the company who share your school, groups, or past employers, plus same-team engineers and recruiters. They open in your own logged-in browser. "Find names with AI" adds web-search results to verify.
- **Draft + track** — paste a profile, get a ≤300-char note, a short email, and chat questions; mark messaged and the tracker schedules a follow-up in 3 business days.

Nothing is sent for you and nothing logs into LinkedIn. Your resume, inbox, and tracker stay in this browser's localStorage.

## Run it

```bash
npm install
npm run dev
```

`.env` (and the Vercel project's environment variables):

```
OPENAI_API_KEY=sk-...
# optional — defaults shown
AI_MODEL_FAST=gpt-4o-mini
AI_MODEL_SMART=gpt-4o
```

Without a key, scanning, rule scores, and warm-path searches still work.

## Deploying on Vercel

- Server actions run on the page that calls them; `/` and `/jobs/[id]` set `maxDuration = 60`.
- Nothing writes to the filesystem, so the read-only Vercel runtime is fine.
- LinkedIn sometimes rate-limits datacenter IPs. When it does, the scan shows `LinkedIn jobs: 0 ⚠` and the other sources still load.
- The app has no login. Turn on Vercel **Deployment Protection** so strangers can't spend your OpenAI credits.

## Tests

```bash
npm test        # vitest + coverage floor on lib/
npm run build
```
