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
