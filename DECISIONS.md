# Decisions made without asking

A running log of every call made on my own while building this repo, per stage, so nothing is hidden. Each one is reversible.

## Stage 1: repo structure

1. **Mockup files moved to `mockup/`.** The originals (index.html, guide page, build-index.js, logo, zip) are kept for reference and diffing rather than deleted. Safe to remove after approval.
2. **No dependencies at all.** The Markdown renderer for the `:::` blocks is a small purpose-built module (`scripts/lib/markdown.js`) rather than a library, so the output matches the mockup byte for byte and nothing needs `npm install`. Same for the YAML frontmatter parser.
3. **Frontmatter wins over guides.json for editorial fields.** Both files describe a guide, so one had to be the source of truth. For any guide with a content file, build copies `code, title, sub, cat, added, badge, color, cover, keywords, desc` from frontmatter into guides.json. `reads` and `text` live only in guides.json.
4. **Gate title comes from `:::gate Title`.** The mockup's gate heading ("Get the other 8 brands, free") is guide-specific, so the gate marker takes an optional title, matching the `:::warn Title` convention. Default: "Get the rest of this guide, free".
5. **Four optional frontmatter fields** beyond section 7 of the design system: `deck` (the longer subtitle under the H1, which the mockup had), `updated`, `related` (override the four "More free guides"), `disclosure` (the fine-print line). All have defaults; none is required.
6. **Promo and CTA buttons.** A final standalone `[label](url)` line inside `:::promo` or `:::cta` becomes the button. Without one, the button links to `partner_product_1` / `partner_product_2`.
7. **Read time is computed** (words ÷ 220) as the design system says, so the page shows 6 min where the mockup said 7.
8. **Page `<title>` and meta description derive from frontmatter** (`title: sub · Lifeuntox` and `desc`). The mockup had hand-written variants; keeping separate SEO fields would have added two more frontmatter keys for little gain.
9. **Share links wired** (copy link, mailto, Facebook sharer) and footer Explore links point at `?topic=…`. They were `#` placeholders in the mockup, and the Stage 5 checklist requires every link to resolve.
10. **Full-text index excludes the gate and phone form text**, so a search for "email" does not match every guide. The original build-index included it.
11. **JetBrains Mono not loaded on guide pages.** The design system bans it there and the guide CSS never used it. The directory page keeps it for the "Most commented words" buttons, which the design system does not cover.
12. **CSS additions with no visible effect today:** `.book img` and `.more .mini img` (so a real cover replaces the CSS book once one exists), `.book.light` for the light placeholder colours, `.insight` (the design system's soft-yellow block, which the mockup had no style for), and `--c` on the header book so it uses the guide's placeholder colour. The CTA button hover is a darker gold (`#b9961f`) instead of the old leaf hover.
13. **`BEEHIIV_FORM_ACTION` is only injected when it is an https URL.** The value in .env is the Beehiiv embed `<script>` snippet, which would have put a literal `</script>` inside the page. The build warns and leaves the endpoint empty until Stage 2 resolves it.
14. **`SITE_URL` resolution:** `SITE_URL` env, else Netlify's `DEPLOY_PRIME_URL`, else `URL`, else `https://guides.lifeuntox.com`. Used for canonical, Open Graph and JSON-LD.
15. **OG image falls back to the logo** until a cover exists.
16. **`site/*.html` is gitignored** (Netlify builds them); `site/assets/` is tracked because covers are source.
17. **`scripts/dev.js`** serves `site/` and runs the Netlify functions locally so the phone opt-in can be tested without the Netlify CLI, which is not installed.
18. **Node 22 pinned in netlify.toml** so `fetch` and `process.loadEnvFile` exist in functions and scripts.
19. **Directory page also gets Open Graph meta** (the brief asked for guide pages; the directory will be shared too).

## Stage 2: Beehiiv

1. **The gate posts to a Netlify function, not to `BEEHIIV_FORM_ACTION`.** The brief assumed the Beehiiv embed exposes a `<form action>` URL. The current (v3) subscribe form is an iframe that loads `subscribe-forms.beehiiv.com` and runs a bot challenge inside it, so nothing a static page can post to exists. `netlify/functions/subscribe.js` calls the Beehiiv API v2 subscriptions endpoint with the server-side key instead. Beehiiv stays the only database. `BEEHIIV_FORM_ACTION` is still honoured if it ever holds a real https URL.
2. **Gate signups are tagged** `utm_source=guides`, `utm_medium=gate`, `utm_campaign=<slug>`, and `referring_site` from the request, so Beehiiv shows which guide each subscriber came from. Phone opt-ins use `utm_medium=sms-optin` on the upsert.
3. **Unlock before the request, not after.** The mockup awaited the form post before unlocking; now the page unlocks at once and the subscribe call runs in the background, which is what "unlock immediately on submit" asks for.
4. **`send_welcome_email: true` on gate signups, `reactivate_existing: false`.** A gate signup is a normal new subscriber. The phone step keeps `reactivate_existing: true` and no welcome email, as in the mockup.
5. **Same-origin check on both functions.** Browser requests must carry the site's own Origin (or localhost); requests without an Origin header pass. Cheap protection against other sites using the endpoint from a browser.
6. **Custom field names are configurable** (`BEEHIIV_PHONE_FIELD`, `BEEHIIV_SMS_CONSENT_FIELD`) because the fields named in the brief did not exist in the publication when checked.
7. **Shared helper in `netlify/functions/lib/`** so both functions use one API call path and one JSON response shape. A folder without an `index.js` is not deployed as a function.
8. **phone-save reads the record back before reporting success.** Beehiiv silently drops custom fields that do not exist and still answers 200, so the function now fetches the subscription with its custom fields and returns `field_missing` (HTTP 502) if either value is absent. The page then shows its "could not save" message instead of a false "Saved".
9. **Custom fields `phone` and `sms_consent` were created via the API** (with your approval) rather than reusing the older `phone_number` field, so SMS opt-in data has its own fields as the brief specified.

## Stage 3: covers

1. **Endpoint, model and payload taken from docs.kie.ai, not guessed:** `POST /api/v1/jobs/createTask` with model `nano-banana-pro` and `input.{prompt, image_input, aspect_ratio, resolution, output_format}`; polling via `GET /api/v1/jobs/recordInfo?taskId=`. The docs recommend a callback URL for production; polling is used because the script runs on your machine, not on a server.
2. **The real wordmark is passed as a reference image.** The logo PNG is uploaded to Kie.ai's temporary file store (base64 upload, deleted after about a day) and sent as `image_input`, with the prompt told to reproduce it faithfully. Without this the model would invent a logo. `--no-logo` skips it.
3. **Generated at 2K and resized to exactly 1200×1600.** Nano Banana Pro returns 1792×2400 for 3:4 at 2K; there is no way to request 1200×1600 directly. A small dependency-free PNG decoder/resizer/encoder (`scripts/lib/png.js`, Node's zlib only) does the downscale so the brief's size is met without adding npm packages. Downscaling from 2K also gives cleaner text than 1K.
4. **Cover base colour is always forest green** with cream text and one gold accent, per the brief's palette, rather than the guide's placeholder `color` (which is only a stand-in for the CSS book).
5. **`cover_subject` frontmatter field** holds the one photographic subject; without it make-cover uses a generic subject per topic. `cover_note` (or `--note "…"`) appends plain-English direction such as "less shadow, warmer green" for regeneration.
6. **Multiply blend on cover images.** The renders have a pure white background and the page is cream, so cover images are drawn with `mix-blend-mode: multiply`. White disappears into the page, the shadow stays soft, and the green book is unaffected. Two details made it work: the `.book` container gets a `has-cover` class that removes the CSS `perspective` (which would isolate the blend in its own stacking context) and gives it the paper background explicitly (Chrome does not blend against the root background). Three CSS declarations rather than editing every PNG.
7. **All three options are kept in `site/assets/covers/`** and committed (about 1.8 MB each). Swap by changing `cover` to `-2` or `-3`. Unused options can be deleted later to keep the repo light.
8. **Cost:** 18 credits per 2K image, so 54 credits per guide for three options. The account had 10,080 credits before this run.
9. **Approved cover kept as a style reference.** After you chose option 2, it was copied to `templates/cover-reference.png` and make-cover now sends it as a second reference image with an instruction to match its angle, lighting, layout and typography, changing only title, subtitle, badge and subject. `--no-style` skips it. The file lives in `templates/` (not `site/`) so it is versioned but never published.

## Stage 4: publish workflow

1. **Placeholder guides are merged, not duplicated.** `new-guide` for a slug that already exists in guides.json (the twelve placeholder cards) reuses that entry, keeping its `reads`, badge, colour, keywords and excerpt, and only adds the content file. A title that starts with "The" drops it from the slug, as the brief's example does.
2. **Scaffold placeholders are HTML comments starting with TODO.** They pass through the renderer unseen but `check-guide` fails on any that remain, so a half-written guide cannot ship quietly.
3. **check-guide severity.** FAIL (exit 1): em dashes, first-person singular, `[Add source]`, TODO markers, brand misspelling, fire emoji, "who this is for" sections, missing or misordered canonical blocks, gate before the first value, placement count other than one promo and one CTA, ALL-CAPS CTA header, word count outside 1,200–2,500, grade above 9, empty Sources, dead links, validator errors, missing OG image / pill / logo / disclosure. WARN: grade 7–9, hedging, jargon, exclamation marks, forced negation, paragraphs over four sentences, intro outside 3–5 paragraphs, more than half the guide before the gate, four coloured blocks in a row, NOTOXCHEF mentioned in prose, partner links pointing at the homepage, unlinked sources, sources outside .gov/.edu/journals, numbers without an inline source, excerpt length. The "never" rules that are context-sensitive (a quoted exclamation, "might" inside a brand's own claim) are warnings so a human decides.
4. **Body copy for the word count and grade** = everything before `## Sources`, including block text, table cells and check pills. The chicken guide comes out just under the 1,200 floor, which the lint reports honestly.
5. **HTML validation uses the W3C Nu validator's public API**, one POST per check; `--no-net` skips it and the link checks for offline work. Console errors need a browser and stay a manual check (done in Stage 5).
6. **Phone input `autocomplete` changed from `tel-national` to `tel`.** The validator rejects `tel-national` on `type="tel"` (the spec allows it only on text inputs). No visible change.
7. **Build removes stale pages.** Deleting `content/<slug>.md` now removes `site/guide-<slug>.html` on the next build and drops the guide's `text` from guides.json, so the card goes back to a placeholder rather than linking to a page that no longer exists.
8. **One-line HTML comments are their own block in the renderer.** Before this, a `<!-- TODO -->` line swallowed the heading after it. A raw HTML block now also stops at the next `:::` fence or heading.

## Stage 5: deploy

1. **Only three env vars on Netlify:** `BEEHIIV_API_KEY`, `BEEHIIV_PUB_ID`, `SITE_URL`. `KIE_API_KEY` is never used in a build or function (covers are generated on your machine), and `BEEHIIV_FORM_ACTION` holds an embed snippet the build ignores. Secrets live in as few places as possible.
2. **What is in git:** the brand book, source PDF, mockup HTML and PROMPT.md are committed as reference. The 4.9 MB Dr. Berg screenshot and the mockup zip are gitignored. `.env` is ignored and was confirmed untracked before the first push.
3. **`.gitattributes` pins LF line endings** so Windows checkouts and the Linux build image agree.
4. **First deploy from the CLI** (`netlify deploy --build --prod`) rather than waiting for the GitHub link, so the preview URL exists now. Linking the repository for automatic deploys on push needs Netlify's GitHub app authorised in your browser, which only you can do (two clicks, steps in the README).
5. **Server-side phone check tightened for +1 numbers.** The brief asked to keep the E.164 check; that stays, plus the North American rule that area code and exchange start with 2–9, so a direct call to the function cannot store a number the page would have rejected.
6. **Custom domain not added by me.** PROMPT.md's Part A has you add `guides.lifeuntox.com` in Netlify's domain settings after deploy; the CNAME record is in the README.

## Post-launch fixes (2026-09-12)

1. **Partner lockup image replaces the text pill.** The supplied 2400×660 banner had a transparent background and lots of empty space, so it is cropped to its content (1748×399), flattened on white and drawn with the same multiply blend as the covers, at a 340px max width under the meta line. It is in the template, so every guide gets it; `check-guide` now looks for the image instead of the pill text. The link still goes to notoxchef.com.
2. **Gate transparency was a paint-order bug, not opacity.** The blurred content has a CSS `filter`, which creates a stacking context painted after the earlier gate box, so blurred text showed through it. The gate now has `z-index: 2`. Same fix serves mobile.
3. **Phone form stuck on "Saving…":** the success handler sets `hidden` on the form, but the CSS `display:flex` on `.phone form` overrode it. Added `.phone form[hidden]{display:none}`.
4. **SMS copy rewritten for occasional marketing** (new guides, notable recalls, partner discounts, "a few a month at most, and one word stops them"); consent line now says "occasional marketing texts". Success heading: "Added. We will keep it occasional."
5. **Mobile gate:** box starts at 36px instead of 60px, tighter padding, slightly smaller heading, blurred area 600px tall so the box always sits inside it; phone form wraps to two rows with a full-width button.
6. **"Already a subscriber?" now checks the list.** The mockup trusted any address (its own comment said a function could check later). New `netlify/functions/check-subscriber.js` looks the email up in Beehiiv; only active or still-validating subscriptions unlock. The gate switches into a verify mode with its own copy and button, shows an inline error for unknown addresses, and offers a way back to the subscribe form. Unsubscribed addresses count as not found so they resubscribe through the normal path.
7. **Directory-page newsletter box now subscribes for real.** It used to flip the button to "You're in" without sending anything. It posts to the same subscribe function with `utm_campaign=library`.
8. **Newsletter copy rewritten** on both pages to say what the email is (one short, science-first read a day on what is in your water, food, cookware and home, with a safer swap in every issue); the gate and the directory box use the same promise. SMS copy now says a couple of texts a month.
9. **Gate layout moved from absolute positioning to a shared grid cell.** The gate box and the blurred content occupy the same grid row, so the row is as tall as whichever is bigger and the box can never spill past the blurred area into the share row, however long the copy or narrow the screen. The phone step sits in the row above, so the unlocked order (phone, then content) is unchanged.
10. **Footer:** "Savings codes" removed from Partners; Community now reads "Join our free community" (the Facebook group) plus Instagram, TikTok, X and Facebook. The guide footer says "Join our free community" too.

## Round 5 (2026-09-12)

1. **Only the chicken guide remains in guides.json.** The twelve placeholder cards are gone; `new-guide` still creates entries from scratch. "More free guides" is dropped from a page when there is nothing to show.
2. **Speed: covers are served as JPEG, derived at build.** A dependency-free baseline JPEG encoder (`scripts/lib/jpeg.js`, about 150 lines, standard tables, 4:4:4) turns each 1.8 MB cover PNG into a 200 KB full-size JPEG for the article header and Open Graph, and a 68 KB 600px JPEG for the directory grid and related-guide minis, with `srcset` so phones download the small one. Derived files are gitignored and regenerated on Netlify when the PNG is newer. Images carry width/height (no layout shift), `decoding="async"`, lazy loading in the grid and `fetchpriority="high"` on the header cover. The PNG stays the source of truth in `cover`.
3. **`tags` is a required frontmatter field**: health and life topics beyond the product category. At build they join the keyword pool the directory search already uses (so the search script is unchanged) and drive "More free guides" (shared tags first, then same category, then reads). `check-guide` fails on an empty list and warns under three or when a tag repeats a category.
4. **One footer for both pages** (`templates/footer.html`), injected at build, with the full Explore / About / Partners / Community columns. The guide page previously had a one-line footer.
5. **Mobile gate input:** in a column flex layout the `flex:1` input collapsed to its minimum height. On phones it is now a fixed 54px, full width, 17px text.
6. **Mobile footer is a 2×2 grid with the tall columns paired.** Below 700px the four footer columns become a two-column grid, ordered Explore | Community on the first row and About | Partners on the second, so the row heights balance instead of a six-link column sitting beside a one-link one. Desktop is unchanged.
7. **`/guides.json` is public.** The build copies guides.json into `site/` (gitignored there, like the built HTML) and `site/_headers` serves it with `Access-Control-Allow-Origin: *` and a five-minute cache. It is a verbatim copy, so `cover` is the PNG path; the lighter JPEGs sit next to it with the same name.

## Round 6 (2026-09-12): sponsor placements off

1. **A switch, not a deletion.** `PARTNER_PLACEMENTS = false` in `scripts/lib/config.js` removes the NOTOXCHEF header lockup, the promo card, the closing CTA and the Partners footer column from every built page. The Markdown keeps its `:::promo` and `:::cta` blocks and the design system is unchanged, so the placements can be switched back on with one edit and a rebuild.
2. **The Partners footer column went too.** It would have been a lone link to the sponsor; the brief said "sponsored blocks including the banner", and a sponsor link in the footer is part of the same arrangement. It is inside the same switch.
3. **The lint guards both states:** with placements on it requires the lockup on the built page; with them off it fails if "NOTOXCHEF" appears anywhere on a built page.
4. The mobile footer grid now has three columns to place; its pairing (Explore | Community, About below) still holds.

## Round 7 (2026-09-12): one header and footer for both sites, stage 1

1. **nav.json copies the live Beehiiv site, not the brief's draft.** With your confirmation: header links Read → lifeuntox.com/archive, Guides (current), Testimonials → lifeuntox.com (that is where it points on Beehiiv today), button "Subscribe" → lifeuntox.com/subscribe with Beehiiv's arrow-square-in icon. No Newsletter/About items and no /about URL, which does not exist. The Beehiiv search icon is left out.
2. **Footer copies the live Beehiiv footer**: square mark + "Lifeuntox", tagline, email box with "SUBSCRIBE FOR FREE" (posting to our subscribe function, tagged `slug: footer`), Facebook + Instagram icons with Beehiiv's own SVG paths, then Home and Posts. One deliberate addition: the education-not-advice line with the copyright, at 12.5px muted, because the guide pages should keep a legal line. Blank `footer.legal` in nav.json to remove it.
3. **Values changed from the brief to match the live site** (measured with computed styles at 1280 and 1600 wide): header 80px tall, no bottom border, inner max-width 1280 with 20px padding, logo 34px (Beehiiv's own logo file), links Inter 16px weight 500 colour #030712 with 12px between items and hover #265C26, button #1A4A1A radius 3px padding 4px 8px (39px tall) with no hover change. Footer: cream #FAF8F3, padding 30px 42px, no top border, mark 58px radius 8px, name Inter 24px 700, tagline 16px, email box 400px wide with a 2px #1A4A1A border and 8px radius, button 48px Inter 16px 600 radius 4px, 30px social circles, faint rule, links Inter 14px.
4. **"Guides" is highlighted green (#1A4A1A) on the guide site** as you asked. On Beehiiv the current item is not coloured differently; this is the one intentional visual difference in the header.
5. **Mobile follows the brief, not Beehiiv.** Beehiiv's mobile header shows a placeholder square mark and a hamburger menu (no subscribe button). Ours shows the wordmark at 28px and the Subscribe button in a 62px bar, as the brief specified, because a hamburger needs a menu we do not have.
6. **Footer Home link is not marked current** on the guide site (Beehiiv bolds it there because it is the current page). Both footer links render at weight 400 here.
7. **Old header/footer CSS removed** from both templates; the shared `templates/nav.css` is injected into each page so pages stay self-contained. `templates/footer.html` is gone. The Partners column no longer exists in the footer, so the sponsor switch now covers only the header lockup, promo and CTA.
8. **Assets:** Beehiiv's header logo (1000×208 PNG) and the square publication mark (1200×1200 JPG) were downloaded into `site/assets/` so the sites share the exact artwork.

## Round 7, stage 2: links in the Beehiiv "Free guides" block

1. **`beehiiv/free-guides-block.html` is the block's only copy.** The earlier `embeds/` file was identical apart from line endings and is removed, so there is one source of truth to paste into Beehiiv.
2. **How Beehiiv hosts the block, checked on the live homepage:** a `srcdoc` iframe with no `sandbox` attribute, same-origin with the page. That means `<base target="_top">` navigates the top page, and the fallback test (reading `window.top.location.href`) succeeds, so the `_blank` fallback is dormant. It stays in the file in case Beehiiv adds a sandbox later.
3. **The fallback also runs after the shelf renders**, because the guide links are created after the first check; without that, only the "Browse all guides" button would be retargeted.
4. **Verified locally in a srcdoc iframe** under the same conditions: clicking a cover and clicking the button both navigated the whole page to guides.lifeuntox.com.

## Round 8 (2026-09-12): footer re-copied after the Beehiiv redesign

1. **You changed the Beehiiv footer after Stage 1 shipped**, so the guide site was showing the previous Beehiiv footer. nav.json, the footer renderer and its CSS were rebuilt from the new live footer: leaf icon, "Wake up a little healthier tomorrow." with the subline, the email box ("Email address" / "Subscribe free", 1px #E2DED1 border, 8px radius) and "No spam, ever. Leave with one click.", three columns (Read, About, Community) vertically centred as Beehiiv lays them out, the wordmark with X / Facebook / Instagram / TikTok, and the legal line. Measured at 1280 and 375; desktop matches within 1px on every element.
2. **Link targets copied as they are on Beehiiv**, which are mostly placeholders today: Newsletter and Recalls go to /archive; Our mission, How we research, Advertise and The Untox Club go to the homepage. One exception: "Free guides" points at the guide library (/) instead of Beehiiv's /archive, because a guides link that leaves the guides site would be wrong. Update nav.json when the Beehiiv links get real destinations.
3. **Phone type scale.** Beehiiv renders footer text 1.2× larger on phones (16px → 19.2px). The mobile rules reproduce that.
4. The footer email box posts to the site's subscribe function tagged `footer`, as before.

## Round 9 (2026-09-13): one phone number per subscriber

1. **Why an index was needed.** Beehiiv's API has no filter by custom field, tag or phone (checked against the API reference and by probing the endpoint), so "does another subscriber already have this number?" cannot be answered without scanning all 72,000 subscriptions per opt-in. With your approval the answer lives in a Netlify Blobs store (`phones`): key = E.164 number, value = the email that holds it, plus an `email:<address>` key for the reverse lookup. Beehiiv remains the record of truth; `npm run phone-index` rebuilds the index from Beehiiv.
2. **Rules:** a number held by a different email is refused before anything is written to Beehiiv (HTTP 409, `phone_taken`; the page says "That number is already linked to a different email. Use the email you first signed up with, or add a different number."). The same email may re-submit its number or change it; changing it releases the old number.
3. **phone-save moved to the Netlify Functions v2 format** (Request → Response, `phone-save.mjs`). The older Lambda-style format cannot do strongly consistent Blobs reads, and an eventually consistent read let a second email take a number seconds after the first (caught in the live test). v2 gives strong reads plus an atomic "only if new" write, so the first claim wins even if two requests arrive together. Keys are `phone:<digits>` because "+" is not safe in a key. On the deployed site Blobs is mandatory (no silent fallback); in local `npm run dev` a JSON file under `.netlify/blobs-local/` stands in, and dev.js now runs v2 functions too.
4. **First npm dependency:** `@netlify/blobs`. Netlify installs it at build; run `npm install` locally once.
5. **Race window closed** by the atomic claim: two simultaneous requests for the same number cannot both succeed. If Beehiiv then rejects the write, the claim is released.

## Round 10 (2026-09-13): rate limits and security hardening

1. **Netlify's own rate limiting** (edge-enforced, declared in each function's config) rather than a hand-rolled limiter: subscribe 10/min per IP, phone-save 5/min per IP, HTTP 429 when exceeded. The Free plan allows two code-based rules per project, so the "already a subscriber?" lookup was folded into the subscribe function as `{check:true}` and `check-subscriber.js` is gone. Both functions are now in the Functions v2 format.
2. **Content Security Policy with script hashes.** All page scripts are inline, so the build computes a sha256 for each inline script it emits and writes them into `site/_headers` from `templates/_headers`. Nothing but those exact scripts can run. Styles need `'unsafe-inline'` because the CSS books set colours with inline style attributes; that is low risk and standard.
3. **Other headers:** nosniff, no framing, strict referrer policy, permissions policy denying camera/microphone/geolocation/payment/USB, same-origin opener policy, `upgrade-insecure-requests`. `netlify.toml` no longer carries headers; everything is in the one template.
4. **Honeypot on every form** (hidden `website` field). A filled honeypot gets an "ok" answer and no action, so bots do not learn they were caught.
5. **Function input hardening:** 4 KB body cap, strict JSON object parsing, no changes to the existing validation. Responses carry nosniff and no-store.
6. **Not added, on purpose:** a CAPTCHA (hurts real signups; revisit only if abuse appears), and IP blocking rules (Free plan has no UI traffic rules).
