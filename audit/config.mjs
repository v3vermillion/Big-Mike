// AUDIT v2 — central config. Single source of truth for the sweep.
// Pure data + light helpers; consumed by orchestrator.mjs and lib/*.

export const SITE_ROOT = "/home/user/Big-Mike";
export const BASE_URL = "http://localhost:8099"; // local static server during the sweep

// ── Surfaces ────────────────────────────────────────────────────────────────
export const PUBLIC_PAGES = [
  "index", "about", "services", "gallery", "results",
  "contact", "book", "platform", "onboard", "404",
];
export const APP_PAGES = ["app", "portal"]; // coach app + client portal (login-gated)

// ── Device & environment matrix (2026) ───────────────────────────────────────
export const DEVICES = [
  { tag: "fold-closed", w: 280, h: 653, dpr: 3, touch: true,  ua: "android" },
  { tag: "android-360", w: 360, h: 800, dpr: 3, touch: true,  ua: "android" },
  { tag: "iphone-se",   w: 375, h: 667, dpr: 2, touch: true,  ua: "iphone"  },
  { tag: "iphone-16",   w: 393, h: 852, dpr: 3, touch: true,  ua: "iphone"  },
  { tag: "iphone-max",  w: 430, h: 932, dpr: 3, touch: true,  ua: "iphone"  },
  { tag: "fold-open",   w: 717, h: 512, dpr: 3, touch: true,  ua: "android" },
  { tag: "ipad-mini",   w: 768, h: 1024, dpr: 2, touch: true, ua: "ipad"    },
  { tag: "ipad-pro",    w: 1024, h: 1366, dpr: 2, touch: true, ua: "ipad"   },
  { tag: "laptop-1366", w: 1366, h: 768, dpr: 1, touch: false, ua: "desktop"},
  { tag: "desktop-1440",w: 1440, h: 900, dpr: 2, touch: false, ua: "desktop"},
  { tag: "desktop-1920",w: 1920, h: 1080, dpr: 1, touch: false, ua: "desktop"},
  { tag: "ultra-2560",  w: 2560, h: 1440, dpr: 1, touch: false, ua: "desktop"},
];
export const UA = {
  desktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141 Safari/537.36",
  iphone:  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipad:    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141 Mobile Safari/537.36",
};
export const CONDITIONS = [
  "default", "dark", "reduced-motion", "high-contrast", "forced-colors",
  "zoom-200", "slow-3g", "offline", "pwa-standalone", "keyboard-only",
];

// ── Themes ───────────────────────────────────────────────────────────────────
export const THEMES = ["gold", "crimson"];

// ── Scoring rubric ───────────────────────────────────────────────────────────
export const CONFIDENCE_GATE = 95;          // below this -> Human Queue
export const ENGINE_RESIDUAL_CAP = 70;      // Safari/Firefox/hardware bound
export const EVIDENCE_CEIL = { T0: 60, T1: 75, T2: 88, T3: 100 };
export const Q_TARGET = { index: 92, portal: 92, app: 90, _default: 88 };
export const Q_DIMENSIONS = [
  "visual_craft", "interaction_feel", "performance",
  "accessibility", "robustness", "brand_consistency",
];

// ── Performance budgets (per device tier, ms / score) ────────────────────────
export const PERF_BUDGET = {
  mobile:  { lcp: 2800, cls: 0.10, tbt: 300, inp: 200 },
  desktop: { lcp: 1800, cls: 0.10, tbt: 200, inp: 200 },
};

// ── Engine-fragile CSS to flag for the Safari/Firefox human queue ────────────
export const ENGINE_RISK_PATTERNS = [
  "background-clip:text", "-webkit-background-clip", "-webkit-mask", "mask:",
  "backdrop-filter", ":has(", "aspect-ratio", "100svh", "100dvh", "100lvh",
  "scrollbar-color", "text-wrap:balance", "@container",
];

// ── Architectural invariants (from v1 CLAUDE_SWEEP, machine-checkable subset) ─
export const INVARIANTS = [
  { id: "I1", desc: "No element exceeds viewport width (non-decorative)" },
  { id: "I2", desc: "Every interactive element has an accessible name; targets >=44px" },
  { id: "I3", desc: "Theme switch mutates 100% of themed tokens (no hardcoded gold/crimson survives)" },
  { id: "I4", desc: "Zero console errors / unhandled rejections on any path" },
  { id: "I5", desc: "Every data view has loading + empty + error states" },
  { id: "I6", desc: "Every remote .then() has a terminating .catch()" },
  { id: "I7", desc: "Every mutation has a rapid-tap guard" },
  { id: "I8", desc: "save() persists every store referenced by any renderer" },
  { id: "I9", desc: "Contrast >=4.5 body / >=3 large at default + theme-switch + over-photo" },
  { id: "I10", desc: "No image failure renders a dead box (carbon-fiber/gold fallback engages)" },
  { id: "I11", desc: "Centering within +-2px for should-center elements" },
  { id: "I12", desc: "PWA installable + correct icon/name; updates reach saved apps" },
];

