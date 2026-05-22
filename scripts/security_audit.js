/*  CODE-LEVEL SECURITY AUDIT
    ────────────────────────────────────────────────────────────
    Panel spec:
      - XSS vectors (user input → innerHTML without esc)
      - Auth bypass (coach routes without auth check)
      - Data exposure
      - Input validation
      - Rate limiting (login, message send, file upload)
      - Secrets in client-side code
      - CORS configuration

    Not changing infrastructure, just scanning the code. */

const fs = require('fs');

const FILES = {
  app: '/home/user/bigmike/app.html',
  portal: '/home/user/bigmike/portal.html',
  book: '/home/user/bigmike/book.html',
  onboard: '/home/user/bigmike/onboard.html',
  site: '/home/user/bigmike/js/site.js',
  contact: '/home/user/bigmike/contact.html',
};

const findings = [];
function flag(severity, file, line, detail) {
  findings.push({ severity, file, line, detail });
}

// ── 1. XSS — unescaped user input in innerHTML ───────────────────
// Look for `.innerHTML = ...<userInput>...` patterns where the
// interpolated value is NOT wrapped in esc().
function scanXSS() {
  console.log('\n═══ 1. XSS SCAN ═══');
  for (const [name, path] of Object.entries(FILES)) {
    if (!fs.existsSync(path)) continue;
    const src = fs.readFileSync(path, 'utf8');
    const lines = src.split('\n');
    // Known user-input field sources
    const USER_SOURCES = [
      'm.text', 'c.name', 'c.email', 'c.phone', 'c.notes', 'c.goals',
      's.notes', 'ex.name', 'ex.notes', 'f.name', 'f.notes',
      'item.name', 'item.notes', 'mp.name', 'p.name', 'p.notes',
      'msg.text', 'notes', 'wd.name', 'wd.clientName',
      'data.name', 'data.email', 'data.message', 'input.value',
      'c.quickNotes', 'c.measurements',
    ];
    lines.forEach((line, i) => {
      // Find concat strings that contain innerHTML assignment or string building
      if (!/innerHTML|\+=|html\s*\+/.test(line)) return;
      // Skip comment lines
      if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) return;
      // For each known user source, check if it's used without esc()
      for (const src of USER_SOURCES) {
        const re = new RegExp('(?<!esc\\()(?<!esc\\(\\s*)' + src.replace('.', '\\.') + '(?!\\))', 'g');
        if (re.test(line) && line.indexOf('esc(' + src) < 0) {
          // More strict: check if this line actually concatenates the source into HTML
          if (/['"`][^'"`]*['"`]\s*\+\s*[^']*\b/.test(line) || /innerHTML/.test(line)) {
            // Verify the source appears between quotes (meaning it's being interpolated)
            // Final check: line contains both the source AND a quote AND a plus
            const idx = line.indexOf(src);
            const nearPlus = line.substring(Math.max(0, idx - 20), Math.min(line.length, idx + src.length + 20));
            if (/\+/.test(nearPlus)) {
              flag('P1', name, i + 1, 'potential unescaped user input: ' + src + ' — "' + line.trim().substring(0, 100) + '"');
              break;
            }
          }
        }
      }
    });
  }
}

// ── 2. Auth bypass check ─────────────────────────────────────────
function scanAuth() {
  console.log('\n═══ 2. AUTH BYPASS SCAN ═══');
  // Coach app: check that auth screen / lock screen gate exists on boot
  const app = fs.readFileSync(FILES.app, 'utf8');
  const hasAuthScreen = /function showAuthScreen|#authScreen/.test(app);
  const hasLockScreen = /function showLockScreen|#lockScreen/.test(app);
  const hasAuthGate = /fm_supabase_auth|fm_coach_authed|checkSupabaseAuth/.test(app);
  if (!hasAuthScreen) flag('P0', 'app', 0, 'no showAuthScreen function — auth bypass risk');
  else console.log('  ✓ showAuthScreen present');
  if (!hasLockScreen) flag('P1', 'app', 0, 'no showLockScreen function — PIN gate may be missing');
  else console.log('  ✓ showLockScreen present');
  if (!hasAuthGate) flag('P0', 'app', 0, 'no auth-gate state check on boot');
  else console.log('  ✓ auth-gate state check present');
  // Portal: verify pin verify edge function is called
  const portal = fs.readFileSync(FILES.portal, 'utf8');
  const hasPinVerify = /verify-pin|submitPinEnter/.test(portal);
  if (!hasPinVerify) flag('P0', 'portal', 0, 'no verify-pin edge function call — client portal unauthenticated');
  else console.log('  ✓ verify-pin call present');
}

// ── 3. Secrets in client-side code ────────────────────────────────
function scanSecrets() {
  console.log('\n═══ 3. SECRETS SCAN ═══');
  const SECRET_PATTERNS = [
    { re: /sk_live_[a-zA-Z0-9]{20,}/, name: 'Stripe secret live key' },
    { re: /sk_test_[a-zA-Z0-9]{20,}/, name: 'Stripe secret test key' },
    { re: /AIza[0-9A-Za-z-_]{35}/, name: 'Google API key' },
    { re: /AKIA[0-9A-Z]{16}/, name: 'AWS access key' },
    { re: /service_role/, name: 'Supabase service_role (should never be client-side)' },
    { re: /twilio.*auth.*token/i, name: 'Twilio auth token' },
    { re: /private.*key.*-----BEGIN/, name: 'Private key' },
    { re: /VAPID_PRIVATE_KEY/, name: 'VAPID private key' },
  ];
  // Known-safe public values
  const PUBLIC_OK = [
    /eyJhbGci[A-Za-z0-9_-]+\.eyJpc3Mi[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,  // Supabase anon JWT — public by design
  ];
  for (const [name, path] of Object.entries(FILES)) {
    if (!fs.existsSync(path)) continue;
    const src = fs.readFileSync(path, 'utf8');
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.re.test(line)) {
          // Skip if it's a known-safe pattern
          let safe = false;
          for (const ok of PUBLIC_OK) if (ok.test(line)) safe = true;
          if (!safe) flag('P0', name, i + 1, 'possible secret: ' + pattern.name);
        }
      }
    });
  }
  console.log('  ' + findings.filter(f => f.detail.indexOf('possible secret') >= 0).length + ' secret candidates flagged');
}

// ── 4. Rate limiting on critical actions ─────────────────────────
function scanRateLimits() {
  console.log('\n═══ 4. RATE-LIMIT SCAN ═══');
  const app = fs.readFileSync(FILES.app, 'utf8');
  const portal = fs.readFileSync(FILES.portal, 'utf8');
  const site = fs.readFileSync(FILES.site, 'utf8');
  // Critical actions that should have a lock / debounce / rate limit
  const critical = [
    { name: 'Coach login (app signInWithPassword)', re: /sb\.auth\.signInWithPassword/, requires: /disabled|throttl|rate|Lock/ },
    { name: 'Portal PIN verify', re: /verify-pin/, requires: /locked|lockedUntil|pinAttempts|_attempts/ },
    { name: 'Portal message send', re: /sendPortalMessage/, requires: /_portalSending|disabled/ },
    { name: 'Coach message single send', re: /sendCoachMessage/, requires: /_msgSendLock/ },
    { name: 'Coach blast message', re: /sendBlastMessage/, requires: /_blastLock/ },
    { name: 'Wizard send to client', re: /wizSendToClient/, requires: /_wizSendLock/ },
    { name: 'Contact form submit', re: /submitContactForm/, requires: /_contactLastSubmit|throttl|30000/ },
    { name: 'Check-in submit', re: /function submitCheckin/, requires: /btn\.disabled/ },
  ];
  for (const check of critical) {
    const sources = [app, portal, site];
    const names = ['app', 'portal', 'site'];
    let foundIn = -1;
    for (let s = 0; s < sources.length; s++) {
      if (check.re.test(sources[s])) { foundIn = s; break; }
    }
    if (foundIn < 0) {
      console.log('  ?? ' + check.name + ' — function not found (may be renamed)');
      continue;
    }
    const src = sources[foundIn];
    if (!check.requires.test(src)) {
      flag('P1', names[foundIn], 0, 'rate limit missing on: ' + check.name);
    } else {
      console.log('  ✓ ' + check.name + ' protected');
    }
  }
}

// ── 5. CSP / CORS headers ────────────────────────────────────────
function scanCSP() {
  console.log('\n═══ 5. CSP / META SCAN ═══');
  for (const [name, path] of Object.entries(FILES)) {
    if (!fs.existsSync(path) || !path.endsWith('.html')) continue;
    const src = fs.readFileSync(path, 'utf8');
    const hasCSP = /Content-Security-Policy/.test(src);
    const hasXCTO = /X-Content-Type-Options/.test(src);
    const hasReferrer = /referrer/.test(src);
    const hasPermissions = /Permissions-Policy/.test(src);
    const score = [hasCSP, hasXCTO, hasReferrer, hasPermissions].filter(Boolean).length;
    console.log('  ' + name.padEnd(10) + ' CSP:' + (hasCSP ? '✓' : '✗') + ' XCTO:' + (hasXCTO ? '✓' : '✗') + ' ref:' + (hasReferrer ? '✓' : '✗') + ' perms:' + (hasPermissions ? '✓' : '✗'));
    if (!hasCSP) flag('P1', name, 0, 'no Content-Security-Policy meta tag');
  }
}

// ── 6. Input validation on forms ─────────────────────────────────
function scanInputValidation() {
  console.log('\n═══ 6. INPUT VALIDATION SCAN ═══');
  const onboard = fs.readFileSync(FILES.onboard, 'utf8');
  const book = fs.readFileSync(FILES.book, 'utf8');
  const portal = fs.readFileSync(FILES.portal, 'utf8');
  const app = fs.readFileSync(FILES.app, 'utf8');
  // Check: phone-like fields have some kind of digit check
  const hasPhoneValidation = (src) => /phone.*replace.*\\D|\/\\d|isValidPhone/.test(src);
  if (hasPhoneValidation(onboard)) console.log('  ✓ onboard.html phone validation');
  else flag('P2', 'onboard', 0, 'onboarding form lacks visible phone validation');
  if (hasPhoneValidation(book)) console.log('  ✓ book.html phone validation');
  else flag('P2', 'book', 0, 'booking form lacks visible phone validation');
  if (hasPhoneValidation(portal)) console.log('  ✓ portal.html phone validation');
  else flag('P2', 'portal', 0, 'portal login lacks visible phone validation');
  // Message length caps
  const hasMsgCap = /2000|maxlength="2000"|length.*2000/;
  if (hasMsgCap.test(app)) console.log('  ✓ coach message length cap');
  else flag('P2', 'app', 0, 'coach message send has no length cap');
  if (hasMsgCap.test(portal)) console.log('  ✓ portal message length cap');
  else flag('P2', 'portal', 0, 'portal message send has no length cap');
}

(async () => {
  scanXSS();
  scanAuth();
  scanSecrets();
  scanRateLimits();
  scanCSP();
  scanInputValidation();

  console.log('\n══════════ SECURITY AUDIT RESULTS ══════════\n');
  const bySev = { P0: [], P1: [], P2: [], P3: [] };
  findings.forEach(f => bySev[f.severity].push(f));
  for (const sev of ['P0', 'P1', 'P2', 'P3']) {
    if (!bySev[sev].length) continue;
    console.log(sev + ' (' + bySev[sev].length + '):');
    bySev[sev].slice(0, 20).forEach(f => console.log('  ' + f.file + ':' + f.line + ' — ' + f.detail));
    if (bySev[sev].length > 20) console.log('  ... +' + (bySev[sev].length - 20) + ' more');
  }
  console.log('\nTotal: P0=' + bySev.P0.length + ' P1=' + bySev.P1.length + ' P2=' + bySev.P2.length);
  fs.writeFileSync('/tmp/security_audit.json', JSON.stringify(findings, null, 2));
  process.exit(bySev.P0.length > 0 ? 1 : 0);
})();
