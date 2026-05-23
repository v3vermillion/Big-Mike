# 🧍 Human Queue — items I could not prove to ≥95% confidence
_Per the VAS prime directive: anything uncertain, engine/hardware-bound, or a brand/taste call is handed to you — never silently passed._

## Decisions only you can make
1. **SEO canonical / OG domain.** Every `canonical`, `og:url`, `og:image`, `sitemap.xml`, `robots.txt` still points at `ifbbprobigmikeely.com` — which is currently dead (DNS doesn't resolve), so link previews are broken. But it's *your* domain and you may restore Namecheap. **Decision:** repoint to `https://v3vermillion.github.io/Big-Mike/` now (I can do it in one pass), or leave it for the custom domain. I didn't guess — say which.

## Needs both-theme visual sign-off (verification-heavy)
2. **Exhaustive theme-token refactor.** ~14 elements hardcode the gold gradient and won't follow crimson. I fixed the prominent leak (Results stats). The full pass — routing every hardcoded gold through `var(--goldGrad)` or adding crimson overrides — needs your eyes on **every surface in both themes on real devices** before it's "Assured." High effort, taste-sensitive.
3. **Theme switcher transfer (public → app.html).** app.html uses its own theme system; confirming the public choice fully transfers and covers every dynamically-rendered view/modal needs the app exercised post-login (mock-auth, next run).

## Engine / hardware bound (I cannot test here)
4. **Real Safari/WebKit + Firefox rendering.** At-risk CSS pre-flagged: `background-clip:text` (every gold wordmark + the fallback monogram), `-webkit-mask` (the page-close M), `backdrop-filter`, `:has()`, `aspect-ratio`. Chromium emulation passed; real iOS Safari + Firefox need a human screenshot.
5. **Live VoiceOver / TalkBack** speech-quality pass.
6. **PWA install on real iOS/Android hardware** (emulated config is correct; the actual "Add to Home Screen" + icon render on a physical device is yours to confirm).

## Queued for the next (deeper) run
7. **Form-label association** — `onboard.html` (13 fields) + `book.html` (1) use `<span class="lb">` instead of `<label for>`. Screen-readers don't announce the field name. Safe but needs careful for=id mapping.
8. **app.html carbon-fiber fallback** — app.html doesn't load `site.css`, so it needs its own copy of the fallback CSS (portal + marketing already have it).
9. **v1 harness re-pathing** — `handler_audit.js` and siblings have hardcoded file lists from the single-file era; re-point them at the current files, then re-run for the full 1,300+ assertion backbone.
10. **Waves 3 & 5** — interaction fuzzing, dead-code telemetry, and the deep coach/client app walkthroughs require a temporary local mock-auth to get past the dead backend.
