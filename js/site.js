/* ═══════════════════════════════════════════════════════════════════
   BIG MIKE ELY — IFBB PRO COACHING LANDING PAGE
   Vanilla JS · No frameworks · No modules
   ═══════════════════════════════════════════════════════════════════ */

/* ── SCROLL RESET ── */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* ── NAV — scroll detection, glass morphism toggle ── */
var nav = document.getElementById('nav');
var burger = document.getElementById('navBurger');
var mm = document.getElementById('mm');
var mmClose = document.getElementById('mmClose');

/* Nav scrolled state — rAF gated + threshold guard so we only
   toggle the class when crossing the boundary, not on every frame. */
(function () {
  var wasScrolled = false;
  var navTicking = false;
  window.addEventListener('scroll', function () {
    if (navTicking) return;
    navTicking = true;
    requestAnimationFrame(function () {
      var isScrolled = window.scrollY > 60;
      if (isScrolled !== wasScrolled) {
        nav.classList.toggle('scrolled', isScrolled);
        wasScrolled = isScrolled;
      }
      navTicking = false;
    });
  }, { passive: true });
})();

/* ── MOBILE MENU — toggle, close on link/Escape ── */
var _mmTrigger = null;
function toggleMenu() {
  var opening = !mm.classList.contains('open');
  if (opening) _mmTrigger = document.activeElement;
  mm.classList.toggle('open');
  document.body.style.overflow = mm.classList.contains('open') ? 'hidden' : '';
  if (opening) {
    var first = mm.querySelector('.mm-close,.mm-link,.mm-cta');
    if (first) first.focus();
  } else if (_mmTrigger) {
    _mmTrigger.focus();
    _mmTrigger = null;
  }
}

burger.addEventListener('click', toggleMenu);
mmClose.addEventListener('click', toggleMenu);
/* M sigil: scroll to top on all viewports */
var navHome = document.querySelector('.nav-home');
if (navHome) navHome.addEventListener('click', function (e) {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
document.querySelectorAll('.mm-link,.mm-cta').forEach(function (a) {
  a.addEventListener('click', toggleMenu);
});

/* ── FOCUS TRAP UTILITY ── */
var _focusTrigger = null;
function trapFocus(container, e) {
  var focusable = container.querySelectorAll('button,a[href],input:not([tabindex="-1"]),img[tabindex]');
  if (!focusable.length) return;
  var first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first || !container.contains(document.activeElement)) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last || !container.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (mm && mm.classList.contains('open')) toggleMenu();
    var lbEsc = document.getElementById('lb');
    if (lbEsc && lbEsc.classList.contains('open')) closeLB();
  }
  var lbEl = document.getElementById('lb');
  if (lbEl && lbEl.classList.contains('open')) {
    if (e.key === 'ArrowLeft') navLB(-1);
    if (e.key === 'ArrowRight') navLB(1);
    if (e.key === 'Tab') trapFocus(lbEl, e);
  }
  if (mm && mm.classList.contains('open') && e.key === 'Tab') {
    trapFocus(mm, e);
  }
});

/* ── SMOOTH SCROLL — all anchor links ── */
document.querySelectorAll('a[href^="#"]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    var t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

/* ── REVEAL ON SCROLL — IntersectionObserver with stagger ── */
var revealObs = new IntersectionObserver(function (entries) {
  entries.forEach(function (e) {
    if (e.isIntersecting) { e.target.classList.add('vis'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0, rootMargin: '0px 0px 80px 0px' });

/* Form group staggered fade-in — when the contact form scrolls into
   view, each .form-group fades up sequentially via the .vis class
   (delays in CSS via :nth-of-type). One-shot per group. */
(function () {
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
    document.querySelectorAll('.form-group').forEach(function (g) { g.classList.add('vis'); });
    return;
  }
  var groups = document.querySelectorAll('.form-group');
  if (!groups.length) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('vis');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -40px 0px' });
  groups.forEach(function (g) { io.observe(g); });
})();

/* Results stat count-up animation — when the .results-stats element
   scrolls into view, the 50+ and 40+ numbers count up from 0 to
   their final value over ~1.2s with ease-out. The "1996" value
   doesn't count (year, not a quantity). Honours reduced-motion. */
(function () {
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  var stats = document.querySelector('.results-stats');
  if (!stats) return;
  var nums = stats.querySelectorAll('.results-stat-num');
  if (!nums.length) return;
  var animated = false;
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function animateCount() {
    if (animated) return;
    animated = true;
    nums.forEach(function (el) {
      var raw = el.textContent.trim();
      var match = raw.match(/^(\d+)/);
      if (!match) return;
      var target = parseInt(match[1], 10);
      if (target < 100) {
        var hasPlus = raw.indexOf('+') >= 0;
        var startTime = null;
        var duration = 1200;
        function tick(now) {
          if (!startTime) startTime = now;
          var progress = Math.min(1, (now - startTime) / duration);
          var value = Math.round(target * easeOut(progress));
          el.innerHTML = value + (hasPlus ? '<span class="results-stat-plus">+</span>' : '');
          if (progress < 1) requestAnimationFrame(tick);
        }
        el.innerHTML = '0' + (hasPlus ? '<span class="results-stat-plus">+</span>' : '');
        requestAnimationFrame(tick);
      }
    });
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { animateCount(); io.disconnect(); }
    });
  }, { threshold: 0.5 });
  io.observe(stats);
})();

/* Monument spotlight — about.html contest history page signature.
   As the user scrolls through the timeline, the monument closest to
   the viewport center gets a warm gold spotlight wash. Only one in
   focus at a time; transitions smoothly as the user scrolls. */
(function () {
  var monuments = document.querySelectorAll('.monument');
  if (!monuments.length) return;
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  var currentFocus = null;
  function onFocusScroll() {
    var viewportCenter = window.innerHeight / 2;
    var bestMatch = null;
    var bestDistance = Infinity;
    monuments.forEach(function (m) {
      var rect = m.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      var mCenter = rect.top + rect.height / 2;
      var d = Math.abs(mCenter - viewportCenter);
      if (d < bestDistance) {
        bestDistance = d;
        bestMatch = m;
      }
    });
    if (bestMatch !== currentFocus) {
      if (currentFocus) currentFocus.classList.remove('in-focus');
      if (bestMatch) bestMatch.classList.add('in-focus');
      currentFocus = bestMatch;
    }
  }
  var focusTicking = false;
  window.addEventListener('scroll', function () {
    if (focusTicking) return;
    focusTicking = true;
    requestAnimationFrame(function () {
      onFocusScroll();
      focusTicking = false;
    });
  }, { passive: true });
  onFocusScroll();
})();

document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale,.s-head').forEach(function (el, i) {
  var p = el.parentElement;
  var siblings = p ? Array.from(p.querySelectorAll(':scope > .reveal,:scope > .reveal-left,:scope > .reveal-right,:scope > .reveal-scale')) : [];
  var idx = siblings.indexOf(el);
  if (idx > 0) el.style.transitionDelay = (idx * 80) + 'ms';
  revealObs.observe(el);
});

