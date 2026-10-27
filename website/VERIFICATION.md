# Showcase verification

## Authorized public deployment, 27 October 2026

- Published at `https://3ds.kirbytrim.buzz/`, demo at `/demo/`, through the
  existing `trim-server` Cloudflare Tunnel. Added only this hostname and its
  proxied CNAME; existing applications and DNS records were retained.
- Dedicated showcase container rebuilt from the tested visual refinement;
  healthy after deployment. Previous files and a compressed backup retained
  on Debian. The personal-site container and its source were not edited.
- All **37 public exported files** fetched over HTTPS through Cloudflare and
  compared byte-for-byte with the local build. JavaScript MIME types, canonical
  URL, sitemap, real demo, missing asset 404 and WAV range response 206 passed.
- Six showcase tests passed before publishing; production export uses the
  approved URL via `WEBSITE_URL`, without editing `.env` or changing the default
  configurable URL used by forks.
- Added website/demo links to both READMEs and the GitHub repository homepage.
  The original template README is intentionally changed for these links only;
  its hash in `template-manifest.json` is updated. Client code, setup, data,
  release version and existing release artifacts remain unchanged.

## Visual-only refinement, 27 October 2026

Compared with commit `51d98e3`. No deployment, push, DNS change or server write
was performed for this refinement. The previously deployed showcase was viewed
read-only for the before screenshots. The personal 3DS site is unchanged.

- Only `style.css`, presentation-only `data-reveal` attributes in `index.html`,
  `DESIGN.md` and this report changed. Removing those attributes makes the HTML
  exactly equal to the baseline, including all text, section order, links,
  accessibility attributes and controls. JavaScript, dictionaries, screenshots,
  configuration, setup, build and deployment files have no diff.
- `git diff 51d98e3 -- . ':(exclude)website'`: empty. The six existing build
  tests pass, including hashes of all 43 protected original template files.
- Reference website and its HTML/CSS/JS/fonts/README/license inspected. Plain
  CSS bevels, rounded hierarchy and progressive motion informed the treatment;
  no reference code, fonts, illustrations or other assets were copied.
  License/dependency details and individual design reasons are in `DESIGN.md`.
- Chromium EN and FR at 320, 390, 640, 768, 1024 and 1280 CSS pixels: all 12
  checks have `scrollWidth === clientWidth`, and all visible interactive
  targets measure at least 44 by 44 pixels. Menu is present below 980 px.
- Three feature tabs show their real matching images and descriptions. Arrow
  keys move both selection and focus; the computed focus outline is solid.
- Windows and Linux installation show five matching instructions. Native copy
  clicks put exactly `.\setup.bat` and `bash setup.sh` in the clipboard.
- Five gallery buttons show the correct dialog captions and alternatives.
  Hero enlargement, previous/next, close and Escape work; Escape restores the
  hero screenshot button's focus. All seven FAQ answers open and close with
  Enter. Native FAQ behavior and its semantics are unchanged.
- Mobile Menu opens; Installation navigation updates the hash and closes it;
  Escape closes it and focuses Menu. Desktop Features/Captures/FAQ links and
  the hero's real `/demo/` destination were exercised. The demo finishes
  initialization with the `Demo profile` title and profile navigation.
- Ten configured external destinations returned HTTP 200 using HEAD requests.
  Browser error/warning log was empty during the recorded normal walkthrough.
- Existing observer reveals the feature image when it enters view. Computed
  hero entry is 0.5 seconds with one iteration. CSS transitions affect opacity,
  transform, color and shallow button depth; no perpetual motion or scroll
  interception was added. Reduced-motion CSS disables animations/transitions;
  the existing JavaScript preference guard is unchanged.
- Actual static showcase size: **323,904 bytes**, up **3,119 bytes**. CSS:
  **18,496 bytes**; JavaScript unchanged at **9,387 bytes**; HTML **27,438 bytes**.
  No new dependency, font request or image. Existing screenshot hashes pass.
- Contrast computations: muted text/ivory **5.73:1**, heading olive/ivory
  **6.47:1**, button text/lightest orange **5.10:1**, selected-tab text/olive
  **6.81:1**, frame caption/darkest rim **5.87:1**, demo text/dark olive
  **9.02:1**, component border/cream **3.39:1**, focus/paper **7.15:1**.
