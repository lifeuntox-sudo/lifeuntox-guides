# Lifeuntox guide library

The free guide library at guides.lifeuntox.com: a directory of 3D book covers with search, topic filters, sort and pagination, and one article page per guide with an email gate. Static HTML on Netlify, Netlify Functions for anything that touches an API key, Beehiiv as the only database.

## Quick start

```bash
cp .env.example .env      # fill in the keys
npm run build             # renders site/
npm run dev               # http://localhost:8888 with live rebuild + local functions
```

Run `npm install` once: the only dependency is `@netlify/blobs`, used by the phone opt-in function. Node 20.12 or newer.

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
| `scripts/make-banner.js`, `banners/<campaign>.json` | Generates the partner banner ads (wide for the promo card, cta for the closing block, square for the newsletter) with Kie.ai from a campaign spec, at exact sizes, as JPEGs in `site/assets/banners/` (tracked). |
| `scripts/lib/images.js`, `jpeg.js` | At build, derive a full-size JPEG (header, Open Graph) and a 600px JPEG (grid) from each cover PNG. Gitignored; rebuilt on Netlify. |
| `nav.json` | Header and footer content, copied from the live Beehiiv site. Rendered into both pages at build by `scripts/lib/nav.js` with `templates/nav.css`. |
| `scripts/check-guide.js` | Lint: readability grade, banned words, structure, links. |
| `scripts/dev.js` | Local static server with rebuild-on-change and `/.netlify/functions/*` routed to the function handlers. |
| `netlify/functions/subscribe.mjs` | The email gate, the directory strip and the footer box post here. `{email, slug}` subscribes via Beehiiv API v2 (`utm_source=guides`, `utm_campaign=<slug>`); `{email, check:true}` answers whether the address is an active subscriber ("Already a subscriber?"). Rate limited: 10 requests per minute per IP. |
| `netlify/functions/phone-save.mjs` | Saves an opted-in phone number to Beehiiv custom fields (`phone`, `sms_consent`) with a server-side E.164 check. One number per subscriber: a number already held by another email is refused. Rate limited: 5 requests per minute per IP. |
| `netlify/functions/lib/phones.js` | The phone → email index in Netlify Blobs (store `phones`) that answers "who holds this number?", which the Beehiiv API cannot. Derived from Beehiiv; rebuild with `npm run phone-index`. Falls back to a local JSON file under `.netlify/` in `npm run dev`. |
| `netlify/functions/lib/beehiiv.js` | Shared helper: API call, JSON responses, same-origin check. Not a function itself. |
| `mockup/` | The original hand-built mockup, kept for reference. Safe to delete once the built pages are approved. |
| `PROMPT.md` | The original brief and setup steps this repo was built from. |
| `DECISIONS.md` | Every call made without asking during the build, per stage. |

## Environment

| Variable | Used by |
|---|---|
| `BEEHIIV_API_KEY`, `BEEHIIV_PUB_ID` | `netlify/functions/subscribe.mjs` and `phone-save.mjs` |
| `BEEHIIV_FORM_ACTION` (optional) | An https URL to post gate emails to instead of the subscribe function. Leave empty to use the function. |
| `BEEHIIV_PHONE_FIELD`, `BEEHIIV_SMS_CONSENT_FIELD` (optional) | Custom field names phone-save writes to. Defaults `phone`, `sms_consent`. |
| `KIE_API_KEY` | `scripts/make-cover.js`, `scripts/make-banner.js` |
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

`beehiiv/free-guides-block.html` is the self-contained "Free guides" block for the lifeuntox.com homepage (a Beehiiv custom HTML section). It fetches `/guides.json`, shows the four newest guides with covers, and links to the library. It is the source of truth for the block: paste the whole file into Beehiiv whenever it changes. It starts with `<base target="_top">` so links navigate the page, not Beehiiv's srcdoc iframe.

## Partner banners

`npm run banner -- thaw-max` reads `banners/thaw-max.json` (product, prices, offer lines, a reference photo URL) and asks Kie.ai for two options of each format: `wide` (1600×686, the `:::promo` card), `cta` (1600×900, the `:::cta` block) and `square` (1200×1200, newsletter and social). A guide shows one with a line holding only `![alt](assets/banners/thaw-max-wide-1.jpg)` inside the block; the image links to the block's button URL. Prices live in the images and in the placement copy, so a price change means a regenerate plus two sentences per guide. `PARTNER_PLACEMENTS` in `scripts/lib/config.js` switches every placement (lockup, promo, CTA) on or off.

## Security

- **Rate limits:** `subscribe` 10/min per IP, `phone-save` 5/min per IP, enforced in the function (`lib/ratelimit.js`, state in Netlify Blobs) and also declared as Netlify edge rules in each function's config. Over the limit returns 429 with Retry-After and the page shows its "try again in a moment" message. The Free plan allows two edge rules, which is why the subscriber check lives inside `subscribe`.
- **Headers** (generated into `site/_headers` by the build from `templates/_headers`): a Content Security Policy that allows scripts only from this site plus the exact sha256 hashes of our own inline scripts, styles from this site and Google Fonts, images from this site, connections to this site only, no framing (`frame-ancestors 'none'`), no plugins, forms only to this site; plus `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`. Netlify adds HSTS and forces HTTPS.
- **Functions:** JSON bodies capped at 4 KB, every field validated server-side (email shape and length, E.164 phone, +1 area/exchange rules), same-origin check on browser requests, generic error codes with no stack traces, `Cache-Control: no-store` on responses. The Beehiiv key never leaves the server.
- **Honeypot:** every form carries a hidden `website` field. If a bot fills it, the function answers "ok" and does nothing.
- **Secrets:** `.env` is gitignored; keys live only in Netlify's environment (marked secret).
- Dependencies: one (`@netlify/blobs`), `npm audit` clean.

## Gate behaviour

The article unlocks when any of these is true: the visitor unlocked before on this device (`localStorage`), the URL carries `?s=1` (use this on every newsletter and DM link), or the visitor submits the gate form. "Already a subscriber?" switches the form to a check against Beehiiv and unlocks only for an active subscription. The form unlocks immediately and posts the email in the background to `/.netlify/functions/subscribe`, which creates the subscriber through the Beehiiv API (double opt-in follows the publication setting). Then the optional phone step (occasional marketing texts, opt-in) appears and posts to `/.netlify/functions/phone-save`.

Why a function and not the Beehiiv embed: Beehiiv's current subscribe forms render inside an iframe with a bot challenge, so there is no form action URL a static page can post to. The API key stays on the server; the browser only ever talks to the site's own functions.