/* ── BRAND REVEAL — two-phase credential sequence ── */
/* Activate post-reveal layers (grain, vignette, hero animation) */
function _activatePostReveal() {
  var grain = document.querySelector('.grain-ov');
  var vig = document.querySelector('.vignette');
  var heroBg = document.querySelector('.hero-bg-1');
  if (grain) grain.classList.add('active');
  if (vig) vig.classList.add('active');
  if (heroBg) heroBg.classList.add('active');
}
/* Position the brand reveal name phase so its "Big Mike Ely" lands
   at the exact same Y coordinate where the hero h1 will render.
   When the reveal fades out, the hero text underneath is already
   at the same spot — seamless handoff. Panel: "The big Mike Ely
   text needs to fade in and fade out as it moves the exact point
   Big Mike Ely is displayed on the hero screen." */
(function () {
  function alignBrandRevealToHero() {
    var hero = document.querySelector('.hero h1');
    var rev = document.querySelector('.br-name-phase');
    var name = document.getElementById('brName');
    if (!hero || !rev || !name) return;
    /* Neutralize the hero's entrance animation/transform while measuring —
       an entrance keyframe's initial translate otherwise reports the h1
       lower than where it finally renders, landing the reveal name low. */
    var _pa = hero.style.animation, _pt = hero.style.transform, _pr = hero.style.transition;
    hero.style.animation = 'none'; hero.style.transform = 'none'; hero.style.transition = 'none';
    var vh = window.innerHeight;
    var r = hero.getBoundingClientRect();
    if (vh <= 0 || r.height <= 0) return;
    var heroCenter = r.top + r.height / 2;
    /* Pass 1: put the phase center on the hero wordmark center. */
    var pct = (heroCenter / vh * 100);
    if (pct < 20) pct = 20;
    if (pct > 80) pct = 80;
    rev.style.top = pct.toFixed(3) + '%';
    /* Pass 2: the phase is a flex column (kicker above the name), so the NAME
       is not at the phase center. Measure the name and correct so the reveal
       "Big Mike Ely" lands exactly on the hero "BIG MIKE ELY". */
    var nr = name.getBoundingClientRect();
    if (nr.height > 0) {
      var corr = (heroCenter - (nr.top + nr.height / 2)) / vh * 100;
      rev.style.top = (pct + corr).toFixed(3) + '%';
    }
    hero.style.animation = _pa; hero.style.transform = _pt; hero.style.transition = _pr;
  }
  window._alignBR = alignBrandRevealToHero;
  /* Run at DOMContentLoaded + load so font metrics are final, and
     once more after fonts resolve to catch Cinzel width change. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', alignBrandRevealToHero, { once: true });
  } else {
    alignBrandRevealToHero();
  }
  window.addEventListener('load', alignBrandRevealToHero, { once: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(alignBrandRevealToHero).catch(function(){});
  }
})();

(function () {
  var br = document.getElementById('brandReveal');
  function _forceHeroVisible(){
    var h1 = document.querySelector('.hero h1');
    var sub = document.querySelector('.hero-sub');
    var ctas = document.querySelector('.hero-ctas');
    if (h1) h1.style.cssText += 'opacity:1!important;animation:none!important;animation-delay:0s!important';
    if (sub) sub.style.cssText += 'opacity:1!important;animation:none!important;animation-delay:0s!important';
    if (ctas) ctas.style.cssText += 'opacity:1!important;animation:none!important;animation-delay:0s!important';
  }
  if (!br) { _activatePostReveal(); _forceHeroVisible(); return; }

  /* Returning visitors: skip entirely. */
  if (localStorage.getItem('bm_revealed')) {
    br.remove();
    _activatePostReveal();
    _forceHeroVisible();
    return;
  }

  /* MOBILE + REDUCED-MOTION: skip the whole intro. A 13-second overlay
     animation is not appropriate on phones — it drops frames, overlaps
     hero content mid-transition, and made the first load feel broken.
     Panel override: restore brand reveal on mobile. Mobile runs a
     compressed ~3.8s sequence tuned to fit within the viewport. Desktop
     runs the full ~6.4s. Both one-time via bm_revealed localStorage. */
  var _isMobile = window.matchMedia('(max-width:900px)').matches;
  var _reduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (_reduced) {
    br.remove();
    _activatePostReveal();
    _forceHeroVisible();
    localStorage.setItem('bm_revealed', '1');
    return;
  }
  /* Mobile gets a scale marker so brand-reveal CSS can tighten
     fonts/positioning to fit the small viewport without clipping. */
  if (_isMobile) br.classList.add('br-mobile');

  /* Hard kill-switch: if the user taps or clicks anywhere during the
     intro, dismiss immediately. Also a hard 8-second absolute ceiling. */
  var _dismissed = false;
  function _dismiss() {
    if (_dismissed) return;
    _dismissed = true;
    try { br.style.animation = 'brExit .45s ease forwards'; } catch(_e){}
    setTimeout(function () {
      if (br.parentNode) br.remove();
      document.body.style.overflow = '';
      _activatePostReveal();
      _forceHeroVisible();
      localStorage.setItem('bm_revealed', '1');
    }, 480);
  }
  br.addEventListener('click', _dismiss, { once: true });
  br.addEventListener('touchstart', _dismiss, { once: true, passive: true });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') _dismiss();
  });

  /* Lock scrolling during brand reveal to prevent scroll-triggered crashes */
  document.body.style.overflow = 'hidden';

  var p1 = document.getElementById('brPhase1');
  var p2 = document.getElementById('brPhase2');

  /* Timings — mobile runs ~3.8s total, desktop runs ~6.4s.
     Compressing mobile by dropping each beat to ~60% duration while
     keeping the same 2-phase structure (credentials → name reveal). */
  /* Smoother, evenly-paced cadence (~500-600ms/beat) — the previous ~250-350ms
     spacing read as choppy/rushed at the start. */
  var T = _isMobile
    ? { p1: 150, first: 350, name: 1650, years: 2950, div: 4350, ol: 4650, p1out: 7100, p2in: 7600, exit: 9700, done: 10700 }
    : { p1: 200, first: 450, name: 1850, years: 3250, div: 4750, ol: 5050, p1out: 7700, p2in: 8200, exit: 10400, done: 11400 };

  function _show(id) { var e = document.getElementById(id); if (e) e.classList.add('vis'); }

  /* ── Phase 1: slow cinematic build — 1st Place → World Champion → 2024·2025 (together) → 2× Olympian ── */
  setTimeout(function () { if (!_dismissed && p1) p1.classList.add('vis'); }, T.p1);
  setTimeout(function () { if (!_dismissed) _show('br1st'); }, T.first);
  setTimeout(function () { if (!_dismissed) _show('brShowName'); }, T.name);
  setTimeout(function () { if (!_dismissed) { _show('brYear1'); _show('brYearDot'); _show('brYear2'); } }, T.years);
  setTimeout(function () { if (!_dismissed) _show('brDivider'); }, T.div);
  setTimeout(function () { if (!_dismissed) _show('brOlympian'); }, T.ol);
  /* Re-align the name phase to the hero right before the handoff, so any
     late layout shift (images, toolbar) can't leave it landing low. */
  setTimeout(function () { if (!_dismissed && typeof window._alignBR === 'function') window._alignBR(); }, T.p2in - 250);

  /* Phase 1 fades out, Phase 2 fades in */
  setTimeout(function () { if (!_dismissed && p1) { p1.classList.remove('vis'); p1.classList.add('out'); } }, T.p1out);
  setTimeout(function () { if (!_dismissed && p2) p2.classList.add('vis'); }, T.p2in);

  /* Exit animation begins */
  setTimeout(function () {
    if (_dismissed) return;
    try { br.style.animation = 'brExit 1s cubic-bezier(.3,0,.9,1) forwards'; } catch(_e){}
  }, T.exit);
  setTimeout(function () {
    if (_dismissed) return;
    _dismissed = true;
    if (br.parentNode) br.remove();
    document.body.style.overflow = '';
    _activatePostReveal();
    _forceHeroVisible();
    localStorage.setItem('bm_revealed', '1');
  }, T.done);

  /* ABSOLUTE CEILING — overlay is gone in 8 seconds no matter what. */
  setTimeout(function () {
    if (_dismissed) return;
    _dismiss();
  }, 13000);
})();

