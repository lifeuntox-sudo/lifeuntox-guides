# Lifeuntox Guide Library — Claude Code prompt and setup steps

Two parts. Part A is what you do. Part B is what you paste into Claude Code.

---

# PART A — Your step-by-step

## Before you open Claude Code (about 30 minutes)

1. **Beehiiv.** In Settings → API, create an API key and copy it. Note your publication ID: `pub_eac758c9-e192-4ffb-9d62-bc2d87fe289b`. Then go to Audience → Subscribe forms, create an embedded form called "Guide gate", and copy its form action URL (the URL in the `<form action="…">` of the embed code). In Audience → Custom fields, create two text fields: `phone` and `sms_consent`.
2. **Kie.ai.** Log in, create an API key, and note where their API documentation lives. Claude Code will read the docs itself.
3. **GitHub.** Create an empty private repo called `lifeuntox-guides`. Do not add a README or anything else.
4. **Netlify.** Make sure you can log in. Nothing to create yet.
5. **Install Claude Code** if you have not already (claude.ai/download or the terminal install). Sign in.

## Set up the folder (5 minutes)

6. Make a folder called `lifeuntox-guides` on your machine.
7. Put these files in it, at the top level:
   - everything from `lifeuntox-guides-site.zip` (keep the `netlify/functions` subfolder as it is)
   - `Lifeuntox-Brand-Book.html`
   - `Lifeuntox_Clean_Meat_Directory.pdf`
   - the Dr. Berg screenshot, saved as `dr-berg-guides-reference.png`
   - this file, saved as `PROMPT.md`
8. Create a file called `.env` in the folder with these lines (paste your real values):
   ```
   BEEHIIV_API_KEY=
   BEEHIIV_PUB_ID=pub_eac758c9-e192-4ffb-9d62-bc2d87fe289b
   BEEHIIV_FORM_ACTION=
   KIE_API_KEY=
   ```
   Claude Code will make sure this file is never committed.

## Run it (Claude Code does the work; you approve at five checkpoints)

9. Open a terminal in the folder and start Claude Code. Paste all of Part B.
10. **Checkpoint 1 — structure.** It will refactor and rebuild the two pages. Open `site/index.html` and `site/guide-clean-meat-directory.html` in your browser next to the mockups. They must look identical. Test the search ("Bluffton", "cookwear", "PANS") and the gate. Only then say "continue".
11. **Checkpoint 2 — Beehiiv.** It wires the gate and phone function. Ask it to run a test submit with your own email and confirm you appear in Beehiiv with the phone custom field filled.
12. **Checkpoint 3 — covers.** It builds the Kie.ai script and generates three covers for the chicken guide. Pick one. If the style is off, describe the change in plain words ("less shadow", "warmer green", "smaller badge") and let it regenerate.
13. **Checkpoint 4 — publish workflow.** Ask it to create a test guide with `npm run new-guide`, then delete it, so you have seen the whole loop.
14. **Checkpoint 5 — deploy.** It pushes to GitHub, connects Netlify, sets the env vars, and gives you a preview URL. Open it on your phone.

## After deploy (15 minutes)

15. In Netlify → Domain settings, add `guides.lifeuntox.com`. Add the CNAME record it shows you in your DNS.
16. In your Beehiiv website builder, add "Guides" to the navigation, linking to `https://guides.lifeuntox.com`.
17. From now on, every guide link in a newsletter or a ManyChat DM ends in `?s=1` so subscribers skip the gate. Instagram bio and Google get the plain link.
18. To publish a guide: `npm run new-guide -- "Title" --code WORD --cat Topic`, write the markdown, `npm run cover -- slug`, `npm run build`, push. Or just tell Claude Code to do it in that repo; the `CLAUDE.md` it writes carries the copy rules.

---

# PART B — Paste everything below into Claude Code

## Context

I run Lifeuntox, a science-first non-toxic living media brand: a 72k-subscriber daily newsletter on Beehiiv, 1M+ Instagram followers, a mostly US audience, written in the brand voice and signed "The Lifeuntox Team". We are moving our free lead-magnet guides off Google Docs and PDFs onto our own guide library website, modelled on Dr. Berg's "Guides and Resources" page: a grid of 3D book covers, search, topic filters, sort, pagination, and each guide as a full article page with an email gate. The site is static HTML on Netlify with Netlify Functions for anything that touches an API key.

A working mockup exists and is attached. Do not redesign it. Your job is to turn it into a maintainable repo, wire the live integrations, add a one-command workflow for publishing new guides, encode our article design system so future guides come out consistent, and deploy.