// ── Segment registry (waves) ─────────────────────────────────────────────────
// Each segment: id, wave, title, scope, method (high-level), inherits (v1 scripts).
export const SEGMENTS = [
  // WAVE 1 — foundation/runtime
  { id: "W1-load",    wave: 1, title: "Boot & runtime per page", scope: [...PUBLIC_PAGES, ...APP_PAGES], method: "load-trace+console+lcp+cls", inherits: ["visual_audit"] },
  { id: "W1-links",   wave: 1, title: "Link/anchor + subpath integrity", scope: "all", method: "static+runtime", inherits: ["handler_audit"] },
  // WAVE 2 — surfaces
  { id: "W2-hero",    wave: 2, title: "Hero", scope: ["index"], method: "visual7+measure", inherits: ["visual_audit"] },
  { id: "W2-grid",    wave: 2, title: "Company-He-Keeps grid + lightbox", scope: ["index"], method: "visual7+interaction" },
  { id: "W2-nav",     wave: 2, title: "Nav + mobile menu", scope: "all", method: "interaction+a11y" },
  { id: "W2-footer",  wave: 2, title: "Footer", scope: "all", method: "visual7" },
  { id: "W2-pages",   wave: 2, title: "Each marketing page", scope: PUBLIC_PAGES, method: "visual7+measure", inherits: ["visual_audit"] },
  // WAVE 3 — interaction & logic
  { id: "W3-fuzz",    wave: 3, title: "Rapid-tap/keyboard fuzzing", scope: "all", method: "fuzz", inherits: ["lock_audit"] },
  { id: "W3-dead",    wave: 3, title: "Redundancy / dead-code (telemetry)", scope: "all", method: "trace-coverage" },
  { id: "W3-forms",   wave: 3, title: "Forms & input states", scope: ["contact", "book", "onboard", "portal", "app"], method: "interaction+states" },
  // WAVE 4 — systems
  { id: "W4-theme",   wave: 4, title: "Theme switcher (public->app.html, full-token)", scope: ["index", "app", "portal"], method: "logic-trace+token-coverage", invariants: ["I3", "I9"] },
  { id: "W4-pwa",     wave: 4, title: "PWA install/update/offline", scope: ["app", "portal", "book"], method: "manifest+sw+matrix", invariants: ["I12"] },
  { id: "W4-a11y",    wave: 4, title: "Accessibility (axe + modern modes)", scope: "all", method: "axe+keyboard+modes", invariants: ["I2", "I9"] },
  { id: "W4-type",    wave: 4, title: "Typography / low-vision readability", scope: "all", method: "measure+zoom200+contrast" },
  { id: "W4-perf",    wave: 4, title: "Performance budgets", scope: [...PUBLIC_PAGES, ...APP_PAGES], method: "lighthouse" },
  { id: "W4-data",    wave: 4, title: "Data integrity (LS/save/export/cascade)", scope: ["app", "portal"], method: "harness", inherits: ["coach_wizard_harness", "edge_harness"], invariants: ["I8"] },
  { id: "W4-sec",     wave: 4, title: "Security", scope: "all", method: "static+harness", inherits: ["security_audit"] },
  // WAVE 5 — the two apps
  { id: "W5-coach",   wave: 5, title: "Coach app deep-dive", scope: ["app"], method: "harness+walk+visual", inherits: ["coach_wizard_harness", "edge_harness", "functional_walkthrough"] },
  { id: "W5-portal",  wave: 5, title: "Client portal — THE HIGHLIGHT", scope: ["portal"], method: "harness+walk+visual+benchmark", inherits: ["portal_render_harness", "what_if_chains", "three_perspective"] },
  // WAVE 6 — brand & ceiling
  { id: "W6-fallback",wave: 6, title: "Carbon-fiber/gold fallback texture", scope: "all", method: "design+chaos-missing-img", invariants: ["I10"] },
  { id: "W6-oldschool",wave: 6, title: "Old-school background system", scope: PUBLIC_PAGES, method: "design+visual7" },
  { id: "W6-ceiling", wave: 6, title: "Final polish to Q ceiling", scope: "all", method: "visual7+benchmark" },
];

export const WAVES = [1, 2, 3, 4, 5, 6];
export const qTargetFor = (page) => Q_TARGET[page] ?? Q_TARGET._default;