/* ── VIDEO FACADE — lazy-load YouTube on click ── */
function playVid(facade, vid) {
  var wrap = facade.parentElement;
  var iframe = document.createElement('iframe');
  iframe.src = 'https://www.youtube-nocookie.com/embed/' + vid + '?autoplay=1&rel=0&modestbranding=1';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.title = 'Video player';
  wrap.appendChild(iframe);
  facade.classList.add('loaded');
}

/* ── HERO SCROLL ARROW — hide on first scroll past 100px ── */
(function () {
  var arrow = document.getElementById('heroScroll');
  if (!arrow) return;
  /* Self-removing scroll listener: once the user has scrolled past
     100px we fade the arrow and REMOVE the listener entirely so
     there's zero ongoing cost for the rest of the session. */
  function onArrowScroll() {
    if (window.scrollY > 100) {
      arrow.style.opacity = '0';
      window.removeEventListener('scroll', onArrowScroll);
    }
  }
  window.addEventListener('scroll', onArrowScroll, { passive: true });
})();

/* ── PARALLAX ON SECTION AMBIENT IMAGES ──
   Subtle scroll-tied parallax with IntersectionObserver gating:
   only imgs currently intersecting the viewport are recomputed on
   scroll. Offscreen sections skip the layout-forcing
   getBoundingClientRect() read entirely. Honours reduced-motion
   AND disables on mobile (mobile GPU can't sustain it on top of
   the rest of the render load). */
(function () {
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  if (window.matchMedia('(max-width:900px)').matches) return;
  var imgs = Array.prototype.slice.call(document.querySelectorAll('.section-ambient-img'));
  if (!imgs.length) return;
  var visible = new Set();
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) visible.add(e.target);
      else visible.delete(e.target);
    });
  }, { rootMargin: '120px' });
  imgs.forEach(function (img) { io.observe(img); });

  var vh = window.innerHeight;
  var ticking = false;
  var shifts = new WeakMap();
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      vh = window.innerHeight;
      visible.forEach(function (img) {
        var rect = img.getBoundingClientRect();
        var center = rect.top + rect.height / 2;
        var dist = center - vh / 2;
        var shift = Math.max(-60, Math.min(60, dist * -0.06));
        var prev = shifts.get(img) || 0;
        if (Math.abs(shift - prev) > 0.5) {
          shifts.set(img, shift);
          img.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0) scale(1.02)';
        }
      });
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { vh = window.innerHeight; }, { passive: true });
  onScroll();
})();

