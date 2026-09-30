# {{PROJECT_NAME}} — Handoff

> **How a new AI uses this file.** Open a fresh chat and paste:
>
> *Read `HANDOFF.md` first. Follow the reading order in § 3. Then do the Next session pickup — do not rebuild anything already shipped.*

> **Snapshot date:** YYYY-MM-DD (session N — <one-line of what just landed>)
> **Next session pickup:** <one sentence, present tense — the next concrete action, a spec ID or file path>

> This is the living state snapshot. A fresh agent (or you, next week) reads it
> first and re-orients in five minutes instead of re-deriving state. **Sections
> 1–3, 6, 11, 12 are contracts — they rarely move. Sections 4, 5, 8 are state —
> updated every wrap.**

---

## 1. What this is (60 seconds)

**{{PROJECT_NAME}}** — <one line>.

- **Product:** <what it does, the primary deliverable>.
- **Stack:** Next.js (App Router) · React · TypeScript · Tailwind · shadcn/ui · look in `DESIGN.md` · Vercel · seed JSON in `data/` + localStorage · <APIs, if any> · OpenAI and Neon come later.
- **Architectural rule (load-bearing):** Records live in `data/<object>.json` (seed) and localStorage (user-created). Field names stay stable when Neon is added later. Do not invent a second store or rename fields.

## 2. Non-negotiable rules

These three files are the rails. Do not add extra `.mdc` files, Playwright, or CI unless the student asks. Do not lower the `lib/` coverage floor.

| File | Enforces |
|---|---|
| `.cursor/rules/workshop.mdc` | Stack, seed-JSON-first data, secrets stay in `.env`, server-side API calls, product rules in `lib/`, build only what `PRD.md` asks |
| `PRD.md` | Scope contract — P0s, non-goals, acceptance criteria |
| `DESIGN.md` | Look & feel — theme tokens in `app/globals.css`; do not invent a new palette |

## 3. Reading order for a fresh agent

1. This file.
2. `.cursor/rules/workshop.mdc` — the course rails.
3. `PRD.md` — the product contract (especially § 4 must-haves and non-goals).
4. `DESIGN.md` — the chosen look.
5. `specs/README.md` — what has shipped vs. what is next (once specs exist).
6. `data/<object>.json` — the record shape. Do not change field names.

## 4. Current state of the work — *updated each wrap*

- Specs: <N shipped · N building · N planned>.
- <Shipped list — one line each, or pointer to `specs/README.md`>
- **Recent audit (YYYY-MM-DD):** `npm test` red/green, then walk the P0s in `PRD.md` § 4 in the browser (or on the live URL). One paragraph: what still works, what is still fake or missing. Replace each snapshot; don't append.

## 5. What's active / what's next — *updated each wrap*

- **The long pole:** <current main thread of work>.
- **Queue after it:** <next 1–3 things>.

## 6. Key file locations

- Rails: `.cursor/rules/workshop.mdc`  ·  Product: `PRD.md`  ·  Look: `DESIGN.md`
- Specs: `specs/` (once the first P0 is on screen)
- Seed data: `data/<object>.json`
- Pages: `app/…/page.tsx`  ·  Actions: `app/actions/`  ·  UI: `components/`  ·  Helpers: `lib/`
- Do not use `src/`.

## 7. Architecture notes (don't change without understanding)

- <product-specific don't — e.g. no modal for the main action>
- A missing database must not crash the build. If `DATABASE_URL` / `POSTGRES_URL` are unset, keep using seed JSON + localStorage.

## 8. Open external actions (only the human can do these)

- [ ] GitHub repo + Vercel deploy
- [ ] <API key or config in local `.env` *and* the Vercel project>
- [ ] Neon (optional — only if they still want shared persistence)

## 9. Things that are easy to get wrong (append-only, one line each)

- Writing new records to a JSON file on the server looks fine locally and goes empty on Vercel — use localStorage until Neon exists.
- Calling a third-party API from a client component hits CORS and leaks the habit we need for OpenAI — keep every third-party call in a Server Action.
- When OpenAI is added: only `OPENAI_API_KEY` in `.env`; hardcode model `gpt-4o-mini` in `lib/openai.ts` — do not put the model in env.
- A missing `DATABASE_URL` at build time will take down the first page if anyone adds a database import too early — never throw when the env var is absent.
- Product rules that live only in a page or `useEffect` skip the coverage floor — put them in `lib/`.

## 10. Operating commands

Quality check after each change: `npm test` (Vitest, `lib/` coverage floor) then `npm run build`. Walk the P0s in `PRD.md` § 4 in the browser.

```bash
npm run dev      # start the local app
npm test         # Vitest + lib/ coverage floor — part of the quality gate
npm run build    # production build (dev stopped first) — part of the quality gate
npm run lint     # lint
```

## 11. Source-of-truth precedence (when two artifacts disagree)

1. `.cursor/rules/workshop.mdc`
2. `PRD.md`
3. The relevant spec
4. The code
5. **This handoff** — *last*. If it contradicts anything above, the handoff is wrong; fix it to match the higher source.

## 12. The human, in brief

- Business / MBA student, not an engineer. Prefer a short plan, then a small change, then a check that the page still loads.
- Ask before adding pages, libraries, auth, a database, Playwright, or CI. Do not lower the `lib/` coverage floor.
- Never commit `.env`. Never put a key in client code.

## 13. Change log

| Date | Change |
|---|---|
| YYYY-MM-DD | Handoff created. |
