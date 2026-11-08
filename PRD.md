# PRD — Warm Route

**Author:** John  ·  **Date:** 2026-03-29  ·  **Version:** 0.1

---

## 1. Product Summary

- **One-liner:** For **new-grad engineers in NYC** who lose roles to slow cold apply, **Warm Route** is a **job + outreach copilot** that surfaces fresh postings, ranks warm contacts, and drafts messages — while you still apply the same day.
- **TL;DR:** Plan A is a Claude Code skill (`/warm-apply`) that runs the loop from the terminal with LinkedIn in Chrome and a CSV tracker. Plan B (this repo prototype) mirrors the same loop in a web UI. Neither sends messages or auto-applies. Success in the first 2 weeks: messages sent, reply rate, chats booked, referrals — not lines of UI.

## 2. Target Customer

- **User:** John — UCSB CE + business minor (2026), MS Tech Management (2027), ZBT; targeting new-grad SWE / FDE / applied AI / solutions eng, **NYC only**.
- **Buyer:** Same (personal tool).
- **Attributes:**
  1. Applies to roles that close in 48–72 hours; needs an **apply-today** clock.
  2. Has warm angles (UCSB, ZBT, Handshake, UCSB IT) but no system to pick **who** to message.
  3. Will use Simplify Copilot for forms; bottleneck is **who to talk to** and **what to say**, not field typing.

## 3. Customer Problems & the Bet

1. "I see the job too late and I'm applicant #800."
2. "I either spam 'refer me?' or book fake coffee chats with no real question."
3. "I don't track follow-ups and let good leads die."

- **Riskiest assumption:** NYC LinkedIn search yields 2–5 reachable people per posting with enough signal to get replies.
- **The bet:** If every high-fit job gets **apply same day** + **≤3 tailored drafts** to ranked contacts, reply rate beats cold apply within 2 weeks. **We'll know we're right if ≥20% of sent messages get a reply or chat offer across 15+ outreach rows.**

## 4. Product Requirements / Functionality

**Key user stories**
- As a job seeker, I want **new roles from my watch list** so I don't manually refresh boards.
- As a job seeker, I want **fit score + hours since post** so I apply before outreach stalls me.
- As a job seeker, I want **2–5 ranked contacts + draft messages** so I can send in minutes.
- As a job seeker, I want a **tracker + follow-up queue** so nothing goes cold.

| ID | Requirement | Priority | Acceptance criterion |
|----|-------------|----------|----------------------|
| R1 | Scan watch list (Greenhouse/Ashby/Lever), the SimplifyJobs new-grad list, and LinkedIn's public job search; show new roles, best fit first | P0 | Scan now → roles from all sources, de-duplicated; each row shows title, company, age, fit, and which boards it came from. |
| R2 | Job detail: fit, apply-today clock, ranked contacts, editable drafts | P0 | Open `/jobs/[id]` → fit 1–5, hours since post, ≥2 contacts with "why," draft text in a textarea. |
| R3 | Log outreach status; persist after refresh | P0 | On tracker, set status to Messaged → refresh → status unchanged (localStorage). |
| R4 | Follow-ups due today | P1 | `/tracker` highlights rows where `next_followup <= today`. |
| R5 | Paste any job URL | P1 | Home URL field → Greenhouse, Ashby, Lever, LinkedIn, Workday, or career-page link opens a scored job detail; bad link → inline message, no navigation. |
| R6 | Empty tracker on first visit | P1 | Tracker with no rows shows empty state + link to Scan. |

**Build order:** 1) seed `data/jobs.json` + `data/outreach.json` → 2) `lib/` fit + rank display → 3) `/scan`, `/jobs/[id]`, `/tracker` → 4) Plan A skill (outside repo).