/* ── BREATHING AMBIENT LIGHT ──
   Throttled to 100ms (10fps) — oscillation period is ~19.6s so 10fps
   is plenty. Previously ran at 60fps continuously (every rAF) just to
   set a single CSS variable. No-op if reduced motion or mobile. */
(function () {
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  if (window.matchMedia('(max-width:900px)').matches) return;
  var t0 = performance.now();
  var docEl = document.documentElement;
  setInterval(function () {
    var t = (performance.now() - t0) / 1000;
    var v = 0.85 + 0.15 * Math.sin(t * 0.32);
    docEl.style.setProperty('--ambient-breath', v.toFixed(3));
  }, 100);
})();

/* ── ACTIVE NAV SECTION — highlight current section link ── */
(function () {
  var links = document.querySelectorAll('[data-nav]');
  if (!links.length) return;
  var sections = [];
  links.forEach(function (a) {
    var id = a.getAttribute('href').replace('#', '');
    var el = document.getElementById(id);
    if (el) sections.push({ el: el, link: a });
  });
  var navObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var match = sections.find(function (s) { return s.el === e.target; });
      if (match) match.link.classList.toggle('active', e.isIntersecting);
    });
  }, { threshold: .2, rootMargin: '-80px 0px -40% 0px' });
  sections.forEach(function (s) { navObs.observe(s.el); });
})();

/* ── ACTIVE NAV PAGE — highlight the current page's nav link on
   multi-page navigations. Runs once on load. Pairs with the scrollspy
   above which handles same-page anchors. */
(function () {
  var path = (location.pathname || '').split('/').pop() || 'index.html';
  if (!path || path === '') path = 'index.html';
  var links = document.querySelectorAll('.nav-links a[href$=".html"], .mm-link[href$=".html"]');
  links.forEach(function (a) {
    var href = a.getAttribute('href') || '';
    if (href === path) a.classList.add('active');
  });
})();

/* ── NUMBER COUNTER — animate on scroll, easeOutCubic ── */
(function () {
  var counterObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target, end = parseInt(el.getAttribute('data-count'));
      if (isNaN(end)) return;
      counterObs.unobserve(el);
      var suffix = el.getAttribute('data-suffix') || '';

      /* Years > 1900: just fade in, don't count up */
      if (end > 1900) {
        el.textContent = end + suffix;
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        el.style.transition = 'opacity .8s var(--ease),transform .8s var(--ease)';
        requestAnimationFrame(function () { el.style.opacity = '1'; el.style.transform = 'none'; });
        return;
      }

      /* Animated count-up with easeOutCubic */
      var duration = end > 100 ? 2200 : 1800;
      var startTime = null;
      function step(ts) {
        if (!startTime) startTime = ts;
        var p = Math.min((ts - startTime) / duration, 1);
        p = 1 - Math.pow(1 - p, 3); /* easeOutCubic */
        el.textContent = Math.round(end * p) + suffix;
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = end + suffix;
      }
      requestAnimationFrame(step);
    });
  }, { threshold: .5 });
  document.querySelectorAll('.num-val[data-count]').forEach(function (el) { counterObs.observe(el); });
})();

/* ── LIGHTBOX — open, close, navigate, keyboard + touch ── */
var _lbImages = [], _lbIdx = 0;

function openLB(el) {
  var img = el.querySelector('img');
  if (!img || el.hasAttribute('data-no-lb')) return;
  _focusTrigger = document.activeElement;
  var allItems = document.querySelectorAll('.results-photo:not([data-no-lb]),.gal-item:not([data-no-lb]),.circle-photo:not([data-no-lb])');
  _lbImages = [];
  allItems.forEach(function (item) {
    var i = item.querySelector('img');
    if (i && i.src) {
      var cat = item.getAttribute('data-cat') || '';
      var label = item.querySelector('.gal-label,.results-photo-label,.circle-label');
      _lbImages.push({ src: i.src, alt: i.alt || '', cat: cat, label: label ? label.textContent : '' });
    }
  });
  _lbIdx = _lbImages.findIndex(function (x) { return x.src === img.src; });
  if (_lbIdx < 0) _lbIdx = 0;
  showLBImage();
  document.getElementById('lb').classList.add('open');
  document.body.style.overflow = 'hidden';
  var closeBtn = document.querySelector('.lb-close');
  if (closeBtn) closeBtn.focus();
}

function showLBImage() {
  var lbi = document.getElementById('lbImg');
  lbi.style.opacity = '0';
  lbi.style.transform = 'scale(.95)';
  /* Reset pinch zoom */
  _lbScale = 1;
  lbi.style.transform = 'scale(.95)';
  setTimeout(function () {
    var cur = _lbImages[_lbIdx];
    lbi.src = cur.src;
    lbi.alt = cur.alt;
    lbi.onload = function () { lbi.style.opacity = '1'; lbi.style.transform = 'scale(1)'; };
    document.getElementById('lbCounter').textContent = (_lbIdx + 1) + ' / ' + _lbImages.length;
    var catEl = document.getElementById('lbCat');
    if (catEl) {
      var catText = cur.label || (cur.cat ? cur.cat.charAt(0).toUpperCase() + cur.cat.slice(1) : '');
      catEl.textContent = catText;
      catEl.style.display = catText ? '' : 'none';
    }
    /* Preload adjacent images for instant navigation */
    var len = _lbImages.length;
    if (len > 1) {
      var next = _lbImages[(_lbIdx + 1) % len];
      var prev = _lbImages[(_lbIdx - 1 + len) % len];
      if (next) { var p1 = new Image(); p1.src = next.src; }
      if (prev) { var p2 = new Image(); p2.src = prev.src; }
    }
  }, 200);
}

