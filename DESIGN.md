# Warm Route

Editorial and calm, after Squarespace's Beacon template: white canvas, black ink, a light serif for headlines, and a few muted accents. Space and type do the work, not shadows or gradients. Dark mode is a header toggle and inverts to a black canvas.

## Type
- Headings (`h1`–`h3`): Crimson Pro Light (300), tight tracking (-0.035em), line-height 1.05
  - Page titles `text-5xl sm:text-6xl`, job title `text-4xl sm:text-5xl`, section headings `text-3xl`, list item titles `text-2xl`
- Body and UI: Inter, slight negative tracking
- Scores and counts: JetBrains Mono
- Wordmark: "Warm Route" in Crimson Pro Light

## Colors
- Background / cards: `#FFFFFF` (dark `#000000` / `#0D0D0D`)
- Text: `#000000`, muted `#5C5C5C`
- Border: `#E4E4DF` hairline
- Primary (buttons, avatars): black `#000000` (dark: white)
- Secondary: dusty blue `#B3C3CF` for the hero band
- Accent: chartreuse `#ECEC8A` for tier chips
- Success `#2F6B3F` · Warning (rust) `#8D4F2F` · Danger `#B3261E`

## Shape
- Buttons: pill (`rounded-full`), solid black for primary, hairline outline for secondary
- Cards: `rounded-2xl`, hairline border, no shadow; hover darkens the border
- Filter pills: outline, solid black when active
- Nav: wordmark left, plain text links with an underline on the active page, black pill "Scan now" on the right
- Page width `max-w-5xl`, generous vertical rhythm (`py-12 sm:py-16`)

Tokens live in `app/globals.css` `:root` and `.dark`; `.bg-brand` is solid primary ink.
