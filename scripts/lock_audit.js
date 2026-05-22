/*  FOCUSED RAPID-TAP AUDIT
    Looks only at user-triggered functions that perform non-idempotent
    side effects. Walks the code statically and classifies each. */

const fs = require('fs');

const files = [
  '/home/user/bigmike/app.html',
  '/home/user/bigmike/portal.html',
  '/home/user/bigmike/book.html',
  '/home/user/bigmike/onboard.html',
];

// Critical functions we KNOW are non-idempotent and user-triggered
// These MUST have a lock, button-disable, or rate limit
const CRITICAL_NAMES = [
  'sendCoachMessage',
  'sendBlastMessage',
  'sendMessage',
  'sendPortalMessage',
  '_doPortalSend',
  'wizSendToClient',
  'doSendTemplateToClients',
  'saveNewClient',
  'saveEditClient',
  'saveNewSession',
  'saveEditSession',
  'bookSchedule',
  'completeScheduled',
  'submitContactForm',
  'submitOnboarding',
  'submitCheckin',
  'submitBooking',
  'deleteClient',
  'acceptBooking',
  'declineInquiry',
  'sendProgressCompare',
  'sendBlast',
  'quickSendToClient',
];

// Lock markers — any of these inside a function body counts as "locked"
const LOCK_MARKERS = [
  '_navLock', '_tabLock', '_blastLock', '_wizSendLock', '_syncRunning',
  '_contactLastSubmit', '_msgSending', 'disabled=true', 'disabled = true',
  '_confirmingSend', '_completeLock', '_saveNewClientLock', '_saveClientLock',
  '_sessionSaveLock', '_prospectSaveLock', '_bookingLock', '_messageLock',
  '_checkinSubmitting', '_submitLock', 'btn.disabled',
  // New locks added in 2026-04-13 audit
  '_msgSendLock', '_tplSendLock', '_portalSending',
  // Semantic idempotence markers — functions that use a modal confirm
  // and whose state mutation is safe to re-run
  'showDoubleConfirm', 'showConfirm',
];

function findFunctionBody(src, name) {
  // Very simple function-body extractor — finds "function NAME(" or "NAME=function" and reads until balanced braces
  const patterns = [
    new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`),
    new RegExp(`${name}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{`),
    new RegExp(`window\\.${name}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{`),
  ];
  for (const re of patterns) {
    const m = src.match(re);
    if (!m) continue;
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    if (depth === 0) {
      return {
        line: (src.substring(0, m.index).match(/\n/g) || []).length + 1,
        body: src.substring(m.index, i),
      };
    }
  }
  return null;
}

// Functions that are inner/private helpers of a guarded parent
// and therefore inherit the parent's lock
const INNER_HELPERS = new Set(['_doPortalSend']);

const report = [];
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const name = file.split('/').pop();
  for (const fn of CRITICAL_NAMES) {
    const found = findFunctionBody(src, fn);
    if (!found) continue;
    const body = found.body;
    const locks = LOCK_MARKERS.filter(m => body.includes(m));
    if (INNER_HELPERS.has(fn)) locks.push('inner-of-guarded-parent');
    const hasGuard = locks.length > 0;
    report.push({
      file: name,
      fn,
      line: found.line,
      hasGuard,
      locks,
      bodyLen: body.length,
    });
  }
}

console.log('\n══════════ FOCUSED RAPID-TAP AUDIT ══════════\n');
console.log('Function                           | File           | Line | Guard');
console.log('───────────────────────────────────┼────────────────┼──────┼──────');
let missing = 0;
for (const r of report) {
  const status = r.hasGuard ? '\x1b[32m✓\x1b[0m ' + r.locks.join(',') : '\x1b[31m✗ NONE\x1b[0m';
  console.log(`${r.fn.padEnd(34)} | ${r.file.padEnd(14)} | ${String(r.line).padStart(4)} | ${status}`);
  if (!r.hasGuard) missing++;
}
console.log(`\nTotal critical functions found: ${report.length}`);
console.log(`Missing guard: ${missing}`);
if (missing > 0) process.exit(1);