**Non-goals (v1):**
- Auto-send LinkedIn messages, connection requests, or InMail.
- LinkedIn API integration or headless login.
- Auto-apply / Copilot control from the web app.
- Scraping LinkedIn profiles or anything behind a login. (Reading the public SimplifyJobs GitHub list and a handful of LinkedIn's logged-out job-search pages per scan is in scope.)

**Do NOT change:** Harbor tokens in `DESIGN.md`; drafts-only outreach policy.

## 5. Data Model

**Persistence:** seed in `data/*.json` · tracker updates in **localStorage** (`warm-apply-tracker`).

- **Job** — `id`, `company`, `title`, `location`, `tier`, `jobUrl`, `postedAt`, `requirements[]`, `teamHint`
- **OutreachContact** — `jobId`, `name`, `linkedinUrl`, `relationship`, `roleRelevance`, `why`, `draftMessage`, `rankScore`
- **TrackerRow** — `id`, `date`, `company`, `role`, `jobUrl`, `person`, `linkedinUrl`, `reason`, `status`, `nextFollowup` (merged seed + local overrides)

**Plan A (skill):** `tracker.csv` with same columns; `companies.json`, `scan_boards.py`, `profile.md`, `templates.md` under `~/.claude/skills/warm-apply/`.

## 6. Guidance on User Experience

**Main flow:** Scan → pick job → read apply-today + fit → copy/edit drafts → mark Messaged → follow up in 3 business days.

**Error / empty:** No jobs → "Add companies to watch list." Bad URL → inline message, no navigation.

### ASCII wireframes (Plan B prototype)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Warm Route          Scan    Tracker    [ Paste job URL ........... ] [Go] │
├─────────────────────────────────────────────────────────────────────────────┤
│  HOME                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Apply today. Warm path second.                                      │   │
│  │  Plan B preview — same rules as /warm-apply skill.                   │   │
│  │  [ View new roles (Scan) ]    [ Outreach tracker ]                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Scan — new on your watch list                          Sort: ★ early first │
├─────────────────────────────────────────────────────────────────────────────┤
│  Tier A                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ ★ 4/5  Cursor · New Grad Software Engineer 2027    NYC    posted 6h   │ │
│  │      [ Open warm path → ]                                              │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│  Tier B                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ ★ 3/5  Sierra · SWE Agent (New Grad 2027)          NYC    posted 1d   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Scan    Cursor · New Grad Software Engineer 2027                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────────────────────────────┐ │
│  │ APPLY TODAY         │  │ Fit 4/5 · Posted 6 hours ago                 │ │
│  │ Don't wait on       │  │ [ Open job posting ]  [ Mark applied ✓ ]     │ │
│  │ outreach.           │  └─────────────────────────────────────────────┘ │
│  └─────────────────────┘                                                   │
│  Ranked contacts (NYC) — you send; we draft only                           │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ #1  Maya L. · SWE · UCSB '24                          score 7        │ │
│  │     Why: Same school, same eng track, on product eng team              │ │
│  │     ┌────────────────────────────────────────────────────────────┐   │ │
│  │     │ Hi Maya — also UCSB CE… [editable textarea]                  │   │ │
│  │     └────────────────────────────────────────────────────────────┘   │ │
│  │     [ Copy ]  [ Mark messaged ]                                      │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ #2  … recruiter / ZBT / team pass …                                  │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Tracker                    Filter: [ All ] [ Follow-ups due ]               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Due today                                                                   │
│  │ Person      │ Company │ Status    │ Next follow-up │ Actions           │ │
│  │ Maya L.     │ Cursor  │ Messaged  │ 2026-04-01     │ [ Draft nudge ]   │ │
│  All rows                                                                    │
│  │ …           │ Sierra  │ Replied   │ —              │ [ Chat scheduled ]│ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7. Tech / Components

- **Stack:** Next.js App Router, seed JSON, localStorage for tracker overrides (prototype).
- **Plan A:** Claude Code skill + Chrome (logged-in LinkedIn), `scan_boards.py`, CSV tracker.
- **Ranking (shared):** relationship pts + role relevance pts − spam penalty (messaged same company in 7d).
- **Must-avoid:** Sending messages on user's behalf; >3 people/company/week; >8 LinkedIn searches per job.

## 8. Open Questions

- Where does `scan_boards.py` live long-term (`~/warm-apply/` vs repo `scripts/`)?
- Cache `linkedin_id` per company in `companies.json` — who maintains when company rebrands?
- After 2-week experiment: threshold to invest in Plan B (e.g. ≥3 chats from outreach)?