Work in five stages and stop for my approval after each: (1) repo structure with the two existing pages rendering identically, (2) Beehiiv wiring, (3) Kie.ai cover script with three test covers, (4) new-guide workflow, (5) deploy. Read `PROMPT.md` in full before starting.

## Starting files (in this folder)

- `index.html` — the directory page. All search/filter/sort/pagination logic is in the inline `<script>`; the `GUIDES` array at the top is the data.
- `guide-clean-meat-directory.html` — the finished article page: header, email gate, optional phone opt-in, NOTOXCHEF partner placements, more-guides footer. Its structure is canonical.
- `lifeuntox-logo.png` — the wordmark. Both pages embed it as base64; switch to the file.
- `build-index.js` — fills each guide's `text` field for full-text search.
- `netlify/functions/phone-save.js` — saves an opted-in phone number to Beehiiv custom fields, with a server-side E.164 check.
- `Lifeuntox-Brand-Book.html` — brand palette and type.
- `Lifeuntox_Clean_Meat_Directory.pdf` — the source PDF for the example guide, so you can see how a PDF guide becomes an article.
- `dr-berg-guides-reference.png` — the layout we modelled.
- `.env` — my keys. Never commit it.

## Stage 1 — Repo structure

Separate content from layout without changing how anything looks or behaves.

```
/site                      what Netlify publishes
  index.html               built from templates/index.html + guides.json
  guide-<slug>.html        built from templates/guide.html + content/<slug>.md
  assets/lifeuntox-logo.png
  assets/covers/<slug>.png
/templates
  index.html
  guide.html               the article template, extracted from guide-clean-meat-directory.html
/content
  <slug>.md                one file per guide: frontmatter + body
/guides.json               the GUIDES array, one object per guide
/scripts
  build.js                 renders /site from templates + content + guides.json
  build-index.js           adapted to write `text` into guides.json
  new-guide.js             scaffolds a guide (Stage 4)
  make-cover.js            Kie.ai cover generation (Stage 3)
  check-guide.js           lint: readability grade, banned words, structure (see design system)
/netlify/functions/phone-save.js
CLAUDE.md                  the design system below, so guides written in this repo follow it
README.md
netlify.toml
package.json               scripts: build, dev, new-guide, cover, index, check
.env.example  .gitignore
```

Plain HTML/CSS/JS and Node scripts only. No framework, no bundler. Keep each built page self-contained apart from the logo and cover images. Add Open Graph and Twitter meta on every guide page (title, description, cover image) and an `Article` JSON-LD block, because these pages will be shared and indexed.

Search behaviour must survive untouched: typo correction, synonyms, multi-topic OR filters, applied-filter chips, sticky toolbar, screen-reader status announcements, URL state, full-text matching with snippets. If a refactor would change any of it, stop and tell me.

## Stage 2 — Beehiiv

Beehiiv is the only database. Do not add another.

- Gate form posts to `BEEHIIV_FORM_ACTION`. Keep the existing behaviour: unlock immediately on submit, remember on the device, and treat `?s=1` in the URL as already unlocked.
- Phone: `phone-save.js` upserts the subscriber with custom fields `phone` and `sms_consent` ("pending YYYY-MM-DD") via Beehiiv API v2. The fields already exist in Beehiiv. Keep the server-side E.164 check.
- Env: `BEEHIIV_API_KEY`, `BEEHIIV_PUB_ID`, `BEEHIIV_FORM_ACTION`.

## Stage 3 — Covers via Kie.ai (Nano Banana Pro)

Read Kie.ai's API docs first; do not guess the endpoint, model name, or payload. Then write `scripts/make-cover.js <slug>`: build the prompt from the guide's frontmatter, call the API, poll to completion, download to `site/assets/covers/<slug>-1.png`, `-2.png`, `-3.png`, and set `cover` in guides.json to `-1` so I can swap.

Cover brief (the Dr. Berg look in our brand): a photoreal 3D hardback book, standing, turned about 15° to the left, soft studio shadow, plain white background, 1200×1600 PNG. Front cover: the Lifeuntox wordmark small at the top; the title large, uppercase, bold geometric sans; the subtitle beneath in a lighter weight; one clean photographic subject relevant to the topic (chicken guide: a raw free-range bird on a wooden board); if `badge` is set, a small circular leaf-green sticker top-right with the badge text. Palette: deep green, cream, one accent. No other logos, no faces, no text beyond wordmark, title, subtitle, badge. Env: `KIE_API_KEY`.

## Stage 4 — Publish workflow