- Real before/after desktop and mobile captures, plus Features, Gallery and
  Installation views, are saved in the task's `outputs/showcase-visual-refresh/`
  folder. Desktop comparison uses the same 1280 by 900 viewport; phone uses
  390 by 844. Native screenshots exclude browser scrollbar/chrome regions.

Limits: no physical phone, screen reader, Safari/Firefox, actual 200% browser
zoom or Lighthouse run. Reduced-motion preference was inspected in source,
not toggled at OS level. Missing-file recovery was tested in the original
audit below; it was not injected again because its scripts remain unchanged.
The full R-01 through R-38 and C-1 through C-5 gate below was rechecked against
this refinement and the retained evidence. All entries remain PASS.

## Initial implementation evidence (before the separate deployment)

27 October 2026. Local implementation only. No push, deployment, domain change,
server modification or edit to the personal template. All new files are under
`website/`; `git diff HEAD -- . ':(exclude)website'` is empty.

## Executed checks

- `node --test website/tests/build.test.mjs`: **6 passed, 0 failed, 0 skipped** on Windows / Node 24.22.1.
- Build with a test canonical URL and subdirectory: canonical, Open Graph image URL, robots and sitemap verified. Rebuilt without a public URL: no invented canonical or sitemap remains.
- Built HTML links, anchors, local files, dictionaries, actual screenshot hashes, demo profile and namespaced storage checked. Demo export contains only the five bundled generic/Nintendo icon assets, sample data and the generated WAV; no personal profile JSON, credentials or Nintendo audio.
- Local preview: root and `demo/` HTTP 200; JavaScript module MIME, HEAD, rejected POST, private paths and traversal checked.
- All ten configured external destinations returned HTTP 200, including repository, versioned ZIP, Releases, Issues, README, license, notices, Node download, creator and weizkule.
- Chromium: EN/FR switch, metadata, installation tabs, both copy buttons verified using native clicks and exact clipboard reads. Keyboard arrows switch feature tabs and focus follows selection.
- Five screenshot destinations, previous/next and native dialog close tested. Escape returns focus to the opener. Actual load completed, with readable captions and image alternatives.
- Missing French dictionary deliberately simulated: visible English fallback, then successful French recovery. Missing screenshot deliberately simulated: visible error, then successful reload after restoration. All test files restored.
- Seven FAQ answers opened. Mobile Menu opens, navigation closes it, and Escape closes it and restores focus.
- Widths 320, 390, 640, 768, 1024 and 1280: no horizontal overflow. All rendered links, buttons, selects and summaries at 390 px meet 44 × 44 px after correcting the footer links.
- Demo played the original generated audio loop during actual navigation. No request to the personal production installation is used for the demo.

Actual uncompressed export sizes: **320,785 bytes** for the showcase (including
all five screenshots), **366,843 bytes** for its independent demo. Screenshots:
182,396 bytes; app JavaScript: 9,387 bytes; CSS: 15,449 bytes; HTML with English
fallback: 27,366 bytes. Supporting images use lazy loading; no external font,
tracking script or animation library. These are measured file sizes, not a
Lighthouse score or a transfer-time claim.

Contrast checker: secondary text/ivory **5.73:1**, button text/burnt orange
**6.17:1**, light text/olive **9.02:1**. Component borders/ivory **3.82:1**, meeting
the 3:1 non-text threshold; this border color is not used for normal text.

## Limits

No physical phone, screen-reader session, Safari/Firefox, Lighthouse run or
Linux run of the new showcase build is claimed. The existing template launchers
were previously tested on Windows and Linux; they are unchanged here. Native
zoom shortcuts did not change the in-app browser scale, so an actual 200% zoom
test is not claimed. Reduced-motion CSS and the matching JavaScript condition
were inspected; the system preference was not changed. Intentional 404s belong
to the error-state tests, not normal operation.

## Reference and direction

