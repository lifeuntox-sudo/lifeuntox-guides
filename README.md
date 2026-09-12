# Lifeuntox guide library

The free guide library at guides.lifeuntox.com: a directory of 3D book covers with search, topic filters, sort and pagination, and one article page per guide with an email gate. Static HTML on Netlify, Netlify Functions for anything that touches an API key, Beehiiv as the only database.

## Quick start

```bash
cp .env.example .env      # fill in the keys
npm run build             # renders site/
npm run dev               # http://localhost:8888 with live rebuild + local functions
```

No `npm install` is needed: there are no dependencies. Node 20.12 or newer.

## Publishing a guide

```bash
npm run new-guide -- "The Tap Water Filter Guide" --code WATER --cat Water --tags "hormones, pregnancy, kids"
#   → content/tap-water-filter-guide.md scaffolded, entry added to guides.json
#   tags = health and life topics beyond the category; required, searchable, never shown
#   write the guide in content/tap-water-filter-guide.md
npm run check -- tap-water-filter-guide     # lint against the design system
npm run cover -- tap-water-filter-guide     # 3 cover options via Kie.ai, -1 is selected
npm run build                               # render + full-text index
git push                                    # Netlify builds and deploys
```

The design system every guide follows, plus the Markdown block syntax, lives in [CLAUDE.md](CLAUDE.md).

`new-guide` fills the frontmatter, scaffolds every canonical block with `<!-- TODO -->` notes, and reuses the guides.json entry if the slug already has a placeholder card (its read count and excerpt are kept). `check` prints FAIL lines (blocking: exit code 1) and WARN lines (judgement calls) with line numbers; it also HEAD-requests every link and validates the built HTML with the W3C validator. Use `--no-net` offline and `--all` for every guide.

## Layout

| Path | What it is |
|---|---|
| `site/` | What Netlify publishes. `index.html` and `guide-*.html` are built (gitignored). `assets/` is source. |
| `templates/index.html` | The directory page. All search/filter/sort/pagination logic is in its inline script. `{{GUIDES}}` is injected at build. |
| `templates/guide.html` | The article page. Header, gate, phone opt-in, share row, more-guides footer. |
| `content/<slug>.md` | One guide: YAML frontmatter + body using `:::` blocks. |
| `guides.json` | Directory data, one object per guide, in display order. `text` is written by build-index. |
| `scripts/build.js` | Renders everything: guide pages, then the full-text index, then the directory. |
| `scripts/build-index.js` | Fills each guide's `text` from its built page for full-text search and snippets. |
| `scripts/new-guide.js` | Scaffolds a guide in the canonical section order. |
| `scripts/make-cover.js` | Generates three cover options with Kie.ai and sets `cover`. |
| `scripts/lib/images.js`, `jpeg.js` | At build, derive a full-size JPEG (header, Open Graph) and a 600px JPEG (grid) from each cover PNG. Gitignored; rebuilt on Netlify. |
| `nav.json` | Header and footer content, copied from the live Beehiiv site. Rendered into both pages at build by `scripts/lib/nav.js` with `templates/nav.css`. |
| `scripts/check-guide.js` | Lint: readability grade, banned words, structure, links. |
| `scripts/dev.js` | Local static server with rebuild-on-change and `/.netlify/functions/*` routed to the function handlers. |
| `netlify/functions/subscribe.js` | The email gate posts here. Subscribes the email via Beehiiv API v2 with `utm_source=guides`, `utm_campaign=<slug>`. |
| `netlify/functions/check-subscriber.js` | "Already a subscriber?" posts here; unlocks only if the email is an active Beehiiv subscription. |
| `netlify/functions/phone-save.js` | Saves an opted-in phone number to Beehiiv custom fields (`phone`, `sms_consent`) with a server-side E.164 check. |
| `netlify/functions/lib/beehiiv.js` | Shared helper: API call, JSON responses, same-origin check. Not a function itself. |
| `mockup/` | The original hand-built mockup, kept for reference. Safe to delete once the built pages are approved. |
| `PROMPT.md` | The original brief and setup steps this repo was built from. |
| `DECISIONS.md` | Every call made without asking during the build, per stage. |

## Environment

| Variable | Used by |
|---|---|
| `BEEHIIV_API_KEY`, `BEEHIIV_PUB_ID` | `netlify/functions/subscribe.js` and `phone-save.js` |
| `BEEHIIV_FORM_ACTION` (optional) | An https URL to post gate emails to instead of the subscribe function. Leave empty to use the function. |
| `BEEHIIV_PHONE_FIELD`, `BEEHIIV_SMS_CONSENT_FIELD` (optional) | Custom field names phone-save writes to. Defaults `phone`, `sms_consent`. |
| `KIE_API_KEY` | `scripts/make-cover.js` |
| `SITE_URL` (optional) | Canonical / Open Graph / JSON-LD URLs. Netlify's own `URL` is used when unset. |

