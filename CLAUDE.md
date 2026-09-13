# Lifeuntox guide library

This repo builds guides.lifeuntox.com: a static guide library (directory page + one article page per guide) rendered by `npm run build` from `templates/`, `content/*.md` and `guides.json`, published on Netlify. Plain HTML, CSS and Node scripts only. No framework, no bundler, no dependencies.

Every guide written in this repo follows the design system below. `scripts/new-guide.js` scaffolds it, `scripts/check-guide.js` enforces the starred items.

---

## THE LIFEUNTOX GUIDE DESIGN SYSTEM

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

## Repo notes (how the design system is implemented here)

### Layout

```
site/                 what Netlify publishes (built HTML is gitignored; assets are tracked)
templates/index.html  directory page; {{GUIDES}} is replaced with guides.json at build
nav.json              header + footer content, copied from the live Beehiiv site (source of truth)
templates/nav.css     header + footer styles, measured from lifeuntox.com; injected as {{NAV_CSS}}
scripts/lib/nav.js    renders {{HEADER}} and {{FOOTER}} from nav.json
templates/guide.html  article page; {{PLACEHOLDERS}} filled from frontmatter + rendered body
content/<slug>.md     one guide: frontmatter + body in the ::: block syntax above
guides.json           the directory data (one object per guide, display order)
scripts/build.js      renders site/ (guides → build-index → index)
scripts/build-index.js fills each guide's `text` (full-text search) from its built page
scripts/lib/images.js + jpeg.js  derive <cover>.jpg and <cover>-600.jpg from each cover PNG at build (gitignored)
scripts/new-guide.js  scaffold a guide      npm run new-guide -- "Title" --code WORD --cat Topic
scripts/make-cover.js Kie.ai covers         npm run cover -- <slug>
templates/cover-reference.png  the approved house-style cover; make-cover sends it as a reference on every run
scripts/check-guide.js lint                 npm run check -- <slug>
site/assets/partner-notoxchef.png  the NOTOXCHEF × Lifeuntox lockup shown in every guide header (replaces the text pill)
scripts/dev.js        local preview with functions   npm run dev  → http://localhost:8888
netlify/functions/    subscribe.js (the gate and the directory box post here → Beehiiv API v2)
                      check-subscriber.js ("Already a subscriber?" → looks the email up, unlocks only if active)
                      phone-save.js (Beehiiv custom fields, server-side E.164 check)
                      lib/beehiiv.js (shared helper, not a function)
```

### Markdown conventions the renderer expects

- Blocks open with `:::name` (optionally `:::name Title`) on their own line and close with `:::`. `:::checks A | B | C` and `:::gate Title` are single lines with no closer.
- `:::gate Title` sets the gate heading ("Get the other 8 brands, free"). Everything after it is behind the gate.
- In `:::promo` and `:::cta`, a final standalone line `[Button text](https://notoxchef.com/product)` becomes the button. If omitted, the button links to `partner_product_1` / `partner_product_2` from the frontmatter.
- `:::table` wraps a normal Markdown pipe table. `:::protocol` wraps a paragraph plus a numbered list.
- A list directly under `## Sources` gets the sources styling automatically.
- Inline: `**bold**`, `*em*`, `[text](url)`. External links get `rel="noopener"` automatically. No raw inline HTML; a line starting with a tag is passed through as a raw block.
- `&` is escaped for you: write `Bell & Evans`.

### Required frontmatter field beyond section 7: `tags`

`tags: [sleep, menopause, gut health]`: three or more health and life topics the guide touches that are not its product category. They feed the directory search (a reader typing "sleep" finds every guide tagged sleep, whatever its category) and pick the "More free guides" (shared tags first). Never displayed. `new-guide` scaffolds the field, `check-guide` fails when it is empty.

### Optional frontmatter fields (beyond section 7)

| Field | Purpose | Default |
|---|---|---|
| `deck` | The longer subtitle under the H1 | `sub` |
| `updated` | Date shown as "Updated" and as `dateModified` | `added` |
| `related` | Four slugs for "More free guides" | same topic by reads, then most-read |
| `disclosure` | The fine-print line at the end of the article | standard education-not-advice line |
| `cover_subject` | The one photographic subject make-cover puts on the cover ("a raw free-range whole chicken on a wooden board") | a generic subject for the topic |
| `cover_note` | Extra direction for make-cover ("less shadow, warmer green") | none |

### Data precedence

For a guide with a content file, its frontmatter is the source of truth for the editorial fields (`code, title, sub, cat, added, badge, color, cover, keywords, tags, desc`) and build copies them into guides.json. `reads` and `text` live only in guides.json (never edit `text` by hand; build-index writes it). Guides listed in guides.json without a content file still appear as cards on the directory page, linking nowhere until their page exists.

### Header and footer

Both pages get their header and footer from `nav.json` at build time (`{{HEADER}}`, `{{FOOTER}}`, `{{NAV_CSS}}`). The content and styling copy the live Beehiiv site, lifeuntox.com, so moving between the two feels like one site. When the Beehiiv header or footer changes, update `nav.json` (and `templates/nav.css` if the look changed) and rebuild. Never the other way round. The item with `"current": true` gets `aria-current="page"`. Links to other hosts get `rel="noopener"`; nothing gets `target="_blank"`.

### Sponsor placements switch

`PARTNER_PLACEMENTS` in `scripts/lib/config.js` is currently **false**: the build leaves out the NOTOXCHEF header lockup, the `:::promo` card, the `:::cta` block and the Partners footer column. Guides still carry `:::promo` and `:::cta` in Markdown (the design system and `check-guide` still require them) so everything returns with one change: set it to true and rebuild. While it is off, `check-guide` fails if "NOTOXCHEF" appears on a built page.

### Rules for working in this repo

- Never commit `.env`. Anything that touches an API key runs in `netlify/functions/`.
- Do not change the design tokens or the page layout. The mockup's look is canonical.
- Search behaviour on the directory page (typo correction, synonyms, multi-topic OR filters, chips, sticky toolbar, live region, URL state, full-text snippets) lives in `templates/index.html` and must not be altered by a refactor.
- Beehiiv is the only database. The one derived store is the phone → email index in Netlify Blobs (`netlify/functions/lib/phones.js`), which exists only because Beehiiv cannot look a subscriber up by phone; it can be rebuilt from Beehiiv at any time with `npm run phone-index`.
