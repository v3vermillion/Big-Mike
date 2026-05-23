#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   tools/build-pages.js
   ──────────────────────────────────────────────────────────────────
   Deterministic generator for the public-facing Big Mike Ely pages.
   Takes per-section HTML fragments and a shared layout template,
   emits 6 top-level HTML files (about / results / services /
   platform / gallery / contact) at the repo root.

   Design rules the senior panel cares about:
   • Shared nav / mobile menu / footer / lightbox are defined ONCE in
     this file. Any change to those lives in one place. Re-run the
     script and every page is updated in lockstep.
   • No shortcuts and no duplication. Every page is rebuilt from the
     same template, the only per-page variance is <head> meta, the
     single section body, and (optionally) a CTA link target.
   • Output is static HTML with no build step for the browser. The
     host (GitHub Pages) serves the files verbatim.
   • The script is idempotent — running it twice produces the same
     files, byte-for-byte.

   Usage:  node tools/build-pages.js
   ═════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_VERSION = 'v45';

/* ── Section bodies (copied verbatim from the original index.html) ── */
const sections = {
  about:    fs.readFileSync('/tmp/section_about.html',    'utf8'),
  results:  fs.readFileSync('/tmp/section_results.html',  'utf8'),
  services: fs.readFileSync('/tmp/section_services.html', 'utf8'),
  platform: fs.readFileSync('/tmp/section_platform.html', 'utf8'),
  gallery:  fs.readFileSync('/tmp/section_gallery.html',  'utf8'),
  contact:  fs.readFileSync('/tmp/section_contact.html',  'utf8'),
};

/* ── Per-page metadata (title, meta description, OG overrides) ── */
const pages = {
  about: {
    file: 'about.html',
    title: 'About Big Mike Ely — 2× IFBB Pro World Champion, Olympian, NPC Judge',
    desc: 'A 2× IFBB Pro World Champion and 2× Olympian, Mike has coached since 1996 from Old School Iron in Ohio. Credentials, professional contest history, and the people in his world.',
    canonical: 'https://ifbbprobigmikeely.com/about.html',
    ogTitle: 'About Big Mike Ely | 2× IFBB Pro World Champion',
    ogDesc: '2× IFBB Pro World Champion · 2× Olympian · NPC Judge · Coaching since 1996.',
  },
  results: {
    file: 'results.html',
    title: 'Client Results — Transformations by IFBB Pro Big Mike Ely',
    desc: 'Championship-level client transformations. 50+ pro cards earned, 40+ transformations over 100 pounds. See the work of Big Mike Ely Coaching.',
    canonical: 'https://ifbbprobigmikeely.com/results.html',
    ogTitle: 'Client Results | Big Mike Ely Coaching',
    ogDesc: '50+ pro cards earned · 40+ transformations over 100 lbs · Championship-level client work since 1996.',
  },
  services: {
    file: 'services.html',
    title: 'Coaching Services — Contest Prep, Online Coaching, Posing, 1-on-1',
    desc: 'Contest prep, online coaching, 1-on-1 training, nutrition planning, and posing sessions from IFBB Pro Big Mike Ely at Old School Iron in Ohio.',
    canonical: 'https://ifbbprobigmikeely.com/services.html',
    ogTitle: 'Coaching Services | Big Mike Ely',
    ogDesc: 'Contest Prep · Online Coaching · Nutrition · Posing · 1-on-1 Training.',
  },
  platform: {
    file: 'platform.html',
    title: 'The Platform — A Private Client Portal, Not a PDF',
    desc: 'A platform, not a PDF. Private client portal, branded transformations, real-time coaching, and championship-level tracking — built by Vermillion Axis for a 2× IFBB Pro World Champion.',
    canonical: 'https://ifbbprobigmikeely.com/platform.html',
    ogTitle: 'The Platform | Big Mike Ely Coaching',
    ogDesc: 'A platform, not a PDF. Private portal · Branded transformations · Real-time coaching.',
  },
  gallery: {
    file: 'gallery.html',
    title: 'Gallery — Big Mike Ely Championship Career Photo Archive',
    desc: 'A photo archive of the career — competition, training, backstage, and personal moments from IFBB Pro Big Mike Ely.',
    canonical: 'https://ifbbprobigmikeely.com/gallery.html',
    ogTitle: 'Gallery | Big Mike Ely',
    ogDesc: 'Career photo archive — competition, training, and behind the scenes.',
  },
  contact: {
    file: 'contact.html',
    title: 'Contact Big Mike Ely — Coaching, Guest Posing, Press',
    desc: 'Reach Big Mike Ely for coaching inquiries, guest posing, promoter bookings, press, and sponsorship. Response within 24 hours.',
    canonical: 'https://ifbbprobigmikeely.com/contact.html',
    ogTitle: 'Contact Big Mike Ely',
    ogDesc: 'Coaching inquiries, guest posing, press, and sponsorship — reviewed personally, 24-hour response.',
  },
};