`npm run new-guide -- "The Tap Water Filter Guide" --code WATER --cat Water` creates `content/tap-water-filter-guide.md` with frontmatter filled and the body scaffolded in the canonical section order (below), adds the entry to `guides.json`, and prints the path. `npm run check -- <slug>` runs the lint. `npm run build` renders everything and runs `build-index.js`. A git push deploys.

## Stage 5 — Deploy

`netlify.toml`: `publish = "site"`, `functions = "netlify/functions"`, `command = "npm run build"`. Push to the GitHub repo I created (`lifeuntox-guides`), connect it in Netlify, set the env vars from `.env`, and give me the preview URL and the CNAME record for `guides.lifeuntox.com`.

Before you finish, verify in the built site: "Bluffton" finds the chicken guide by full text; "cookwear" corrects to cookware; the gate blurs from brand 3 onward and `?s=1` unlocks; `07700 900123` with UK selected saves as `+447700900123`; a US number with a 0 or 1 exchange is rejected; every page passes an HTML validator and has no console errors.

---

## THE LIFEUNTOX GUIDE DESIGN SYSTEM (write this into CLAUDE.md verbatim)

Version 2.0, September 2026. Supersedes the June 2026 docx system. Applies to every guide page on guides.lifeuntox.com.

### 1. Brand

- Name: Lifeuntox (never LifeUntox or Life Untox). Company: Lifeuntox LLC. Year: 2026.
- Tagline: "Your trusted source for non-toxic living".
- Voice: The Lifeuntox Team. Never a named founder, never first-person singular.
- Partner: NOTOXCHEF, our official non-toxic cookware partner. Every guide carries the partner pill in the header and two NOTOXCHEF placements.
- Support: support@lifeuntox.com. Community: The Untox Club, https://www.facebook.com/groups/theuntoxclub.

### 2. Design tokens (already in the CSS; do not change)

Colours: ink #1a1a1a, ink-soft #5f5f5c, ink-mute #8d8a80, forest #1a4a1a, moss #2d5a2d, leaf #7cb342, paper #faf8f3, paper-2 #f5f2ea, line #e2ded1, gold #a8871c, red #8b2c2c.

Colour roles: forest for headings and primary buttons; leaf for confirmations and highlights; red only for genuine warnings; **gold is reserved for commercial content** (partner promo card border, final CTA accent, partner pill hover), so a reader can tell editorial from commercial at a glance. Make that one CSS change in Stage 1: switch the promo card's left border and the closing CTA's button from forest/leaf to gold. Nothing else changes.

Type: League Spartan for everything (300 body, 500 subheads, 600 headings, 800 cover titles). JetBrains Mono nowhere on the page (comment codes are never displayed). Body 18px desktop / 17px mobile, line-height 1.6, measure 680px. H2 26px, H3 20px.

### 3. Article anatomy (canonical order)

Every guide is built from these blocks, in this order. `new-guide` scaffolds them; `check-guide` enforces them.

```
HEADER            cover (3D book, left), H1 title, subtitle, meta line
                  (topic · updated date · read time · By The Lifeuntox Team),
                  partner pill: "Lifeuntox is an official partner of NOTOXCHEF"
:::inside         one-sentence contents box: what the reader gets, in numbers
INTRO             the problem, 3–5 short paragraphs, ends by naming the fix
:::warn           the one thing to look for / avoid (red box)
:::promo          NOTOXCHEF placement 1 (gold card)
FIRST VALUE       the first 2 items of the list, or the first full section
:::gate           email gate; everything after is blurred for cold traffic
REST OF VALUE     remaining items or sections
:::table          quick-reference table where the content has one
:::protocol       "How to check any brand yourself" / action steps, numbered
:::cta            NOTOXCHEF placement 2 (gold, larger)
## Sources        numbered list, every claim above links to one of these
FOOTER            disclosure, education-not-advice line
MORE GUIDES       four related guides, auto-picked by topic
```

Length: 1,200–2,500 words of body copy. Read time is computed at build (words ÷ 220).

Gate position rule: the gate sits after roughly 30% of the value, never before the reader has received something usable. For a list guide that means after item 2. For a protocol guide, after the first full step.

### 4. Components and when to use them

| Block | Use for | Never for |
|---|---|---|
| `:::inside` | The contents-in-numbers box at the top | Selling |
| `:::insight Title` | A finding that changes how the reader sees the topic (soft yellow) | Repeating the intro |
| `:::warn Title` | Something to avoid or check, with the exact words to look for (red) | Fear without a fix |
| `:::checks A \| B \| C` | Verified attributes under a brand/product heading | Marketing claims |
| `:::buy` | Where to buy a listed brand | Affiliate copy |
| `:::promo` | NOTOXCHEF placement 1 | Any other product |
| `:::table` (markdown table) | Quick-reference: store × brand, product × attribute | Long prose |
| `:::protocol` (numbered list) | Steps the reader can do this week | Vague advice |
| `:::cta` | NOTOXCHEF placement 2 | — |