[3dsDL](https://ankush.one/3dsDL/) was accessible and inspected in Chromium.
Product-first introduction, feature navigation and practical installation are
the references. No reference code, illustration, screenshot, quote, statistic,
font or exact composition was copied. `DESIGN.md` records the separate ivory,
olive and orange direction, system typography and real-product imagery.

## Antislop Delivery Gate

Mode: during creation, explicit session preference and repeated user request.
Design Read: project showcase for people making personal sites, modern with
subtle 3DS details. **ENERGY 2 / RHYTHM 3 / MOTION 2**.

- R-01 PASS: flat ivory/olive surfaces; small hardware-like bevels serve button affordance, no decorative gradient field.
- R-02 PASS: showcase UI dictionaries contain no em dash.
- R-03 PASS: all twelve EN/FR viewport checks pass without overflow or targets smaller than 44 by 44 pixels; mobile menu and stacked sections exercised.
- R-04 PASS: original settings wrench and real project screenshots; no generic feature-icon library.
- R-05 PASS: feature tour, supporting text, gallery, demo band, installation and FAQ have content-specific compositions.
- R-06 PASS: Trebuchet headings recall friendly console typography; system sans supports readable prose; mono only for executable commands.
- R-07 PASS: no background grid, blueprint or decorative dot pattern.
- R-08 PASS: arrows are not appended to calls to action; keyboard arrows have a navigation function.
- R-09 PASS: no marketing badges or invented status indicators; version comes from version.json.
- R-10 PASS: no glassmorphism.
- R-11 PASS: screenshot frames, small controls and page surfaces use different radii.
- R-12 PASS: elevation reserved for the main product screenshot; other sections remain grounded.
- R-13 PASS: no glow effects.
- R-14 PASS: flagship features use real screenshot tabs; supporting features are plain ruled text, not identical cards.
- R-15 PASS: Live Demo/Get Started/View on GitHub are explicitly requested labels with tested destinations; other actions name their operation.
- R-16 PASS: copy describes available features; no invented marketing superlatives.
- R-17 PASS: no GitHub adoption/download counters or unsourced statistics.
- R-18 PASS: no testimonials.
- R-19 PASS: seven images reuse one-time reveals; hero entry computes to 500 ms, one iteration; short native-answer transitions, no loop or scroll lock, reduced-motion branch present.
- R-20 PASS: actual cream 3DS menus and original wrench identify this project; no generic product placeholders.
- R-21 PASS: light ivory derives from the retained template and requested console character; dark olive is a single demo section, not forced dark mode.
- R-22 PASS: real screenshots only; placeholder avatar is explicitly labelled inside the real demo.
- R-23 PASS: user requested original screenshots and project branding; source manifests record real captures and Nintendo notices remain visible.
- R-24 PASS: every internal anchor and local destination checked; ten external URLs returned 200.
- R-25 PASS: updated text pairs compute to at least 5.10:1; border/cream 3.39:1 and focus/paper 7.15:1; exact pairings recorded above.
- R-26 PASS: tabs, menu, dialog, copy, FAQ and navigation exercised; no fake download or demo button.
- R-27 PASS: real image loading/error, translation fallback and clipboard fallback paths exist; missing-file states and recovery exercised.
- R-28 PASS: seven questions directly address this project's setup, licensing, mobile, music, updates and contribution.
- R-29 PASS: ivory and olive core, orange action accent; screenshots retain actual product colors.
- R-30 PASS: reference approach examined without copying its blue stripes, console render, wording or layout.
- R-31 PASS: typography, spacing, palette, image framing, section rhythm and motion justified in DESIGN.md.
- R-32 PASS: native controls, visible focus, arrow-key tabs, Escape close and focus restoration exercised.
- R-33 PASS: features authored in source files; no runtime CSS patching or external UI mutation script.
- R-34 PASS: one intentional light appearance, no incomplete theme switch.
- R-35 PASS: actual build, six tests and browser interactions recorded above; limitations stated rather than claimed as passed.
- R-36 PASS: no fabricated security, compatibility, performance or Lighthouse score.
- R-37 PASS: direction supplied in the brief and recorded before implementation; declared dials match the result.
- R-38 PASS: demonstration content labelled, real community credit supplied by Trim, no invented contributor or adoption claim.

- Liveliness PASS: real product image and title form the focal point; structural whitespace, orange next-action accent and 3DS motif recur without uniform section layouts.
- C-1 PASS: visual decisions follow the project brief and written direction.
- C-2 PASS: available interactions have visible results; no backend or fabricated editor implied.
- C-3 PASS: sections answer the visitor's product, preview, installation and contribution needs.
- C-4 PASS: tested narrow layouts, error recovery and keyboard controls; untested environments explicitly bounded above.
- C-5 PASS: claims grounded in existing code, supplied credits, screenshots and executed checks.

The preview is temporary. Start it again with `node website/serve.mjs` after
building. Publication remains a separate, explicitly authorized step.