var _lbNavLock = false;
function navLB(dir) {
  if (_lbNavLock) return;
  _lbNavLock = true;
  _lbIdx = (_lbIdx + dir + _lbImages.length) % _lbImages.length;
  showLBImage();
  setTimeout(function () { _lbNavLock = false; }, 350);
}

function closeLB() {
  var lb = document.getElementById('lb'), img = document.getElementById('lbImg');
  img.style.opacity = '0';
  img.style.transform = 'scale(0.92)';
  setTimeout(function () { lb.classList.remove('open'); document.body.style.overflow = ''; if (_focusTrigger) { _focusTrigger.focus(); _focusTrigger = null; } }, 250);
}

/* ── LIGHTBOX SWIPE — touch support ── */
(function () {
  var lb = document.getElementById('lb'), sx = 0, sy = 0;
  lb.addEventListener('touchstart', function (e) {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) navLB(1); else navLB(-1);
    } else if (Math.abs(dy) > 80) {
      closeLB();
    }
  });
})();

/* ── LIGHTBOX PINCH-TO-ZOOM — mobile gesture support ── */
var _lbScale = 1;
(function () {
  var wrap = document.getElementById('lbImgWrap');
  if (!wrap) return;
  var startDist = 0;
  var startScale = 1;

  function getDist(touches) {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  wrap.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      startDist = getDist(e.touches);
      startScale = _lbScale;
    }
  }, { passive: false });

  wrap.addEventListener('touchmove', function (e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var dist = getDist(e.touches);
      _lbScale = Math.min(4, Math.max(1, startScale * (dist / startDist)));
      var img = document.getElementById('lbImg');
      img.style.transform = 'scale(' + _lbScale + ')';
    }
  }, { passive: false });

  wrap.addEventListener('touchend', function () {
    if (_lbScale < 1.1) {
      _lbScale = 1;
      var img = document.getElementById('lbImg');
      img.style.transform = 'scale(1)';
    }
  });

  /* Double-tap to zoom toggle */
  var lastTap = 0;
  wrap.addEventListener('touchend', function (e) {
    if (e.touches.length > 0) return;
    var now = Date.now();
    if (now - lastTap < 300) {
      var img = document.getElementById('lbImg');
      _lbScale = _lbScale > 1.5 ? 1 : 2.5;
      img.style.transform = 'scale(' + _lbScale + ')';
    }
    lastTap = now;
  });
})();

/* ── GALLERY CATEGORY TABS — filter by data-cat ──
   Hidden items are taken out of the grid flow with `display:none` via
   the `.gal-out` class — no position:absolute race conditions, no
   setTimeout ordering bugs, no overlapping stacked items. A short
   opacity pre-fade plays on enter to keep the switch cinematic. */
var _galFilter = 'all';
var _galExpanded = false;
var _galLimit = 15;

(function () {
  var tabs = document.getElementById('galTabs');
  if (!tabs) return;
  var grid = document.getElementById('galGrid');
  if (!grid) return;

  function updateCounts() {
    var all = grid.querySelectorAll('.gal-item');
    var comp = 0, train = 0;
    all.forEach(function (item) {
      var cat = item.getAttribute('data-cat') || '';
      if (cat === 'competition') comp++;
      else if (cat === 'training') train++;
    });
    var cAll = document.getElementById('galCountAll');
    var cComp = document.getElementById('galCountCompetition');
    var cTrain = document.getElementById('galCountTraining');
    if (cAll) cAll.textContent = '(' + all.length + ')';
    if (cComp) cComp.textContent = '(' + comp + ')';
    if (cTrain) cTrain.textContent = '(' + train + ')';
  }

  window.filterGallery = function (cat) {
    if (cat === _galFilter) {
      /* Clicked the already-active tab — still reset view-all */
      _galExpanded = false;
      var btnLabel = document.querySelector('#galMore span');
      if (btnLabel) btnLabel.textContent = 'View All';
      applyGalLimit();
      return;
    }
    _galFilter = cat;
    /* Reset view-all so each tab starts capped at the page limit */
    _galExpanded = false;
    var gmSpan = document.querySelector('#galMore span');
    if (gmSpan) gmSpan.textContent = 'View All';
    /* Apply the single authoritative visibility pass */
    applyGalLimit();
    /* Brief fade-in on newly visible items */
    grid.querySelectorAll('.gal-item:not(.gal-out)').forEach(function (item) {
      item.classList.remove('gal-enter');
      /* force reflow so transition re-runs */
      void item.offsetWidth;
      item.classList.add('gal-enter');
    });
    /* Update tab active state */
    tabs.querySelectorAll('.gal-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-filter') === cat);
    });
    /* Keep the tabs visible after a filter switch so the user sees
       feedback without hunting for the grid. Soft-scroll to the tabs. */
    var tabsEl = document.getElementById('galTabs');
    if (tabsEl) {
      var tabTop = tabsEl.getBoundingClientRect().top + window.scrollY;
      var navH = 64;
      if (window.scrollY > tabTop - navH - 20) {
        window.scrollTo({ top: Math.max(0, tabTop - navH - 20), behavior: 'smooth' });
      }
    }
  };

  tabs.addEventListener('click', function (e) {
    var tab = e.target.closest('.gal-tab');
    if (!tab) return;
    window.filterGallery(tab.getAttribute('data-filter'));
  });

  /* Initial count + layout pass */
  updateCounts();
  applyGalLimit();

  /* Re-count after Supabase dynamic photos load */
  var counted = false;
  new MutationObserver(function () {
    if (!counted) { counted = true; setTimeout(function () { updateCounts(); applyGalLimit(); }, 500); }
  }).observe(grid, { childList: true });
})();

/* Single authoritative pass: decide visibility for every gal-item based on
   _galFilter + _galExpanded + _galLimit. Uses `gal-out` class (display:none)
   so hidden items cleanly exit the grid flow. */
