# 🧍 Human Queue — items I could not prove to ≥95% confidence
_Per the VAS prime directive: anything uncertain, engine/hardware-bound, or a brand/taste call is handed to you — never silently passed._

## Engine / hardware bound (cannot be tested in this environment)
1. **Real Safari/WebKit + Firefox rendering.** Chromium emulation passed everywhere. At-risk CSS pre-flagged: `background-clip:text` (every gold wordmark + the fallback monogram), `-webkit-mask` (the page-close M), `backdrop-filter`, `:has()`, `aspect-ratio`. Needs one human screenshot on real iOS Safari + Firefox.
2. **Live VoiceOver / TalkBack** speech-quality pass (axe covers structure, not the actual spoken experience).
3. **PWA install on physical iOS/Android** — manifest/icons/scope are correct and emulated-valid; the real "Add to Home Screen" + icon render is yours to confirm once Pages is enabled.

## Needs both-theme visual sign-off (taste-sensitive)
4. **Exhaustive theme-token refactor.** ~13 elements still hardcode the gold gradient and won't follow crimson (I fixed the prominent Results-stats leak). The full pass — routing each through `var(--goldGrad)` or adding a crimson override — needs your eye on **every surface in both themes** before it's "Assured." Low risk, high verification cost.

## Decisions
5. **Domain.** Now repointed to `https://v3vermillion.github.io/Big-Mike/`; Namecheap preserved in `CNAME.disabled` + `DOMAIN.md`. When DNS resolves: `git mv CNAME.disabled CNAME` and run the sed in `DOMAIN.md` to switch SEO back. ✅ (done per your instruction; flagged so you know how to flip it.)

## Minor polish (queued, low risk)
6. **Form-label association** — `onboard.html` (13 fields) + `book.html` (1) use `<span class="lb">` instead of `<label for>`. Sighted users fine; screen-readers miss the field name. Needs careful for=id mapping.
7. **app.html carbon-fiber fallback** — app.html doesn't load `site.css`, so it needs its own copy of the fallback CSS (portal + marketing already have it). Lower priority: the coach app's images are client-uploaded and only appear post-login with a live backend.
8. **Coach-app interior visual screenshots** — function is proven (edge 9/0, coach_wizard 21/0, three_perspective 40 clients @205ms), but a visual mock-auth render of the coach dashboard (like the portal one) would complete the visual record. Its PIN gate needs a bit more setup than the portal's.

## Verified clean — no action
Foundation (0 overflow/console/axe), the ~1,268-assertion logic/data/security backbone, the client-portal interior (mobile + desktop), the carbon-fiber fallback, and the recovered marketing site.