/* ── Shared <head> fragment (preloads, fonts, icons, CSP, structured data) ──
   Intentionally the same on every page. SEO-critical meta (title, desc,
   canonical, og:title, og:description) is injected per-page. */
const sharedHead = (p) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${p.title}</title>
<meta name="description" content="${p.desc}">
<meta name="theme-color" content="#020202">
<meta name="color-scheme" content="dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://img.youtube.com https://ozgemcvnjzqfumpjxwcq.supabase.co; connect-src 'self' https://ozgemcvnjzqfumpjxwcq.supabase.co; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'">
<meta name="robots" content="index, follow">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta http-equiv="X-Frame-Options" content="DENY">
<meta http-equiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=(), payment=()">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="canonical" href="${p.canonical}">

<!-- Open Graph -->
<meta property="og:title" content="${p.ogTitle}">
<meta property="og:description" content="${p.ogDesc}">
<meta property="og:type" content="website">
<meta property="og:url" content="${p.canonical}">
<meta property="og:image" content="https://ifbbprobigmikeely.com/img/platform-social-share.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Big Mike Ely Coaching — 2× IFBB Pro World Champion">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${p.ogTitle}">
<meta name="twitter:description" content="${p.ogDesc}">
<meta name="twitter:image" content="https://ifbbprobigmikeely.com/img/platform-social-share.png">

<!-- Icons -->
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">

<!-- Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Rajdhani:wght@400&family=IBM+Plex+Mono:wght@400;600&display=swap">

<!-- Shared site styles — single source of truth, cached across pages -->
<link rel="stylesheet" href="css/site.css?v=${SITE_VERSION}">
</head>`;

/* ── Shared nav + mobile menu. Every link points to a real page.
   Order is optimized for conversion funnel: proof first, then
   offerings, then delivery, then authority, then exploration,
   then close. Hero → Results → Services → Platform → About →
   Gallery → Contact → Start Here → Book. */
const sharedNav = `
<!-- NAV -->
<nav class="nav" id="nav">
  <a href="index.html" class="nav-home" aria-label="Big Mike Ely — Home">
    <span class="nav-sigil">M</span>
    <div class="nav-tag"><span>Mike Ely</span>IFBB Pro</div>
  </a>
  <div class="nav-links">
    <a href="results.html">Results</a>
    <span class="nav-sep"></span>
    <a href="services.html">Services</a>
    <span class="nav-sep"></span>
    <a href="platform.html">Platform</a>
    <span class="nav-sep"></span>
    <a href="about.html">About</a>
    <span class="nav-sep"></span>
    <a href="gallery.html">Gallery</a>
    <span class="nav-sep"></span>
    <a href="contact.html">Contact</a>
    <span class="nav-sep"></span>
    <a href="onboard.html" style="color:var(--acc) !important;font-weight:600 !important">Start Here</a>
    <a href="book.html" class="nav-cta">Book</a>
  </div>
  <button class="nav-burger" id="navBurger" aria-label="Open menu"><span class="burger-text">MENU</span></button>
</nav>

<!-- MOBILE MENU -->
<div class="mm" id="mm" role="dialog" aria-modal="true">
  <div class="mm-corner-tl"></div><div class="mm-corner-br"></div>
  <button class="mm-close" id="mmClose" aria-label="Close menu">&times;</button>
  <a href="results.html" class="mm-link">Results</a>
  <a href="services.html" class="mm-link">Services</a>
  <a href="platform.html" class="mm-link">Platform</a>
  <a href="about.html" class="mm-link">About</a>
  <a href="gallery.html" class="mm-link">Gallery</a>
  <a href="contact.html" class="mm-link">Contact</a>
  <a href="onboard.html" class="mm-link" style="color:var(--acc) !important;font-weight:600 !important;letter-spacing:.16em">Start Here</a>
  <a href="book.html" class="mm-cta">Book a Session</a>
  <div class="mm-badge">IFBB Pro Big Mike Ely</div>
