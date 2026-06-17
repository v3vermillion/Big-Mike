# Big Mike Ely — IFBB Pro Coaching Platform

A production web platform for an IFBB Pro bodybuilding coach: a fast, SEO-optimized
marketing site paired with a full offline-first coaching application and a private
client portal. Designed, built, and shipped end to end — front end, data layer,
cloud sync, PWA, and deployment.

**Live:** https://v3vermillion.github.io/Big-Mike/

---

## What it is

The project has three connected parts:

1. **Marketing site** — A polished, mobile-first landing experience (home, about,
   services, results, gallery, contact) built for conversion and search visibility.
   Custom typography, branded transformation galleries, and rich social/Open Graph
   share cards.

2. **Coaching application** — A single-file vanilla-JS SPA where the coach manages
   clients, training programs, meal plans, supplement and compound protocols,
   session logs, and scheduling. Works fully offline and installs to the home screen
   as a Progressive Web App.

3. **Client portal** — A separate branded surface where athletes view their assigned
   programs, plans, and progress.

---

## Highlights

- **Offline-first architecture.** All business logic runs client-side with
  `localStorage` as the source of truth, so the app stays usable with no connection.
- **Optional cloud sync.** When configured, data is mirrored to Supabase (Postgres +
  JSONB) with a debounced push/pull merge strategy for multi-device use.
- **Branded PDF export.** Training programs, meal plans, and full prep packets are
  rendered to print-ready, branded PDFs entirely in the browser (jsPDF +
  html2canvas).
- **Automated SMS reminders.** Scheduled sessions trigger reminder texts through a
  Supabase Edge Function backed by the Twilio API.
- **Installable PWA.** Manifest, service worker, and dynamically generated theme
  icons for a native-feeling home-screen install.
- **Performance & SEO.** LCP image preloading, a strict Content-Security-Policy,
  structured data, canonical URLs, sitemap, and tuned link-preview share cards.
- **Theming.** Theme-aware CSS variables drive a cohesive, switchable visual identity
  across every screen.

---

## Tech stack

| Area | Technology |
|------|------------|
| Front end | Vanilla JavaScript (no framework), semantic HTML, modern CSS |
| Persistence | `localStorage` (primary) + Supabase Postgres/JSONB (cloud sync) |
| Backend functions | Supabase Edge Functions (Deno) |
| Messaging | Twilio SMS API |
| Documents | jsPDF, html2canvas |
| Platform | Progressive Web App (manifest + service worker) |
| Hosting | GitHub Pages |

---

## Architecture notes

- **No framework, by design.** The application is built from pure functions that
  return HTML strings, swapped into the DOM via `innerHTML`. An in-memory navigation
  stack handles back/forward without a router. This keeps the bundle tiny and the app
  instantly responsive.
- **Single source of truth.** A small `LS` utility wraps `localStorage`. Cloud sync is
  strictly additive — the app never depends on the network to function.
- **Defense in depth on a static host.** Even as a client-side app served from GitHub
  Pages, it ships a strict CSP, `X-Content-Type-Options`, a restrictive
  Permissions-Policy, and a PIN-gated UI appropriate to its single-user threat model.

A deeper engineering write-up lives in
[`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md).

---

## Project layout

```
index.html          Marketing landing page
about / services /  Marketing site pages
results / gallery /
contact
app.html            Coaching application (SPA)
portal.html         Client portal
onboard.html        Client onboarding flow
book.html           Programmatic book/content build
sw.js               Service worker
manifest.json       PWA manifest
assets/ css/ js/    Shared styles, scripts, fonts
supabase/           Database migrations and Edge Functions
img/ icons/         Imagery and generated app icons
```

---

## About this build

This is original work I designed and built — product direction, UX, front-end
engineering, data modeling, cloud integration, and deployment. I enjoy shipping
small, fast, dependency-light web apps that feel premium and just work, and I'm
available for freelance and contract work in that space.