function applyGalLimit() {
  var grid = document.getElementById('galGrid');
  if (!grid) return;
  var items = grid.querySelectorAll('.gal-item');
  var visibleCount = 0;
  var matchCount = 0;
  items.forEach(function (item) {
    var cat = item.getAttribute('data-cat') || '';
    var matchesFilter = (_galFilter === 'all') || (cat === _galFilter);
    if (!matchesFilter) {
      item.classList.add('gal-out');
      /* Clear any legacy inline styles from the old filter implementation */
      if (item.style.position) item.style.position = '';
      if (item.style.visibility) item.style.visibility = '';
      item.classList.remove('gal-overflow');
      return;
    }
    matchCount++;
    if (!_galExpanded && matchCount > _galLimit) {
      item.classList.add('gal-out');
      item.classList.add('gal-overflow');
    } else {
      item.classList.remove('gal-out');
      item.classList.remove('gal-overflow');
      if (item.style.position) item.style.position = '';
      if (item.style.visibility) item.style.visibility = '';
      visibleCount++;
    }
  });
  /* Show/hide the VIEW ALL button */
  var galMore = document.getElementById('galMore');
  if (galMore) {
    galMore.style.display = matchCount > _galLimit ? '' : 'none';
  }
}

function toggleGalExpand() {
  _galExpanded = !_galExpanded;
  var btn = document.querySelector('#galMore span');
  if (btn) btn.textContent = _galExpanded ? 'Show Less' : 'View All';
  applyGalLimit();
  if (!_galExpanded) {
    var tabsEl = document.getElementById('galTabs');
    if (tabsEl) {
      var tabTop = tabsEl.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, tabTop - 84), behavior: 'smooth' });
    }
  }
}

/* Apply initial limit */
applyGalLimit();

/* ── IMAGE LAZY LOAD — fade in on load ── */
document.querySelectorAll('img[loading="lazy"][decoding="async"]').forEach(function (img) {
  function markLoaded() {
    img.classList.add('loaded');
    /* Stop shimmer on parent for browsers without :has() support */
    var p = img.parentElement;
    if (p && (p.classList.contains('gal-item') || p.classList.contains('results-photo') || p.classList.contains('circle-photo'))) {
      p.style.animation = 'none';
      p.style.background = 'var(--card)';
    }
  }
  if (img.complete && img.naturalWidth) markLoaded();
  else img.addEventListener('load', markLoaded);
});

/* ── THEME — read from localStorage, apply crimson if set ── */
(function () {
  var raw = localStorage.getItem('fm_bm_website_theme');
  var t = raw ? JSON.parse(raw) : (localStorage.getItem('bm_website_theme') || 'gold');
  if (t === 'crimson') document.body.classList.add('theme-crimson');
})();

/* ── SUPABASE: THEME + CONTENT + GALLERY ──
   RECOVERY MODE: the remote backend is offline during recovery, so these
   optional remote-sync fetches are skipped to avoid console errors. The page
   falls back to its built-in defaults. Set BM_RECOVERY = false to re-enable. */
var BM_RECOVERY = true;
window.addEventListener('load', function () {
  if (BM_RECOVERY) return;
  var SUPA = 'https://ozgemcvnjzqfumpjxwcq.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Z2VtY3ZuanpxZnVtcGp4d2NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjMxNjEsImV4cCI6MjA5MTA5OTE2MX0.6PGWsz_1dRQNEqm1QvafihRWe_8TRTCoJ_aEA0OnY7k';
  var H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* Fetch remote theme setting */
  fetch(SUPA + '/rest/v1/app_settings?key=eq.website_theme&select=value', { headers: H })
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      if (rows && rows.length && rows[0].value) {
        if (rows[0].value === 'crimson') document.body.classList.add('theme-crimson');
        else document.body.classList.remove('theme-crimson');
      }
    }).catch(function () {});

  /* Fetch editable CTA content */
  fetch(SUPA + '/rest/v1/app_settings?key=eq.website_content&select=value', { headers: H })
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      if (!rows || !rows.length || !rows[0].value) return;
      var wc = rows[0].value;
      if (wc.ctaHeading) { var el = document.querySelector('[data-wc="cta-heading"]'); if (el) el.textContent = wc.ctaHeading; }
      if (wc.ctaButton) { var el = document.querySelector('[data-wc="cta-button"]'); if (el) el.textContent = wc.ctaButton; }
    }).catch(function () {});

  /* Fetch dynamic gallery photos */
  fetch(SUPA + '/rest/v1/app_settings?key=eq.gallery_photos&select=value', { headers: H })
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      if (!rows || !rows.length || !rows[0].value) return;
      var photos = rows[0].value.slice(0, 50), grid = document.getElementById('galGrid');
      if (!grid) return;
      for (var i = 0; i < photos.length; i++) {
        var p = photos[i];
        if (!/^https?:\/\//.test(p.url) && !/^img\//.test(p.url)) continue;
        var div = document.createElement('div');
        div.className = 'gal-item reveal vis';
        if (p.category) div.setAttribute('data-cat', p.category);
        div.setAttribute('onclick', 'openLB(this)');
        div.setAttribute('role', 'button');
        div.setAttribute('tabindex', '0');
        div.setAttribute('onkeydown', "if(event.key==='Enter'||event.key===' '){event.preventDefault();openLB(this)}");
        div.innerHTML = '<img src="' + esc(p.url) + '" alt="' + esc(p.label || 'Gallery photo') + '" loading="lazy" decoding="async"><div class="gal-label">' + esc(p.label || '') + '</div>';
        var img = div.querySelector('img');
        img.addEventListener('load', function () { this.classList.add('loaded'); });
        grid.appendChild(div);
      }
    }).catch(function () {});
});

/* ── PARALLAX + HERO FADE — depth layers ──
   Desktop-only. Mobile GPU can't sustain two scroll-tied transform
   layers (hero bg + cta bg) plus the section-ambient parallax plus
   the scroll progress bar plus the nav class toggle. Parallax is
   decorative, not functional — killing it on mobile removes the
   single largest ongoing scroll cost. */