Set the same variables in Netlify → Site configuration → Environment variables. On Netlify only `BEEHIIV_API_KEY`, `BEEHIIV_PUB_ID` and `SITE_URL` are needed: covers are generated on your machine, so `KIE_API_KEY` stays local.

## Hosting and DNS

- Netlify site: `lifeuntox-guides` (team `lifeuntox`), https://lifeuntox-guides.netlify.app. Admin: https://app.netlify.com/projects/lifeuntox-guides
- Every push to `main` on GitHub (`lifeuntox-sudo/lifeuntox-guides`) triggers `npm run build` and a deploy, once the repository is linked under Site configuration → Build & deploy → Continuous deployment.
- Custom domain `guides.lifeuntox.com`: add it under Domain management, then create this DNS record at your DNS provider:

| Type | Name | Value |
|---|---|---|
| CNAME | `guides` | `lifeuntox-guides.netlify.app` |

Netlify issues the HTTPS certificate automatically once the record resolves (usually within an hour). Until then the site is reachable at the netlify.app address.

## How a page is built

1. `content/<slug>.md` is parsed: frontmatter → page data, body → HTML via `scripts/lib/markdown.js` (a small purpose-built renderer for the `:::` blocks; no dependency).
2. The body is split at `:::gate`. Everything before it is visible; everything after sits inside the blurred, gated wrapper.
3. `templates/guide.html` placeholders are filled: title, deck, topic, updated date, read time (words ÷ 220), cover (3D CSS book until a cover image exists), Open Graph and Twitter meta, Article JSON-LD, the four "More free guides", the Beehiiv form action.
4. `build-index.js` extracts the article text from the built page (minus the gate form chrome) into `guides.json` → `text`.
5. `templates/index.html` gets `guides.json` injected as the `GUIDES` array, plus a `page` flag per guide so cards only link to pages that exist.

Frontmatter is the source of truth for a guide's editorial fields and is synced into `guides.json` on each build. `reads` and `text` live only in `guides.json`.

## Covers

```bash
npm run cover -- <slug>                       # 3 options at 2K, resized to 1200×1600
npm run cover -- <slug> --note "less shadow, warmer green"
npm run cover -- <slug> --dry-run             # print the prompt only
```

The prompt is built from the guide's frontmatter (`title`, `sub`, `badge`, `cover_subject`, optional `cover_note`) and the brand cover brief: a photoreal 3D hardback, turned about 15° left, white studio background, Lifeuntox wordmark (sent as a reference image), title in bold geometric sans, subtitle, one photographic subject, leaf-green badge sticker. Two reference images go with every request: the wordmark, and `templates/cover-reference.png`, the approved house-style cover that new covers must match. To change the house style, replace that file. Output goes to `site/assets/covers/<slug>-1.png`, `-2.png`, `-3.png`; `cover` is set to `-1` in both the frontmatter and `guides.json`. Change it to `-2` or `-3` to swap, then `npm run build`. Each 2K image costs 18 Kie.ai credits.

## Public data feed

`npm run build` copies `guides.json` into `site/`, so the directory data is available at https://guides.lifeuntox.com/guides.json with `Access-Control-Allow-Origin: *` and a five-minute cache (set in `site/_headers`). Each object carries `slug, code, title, sub, desc, cat, added, reads, cover, color, badge, keywords, tags` and, once the guide page exists, `text`. Build the page URL as `https://guides.lifeuntox.com/guide-<slug>.html`; `cover` is the PNG path, and `<cover minus .png>.jpg` / `-600.jpg` are the lighter JPEG versions.

## Embeds

`embeds/beehiiv-free-guides.html` is a self-contained block for a Beehiiv custom HTML section: it fetches `/guides.json`, shows the four newest guides with covers, and links to the library. Paste the whole file into the block.

## Gate behaviour

The article unlocks when any of these is true: the visitor unlocked before on this device (`localStorage`), the URL carries `?s=1` (use this on every newsletter and DM link), or the visitor submits the gate form. "Already a subscriber?" switches the form to a check against Beehiiv and unlocks only for an active subscription. The form unlocks immediately and posts the email in the background to `/.netlify/functions/subscribe`, which creates the subscriber through the Beehiiv API (double opt-in follows the publication setting). Then the optional phone step (occasional marketing texts, opt-in) appears and posts to `/.netlify/functions/phone-save`.

Why a function and not the Beehiiv embed: Beehiiv's current subscribe forms render inside an iframe with a bot challenge, so there is no form action URL a static page can post to. The API key stays on the server; the browser only ever talks to the site's own functions.