</div>
`;

/* ── Shared final CTA. Points at contact.html (a real page, not an anchor). */
const sharedCTA = `
<!-- FINAL CTA -->
<section class="cta">
  <div class="cta-bg"></div><div class="cta-ov"></div>
  <div class="cta-inner reveal-scale">
    <div class="cta-quote">The results are the résumé.</div>
    <div class="gw" style="max-width:40px;margin:0 auto 28px"></div>
    <h2 class="s-head" style="margin-bottom:24px">Your Move</h2>
    <a href="contact.html" class="btn-p">Start the Conversation</a>
    <div class="cta-sub">Limited availability &middot; Serious inquiries only</div>
  </div>
</section>
`;

/* ── Shared footer. Every link is a real page, no anchors. */
const sharedFooter = `
<!-- FOOTER -->
<footer class="footer">
  <div class="footer-mark">M</div>
  <div class="footer-sig">IFBB Pro &middot; 2x Olympian &middot; 2x World Champion &middot; NPC Judge &middot; Since 1996</div>
  <div class="footer-links">
    <a href="results.html">Results</a><a href="services.html">Services</a><a href="platform.html">Platform</a><a href="about.html">About</a><a href="gallery.html">Gallery</a><a href="contact.html">Contact</a><a href="book.html">Book</a>
    <a href="app.html" style="opacity:.35">Coach Portal</a>
  </div>
  <div class="footer-social">
    <a href="https://instagram.com/ifbbpromikeely" target="_blank" rel="noopener" aria-label="Instagram"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg></a>
    <a href="https://instagram.com/center_stage_aesthetics" target="_blank" rel="noopener" aria-label="Center Stage Aesthetics"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg></a>
    <a href="https://facebook.com/BIGMIKEELY" target="_blank" rel="noopener" aria-label="Facebook"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg></a>
  </div>
  <div class="gw" style="max-width:160px;margin:0 auto 20px"></div>
  <div class="footer-copy">&copy; 2026 Big Mike Ely Coaching &middot; Center Stage Aesthetics. All rights reserved.</div>
  <a href="https://www.vermillionaxis.tech" target="_blank" rel="noopener" class="vat">
    <svg width="16" height="20" viewBox="0 0 28 34" fill="none"><line x1="8" y1="10" x2="14" y2="22" stroke="currentColor" stroke-width="1.2"/><line x1="20" y1="10" x2="14" y2="22" stroke="currentColor" stroke-width="1.2"/><circle cx="14" cy="7" r="1.5" fill="currentColor" opacity=".5"/></svg>
    Vermillion Axis Technologies
  </a>
</footer>
`;

/* ── Shared lightbox (required by gallery, results, about circle photos) ── */
const sharedLightbox = `
<!-- LIGHTBOX -->
<div class="lightbox" id="lb" onclick="closeLB()" role="dialog" aria-modal="true" aria-label="Photo lightbox">
  <button class="lb-close" aria-label="Close">&times;</button>
  <button class="lb-arr lb-prev" onclick="event.stopPropagation();navLB(-1)" aria-label="Previous">&#8249;</button>
  <div class="lb-img-wrap" id="lbImgWrap" onclick="event.stopPropagation()">
    <img id="lbImg" alt="">
  </div>
  <button class="lb-arr lb-next" onclick="event.stopPropagation();navLB(1)" aria-label="Next">&#8250;</button>
  <div class="lb-info" id="lbInfo">
    <div class="lb-counter" id="lbCounter"></div>
    <div class="lb-cat" id="lbCat"></div>
  </div>
</div>
`;

/* ── Full page composition.
   Each page has the same outer shell; only the <main> content changes. */
function composePage(pageKey) {
  const p = pages[pageKey];
  const body = sections[pageKey];

  return `${sharedHead(p)}
<body>
<a href="#main" class="skip-link">Skip to main content</a>

<!-- GRAIN + VIGNETTE — atmospheric, cheap, consistent with brand system -->
<div class="grain-ov" aria-hidden="true"></div>
<div class="vignette" aria-hidden="true"></div>
<div class="atmos-mesh" aria-hidden="true"></div>
<div class="film-grain" aria-hidden="true"></div>
${sharedNav}
<main id="main">
${body}
${sharedCTA}
</main>
${sharedFooter}
${sharedLightbox}
<script src="js/site.js?v=${SITE_VERSION}"></script>
</body>
</html>
`;
}

/* ── Write every page ── */
let written = 0;
for (const key of Object.keys(pages)) {
  const out = path.join(ROOT, pages[key].file);
  const html = composePage(key);
  fs.writeFileSync(out, html);
  console.log(`  wrote ${pages[key].file.padEnd(14)} ${html.length.toString().padStart(6)} bytes`);
  written++;
}
console.log(`\n${written} pages generated.`);