(function () {
  if (window.matchMedia('(max-width:900px)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  var heroContent = document.querySelector('.hero-content');
  var heroBgs = document.querySelectorAll('.hero-bg');
  var ctaBg = document.querySelector('.cta-bg');
  var ticking = false;
  var heroReady = !!localStorage.getItem('bm_revealed');
  /* Wait until hero animations have played before enabling parallax (skip if returning visitor) */
  if (!heroReady) setTimeout(function () { heroReady = true; }, 13500);
  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        var s = window.scrollY;
        var vh = window.innerHeight;
        /* Only apply parallax within the hero viewport — skip everything once scrolled past */
        if (s < vh * 1.2) {
          if (heroReady && heroContent && s > 10) {
            var ratio = s / (vh * .6);
            heroContent.style.opacity = Math.max(0, 1 - ratio);
            heroContent.style.transform = 'translateY(' + (s * .25) + 'px)';
          } else if (heroReady && heroContent && s <= 10) {
            heroContent.style.opacity = '1';
            heroContent.style.transform = 'none';
          }
          if (heroBgs.length) {
            var bgDim = Math.max(.4, 1 - (s / vh) * .4);
            heroBgs.forEach(function(bg) { bg.style.opacity = (.92 * bgDim).toFixed(2); });
          }
        }
        /* CTA background parallax — only when near */
        if (ctaBg && ctaBg.parentElement) {
          var off = s - ctaBg.parentElement.offsetTop;
          if (Math.abs(off) < vh) ctaBg.style.transform = 'translateY(' + (off * .12) + 'px)';
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();

/* ── LAZY CTA BACKGROUND — load image when near viewport ──
   Owner-only asset for the pre-footer conversion moment. Each page
   can opt in with data-cta-bg="img/whatever.jpg" on the .cta-bg;
   falls back to the on-stage hero for the landing page. */
(function () {
  var ctaBg = document.querySelector('.cta-bg');
  if (!ctaBg) return;
  var src = ctaBg.getAttribute('data-cta-bg') || 'img/hero-stage-2025.jpg';
  var obs = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      var img = new Image();
      img.onload = function () {
        ctaBg.style.backgroundImage = "url('" + src + "')";
        ctaBg.classList.add('loaded');
      };
      img.src = src;
      obs.disconnect();
    }
  }, { rootMargin: '240px' });
  obs.observe(ctaBg);
})();

/* ── CONTACT FORM — POST to Supabase contact_inquiries ── */
var _contactLastSubmit=0;
function submitContactForm(e) {
  e.preventDefault();
  var hp = document.getElementById('cf-honeypot');
  if (hp && hp.value) { return false; }
  /* RECOVERY MODE: the inquiry inbox backend is offline, so don't fire a
     doomed POST. Required fields are already validated by the browser, so
     guide the visitor to the channel Mike actually checks today — DM. */
  if (BM_RECOVERY) {
    var rForm = document.getElementById('contactForm');
    var rName = (rForm && rForm.name && rForm.name.value || '').replace(/<[^>]*>/g, '').trim();
    var sentBox = document.getElementById('cf-sent');
    var sentName = document.getElementById('cf-sent-name');
    if (sentName && rName) { sentName.textContent = ', ' + rName.split(/\s+/)[0]; }
    if (rForm) { rForm.style.display = 'none'; }
    if (sentBox) {
      sentBox.style.display = 'block';
      sentBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return false;
  }
  /* Rate limit: 1 submission per 30 seconds */
  if(Date.now()-_contactLastSubmit<30000){alert("Please wait before submitting again.");return false;}
  _contactLastSubmit=Date.now();
  var form = document.getElementById('contactForm');
  var btn = form.querySelector('button[type="submit"]');
  var origText = btn.textContent;
  btn.textContent = 'Sending...';
  btn.disabled = true;

  /* Sanitize inputs — strip HTML tags */
  function sanitize(s) { return s.replace(/<[^>]*>/g, '').trim(); }
  var rowId = 'inq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  var data = {
    id: rowId,
    name: sanitize(form.name.value),
    contact: sanitize(form.contact.value),
    service: form.service.value,
    message: sanitize(form.message.value),
    status: 'new',
    submitted: new Date().toISOString()
  };

  var SUPA = 'https://ozgemcvnjzqfumpjxwcq.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Z2VtY3ZuanpxZnVtcGp4d2NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjMxNjEsImV4cCI6MjA5MTA5OTE2MX0.6PGWsz_1dRQNEqm1QvafihRWe_8TRTCoJ_aEA0OnY7k';

  fetch(SUPA + '/rest/v1/inbox', {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ id: rowId, data: data, updated_at: new Date().toISOString() })
  }).then(function (r) {
    if (r.ok) {
      btn.textContent = '\u2713 Sent';
      form.reset();
      setTimeout(function () { btn.textContent = origText; btn.disabled = false; }, 3000);
    } else {
      btn.textContent = 'Error \u2014 try Instagram';
      btn.disabled = false;
      setTimeout(function () { btn.textContent = origText; }, 3000);
    }
  }).catch(function () {
    btn.textContent = 'Error \u2014 try Instagram';
    btn.disabled = false;
    setTimeout(function () { btn.textContent = origText; }, 3000);
  });

  return false;
}

/* ── CONTACT: preselect service from ?service= deeplink (from services.html) ── */
(function () {
  var sel = document.getElementById('cf-service');
  if (!sel) return;
  try {
    var svc = new URLSearchParams(location.search).get('service');
    if (!svc) return;
    /* Tolerate legacy/aliased tokens */
    var map = { '1on1-training': 'training', 'contest-prep': 'contestprep', 'online-coaching': 'online', 'full-package': 'fullpackage', 'posing-sessions': 'posing' };
    svc = map[svc] || svc;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === svc) { sel.selectedIndex = i; break; }
    }
  } catch (e) {}
})();