Maximum three coloured blocks per screen. If a page is a wall of boxes, cut boxes.

### 5. Partner placements (the two-placement rule)

Exactly two NOTOXCHEF placements per guide, plus the header pill.

Placement 1, `:::promo`, after the first value block. Moderate. Structure:
- One bridge sentence that connects the guide's problem to cookware honestly (chicken → the pan it is cooked in; water → the kettle; produce → the board).
- One sentence on what NOTOXCHEF sells and the standard it meets.
- A specific product link, not the homepage. Link text names the product: "See the 10-inch skillet".

Placement 2, `:::cta`, at the end. Stronger. Structure:
- Recap line tying the guide's result to the product ("You just chose better chicken. Cook it in a better pan.").
- Two sentences on the product and why it passes the Lifeuntox Standard.
- Real offer or code if one exists. Never invent a sale, never invent urgency.
- Specific product link.
- One-line disclosure: "Lifeuntox earns a commission on partner sales. It never changes what we recommend."

Do not write "who this is for / who this is not for" sections. Do not use fire emojis or ALL-CAPS headers in CTAs. Passion comes from the bridge sentence, not from formatting.

### 6. Editorial voice

Passionate but professional. We are on the reader's side, and we say plainly when an industry puts profit ahead of health. Controlled outrage at the system, warmth toward the reader, and always a fix.

Readability: a 10-year-old can follow it. Target Flesch-Kincaid grade 5–7; `check-guide` warns above 7 and fails above 9. Short sentences. Define every technical term the first time it appears, in the same sentence. One idea per paragraph, four sentences maximum.

Always:
- "We" for the brand, "you" for the reader. Active voice.
- Specific numbers ("108 square feet per bird", not "lots of space").
- Named sources, linked inline, listed under Sources. Only .gov, .edu, peer-reviewed journals, regulatory records, or the brand's own published standards. Never invent a citation or a URL; write `[Add source]` and `check-guide` will flag it.
- Open each section with a sentence that says why it matters.
- End every guide with something the reader can do this week.

Never:
- Em dashes. Use a comma, a full stop, or a colon. `check-guide` fails on any em dash outside code.
- First-person singular. Corporate jargon (leverage, optimise, synergy). Hedging (might, perhaps, could be). Exclamation marks. Staccato fragments for effect. Forced negation ("not uncommon").
- Fear without efficacy. Every warning is followed by what to do.
- Medical claims a reviewer would veto. Guides are education, not advice.
- Displaying the comment code. It is searchable metadata only.

### 7. Frontmatter

```yaml
---
slug: clean-meat-directory
code: CHICKEN            # comment word, searchable, never displayed
title: The Clean Meat Directory
sub: 10 safe chicken brands to buy today
cat: Food                # Water | Kitchen | Home | Personal care | Family | Food
added: 2026-09-11
reads: 0
badge: 10 verified brands
color: "#1a4a1a"         # placeholder book colour until a cover exists
cover: ""                # set by make-cover
keywords: [chicken, meat, poultry, air chilled, chlorine]
desc: One-paragraph excerpt for the card, 25–40 words.
partner_product_1: https://notoxchef.com/...    # placement 1 link
partner_product_2: https://notoxchef.com/...    # placement 2 link
---
```

Slug and file naming: lowercase, hyphens, no dates, e.g. `tap-water-filter-guide`. Page file `guide-<slug>.html`. Cover `assets/covers/<slug>-N.png`.

### 8. Quality checklist (`check-guide` automates the starred items)

Brand: logo present; "Lifeuntox" spelled correctly; partner pill present; footer disclosure present.
Editorial: * no em dashes; * grade ≤ 7; * no first-person singular; * no `[Add source]` left; every claim with a number has a linked source; no hedging or exclamation marks.
Structure: * all canonical blocks present in order; * gate after first value; * exactly two NOTOXCHEF placements; * word count 1,200–2,500; sources list non-empty.
Technical: * every link resolves (HEAD request); OG image set; * no console errors; * HTML validates; page renders on a 375px viewport with nothing overflowing.

---

## Deliverables

A README explaining the folder layout, the five-line publish workflow, the env vars, and the DNS record. `CLAUDE.md` containing the design system above verbatim. A summary of every decision you made on your own. The Netlify preview URL.