/* ── STAGGERED GRID REVEALS — cascade items within grids ── */
(function () {
  var gridObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var items = e.target.querySelectorAll('.results-photo,.gal-item,.num-card,.svc');
      items.forEach(function (item, i) {
        item.style.opacity = '0';
        item.style.transform = 'translateY(30px)';
        item.style.transition = 'opacity .6s var(--ease), transform .6s var(--ease)';
        setTimeout(function () { item.style.opacity = '1'; item.style.transform = 'translateY(0)'; }, 80 * i);
      });
      gridObs.unobserve(e.target);
    });
  }, { threshold: .08 });
  document.querySelectorAll('.results-grid,.gal-grid,.num-grid,.svc-grid').forEach(function (g) { gridObs.observe(g); });
})();

/* ── CLICKABLE SERVICE CARDS — entire card triggers Book link ── */
document.querySelectorAll('.svc').forEach(function (card) {
  card.addEventListener('click', function (e) {
    if (e.target.closest('.svc-book')) return;
    var link = card.querySelector('.svc-book');
    if (link) link.click();
  });
});

/* ── SERVICE CARD 3D TILT + GLOW FOLLOW ── */
document.querySelectorAll('.svc').forEach(function (card) {
  var _svcTicking = false;
  card.addEventListener('mousemove', function (e) {
    if (_svcTicking) return;
    _svcTicking = true;
    requestAnimationFrame(function () {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var cx = rect.width / 2, cy = rect.height / 2;
      var rotY = ((x - cx) / cx) * 6;
      var rotX = ((cy - y) / cy) * 4;
      card.style.transform = 'perspective(800px) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg) translateY(-6px) scale(1.01)';
      var glow = card.querySelector('.svc-glow');
      if (glow) { glow.style.setProperty('--mx', x + 'px'); glow.style.setProperty('--my', y + 'px'); }
      _svcTicking = false;
    });
  });
  card.addEventListener('mouseleave', function () {
    card.style.transform = '';
  });
});

/* ── BUTTON GLOW FOLLOW + MAGNETIC PULL ── */
document.querySelectorAll('.btn-s').forEach(function (btn) {
  btn.addEventListener('mousemove', function (e) {
    var rect = btn.getBoundingClientRect();
    btn.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100) + '%');
    btn.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100) + '%');
  });
});
/* Magnetic pull on primary buttons */
document.querySelectorAll('.btn-p').forEach(function (btn) {
  if (btn.closest('.hero-ctas') || btn.closest('.cta-inner')) {
    btn.addEventListener('mousemove', function (e) {
      var rect = btn.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = (e.clientX - cx) * .12;
      var dy = (e.clientY - cy) * .12;
      btn.style.transform = 'translateY(-3px) scale(1.02) translate(' + dx + 'px,' + dy + 'px)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.transform = '';
    });
  }
});

/* ── SCROLL PROGRESS BAR — update width 0-100% based on scroll ── */
(function () {
  var bar = document.querySelector('.scroll-progress');
  if (!bar) {
    /* Create progress bar dynamically if not in HTML */
    bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.style.cssText = 'position:fixed;top:0;left:0;height:2px;width:0;background:var(--goldGrad);z-index:9999;transition:width .1s linear;pointer-events:none;box-shadow:0 0 8px var(--accGlow)';
    document.body.appendChild(bar);
  }
  /* rAF-gated so the DOM write happens at most once per frame, not
     per scroll event (which can fire more frequently on mobile). */
  var progTicking = false;
  window.addEventListener('scroll', function () {
    if (progTicking) return;
    progTicking = true;
    requestAnimationFrame(function () {
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docH > 0 ? (window.scrollY / docH) * 100 : 0;
      bar.style.width = Math.min(100, Math.max(0, pct)) + '%';
      progTicking = false;
    });
  }, { passive: true });
})();

/* ── SERVICE WORKER — register + force update on version change ── */
(function () {
  var SITE_VERSION = 'v9';
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      /* Force check for new SW on every page load */
      reg.update();
      /* When a new SW is waiting, tell it to activate immediately */
      if (reg.waiting) { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); }
      reg.addEventListener('updatefound', function () {
        var newSW = reg.installing;
        if (newSW) {
          newSW.addEventListener('statechange', function () {
            if (newSW.state === 'activated') {
              /* New SW active — reload once to get fresh content */
              if (localStorage.getItem('bm_sw_ver') !== SITE_VERSION) {
                localStorage.setItem('bm_sw_ver', SITE_VERSION);
                window.location.reload();
              }
            }
          });
        }
      });
    }).catch(function () {});
    /* If controller changes (new SW took over), reload to get fresh assets */
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (localStorage.getItem('bm_sw_ver') !== SITE_VERSION) {
        localStorage.setItem('bm_sw_ver', SITE_VERSION);
        window.location.reload();
      }
    });
  }
  /* Version mismatch without SW — force cache-bust reload once */
  if (localStorage.getItem('bm_sw_ver') !== SITE_VERSION) {
    localStorage.setItem('bm_sw_ver', SITE_VERSION);
  }
})();

/* ── Carbon-fiber/gold image fallback (VAS) ──────────────────────────────────
   Any <img> that fails to load is replaced with a premium carbon-fiber panel
   instead of a broken-image box. Capture-phase so it catches errors on images
   that fail before listeners attach. */
(function () {
  function bmFallback(img) {
    if (!img || img.dataset.bmFb) return;
    img.dataset.bmFb = '1';
    var d = document.createElement('div');
    d.className = 'bm-fallback ' + (img.className || '');
    d.setAttribute('role', 'img');
    d.setAttribute('aria-label', img.alt || 'Image unavailable');
    var ar = getComputedStyle(img).aspectRatio;
    d.style.cssText = 'width:100%;height:100%;min-height:120px;' + (ar && ar !== 'auto' ? 'aspect-ratio:' + ar + ';' : '');
    if (img.parentNode) img.replaceWith(d);
  }
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG') bmFallback(t);
  }, true);
})();

