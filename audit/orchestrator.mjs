// AUDIT v2 — orchestrator. One command, resumable, save-as-you-go.
//   node audit/orchestrator.mjs            # full sweep (resumes if interrupted)
//   node audit/orchestrator.mjs --wave 5   # one wave
//   node audit/orchestrator.mjs --segment W5-portal
//   node audit/orchestrator.mjs --fresh    # ignore checkpoint, start over
//
// Each segment writes a checkpoint and regenerates the dashboard, so a long
// sweep can be stopped and resumed without losing graded work. The per-segment
// probe bodies live in lib/segments/<id>.mjs (added as each wave is executed);
// a missing probe records a PENDING row rather than crashing — so the framework
// runs end-to-end today and fills in as the approved sweep proceeds.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { SEGMENTS, WAVES, SITE_ROOT } from "./config.mjs";

const REPORTS = SITE_ROOT + "/audit/reports";
const CKPT = REPORTS + "/checkpoint.json";
const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? (process.argv[i + 1] || true) : null; };
const has = (k) => process.argv.includes(k);

mkdirSync(REPORTS, { recursive: true });

let ckpt = (!has("--fresh") && existsSync(CKPT)) ? JSON.parse(readFileSync(CKPT, "utf8"))
  : { started: new Date().toISOString(), segments: {}, findings: [] };
const save = () => writeFileSync(CKPT, JSON.stringify(ckpt, null, 2));

// Select segments to run this invocation.
let todo = SEGMENTS;
if (arg("--wave")) todo = todo.filter((s) => String(s.wave) === String(arg("--wave")));
if (arg("--segment")) todo = todo.filter((s) => s.id === arg("--segment"));
if (has("--resume")) todo = todo.filter((s) => !ckpt.segments[s.id]?.done);

// Run a single inherited v1 harness, capturing pass/fail signal.
function runInherited(name) {
  try {
    const out = execSync(`NODE_PATH=/opt/node22/lib/node_modules node ${SITE_ROOT}/scripts/${name}.js`,
      { encoding: "utf8", timeout: 180000, stdio: ["ignore", "pipe", "pipe"] });
    return { ok: !/FAIL|✗|Error/i.test(out), tail: out.trim().split("\n").slice(-3).join(" | ") };
  } catch (e) { return { ok: false, tail: (e.stdout || e.message || "").toString().slice(-200) }; }
}

// Dynamic probe loader: lib/segments/<id>.mjs exporting default async (segment, ctx) => findings[]
async function probeFor(seg) {
  const p = `${SITE_ROOT}/audit/lib/segments/${seg.id}.mjs`;
  if (!existsSync(p)) return null;
  return (await import("file://" + p + "?t=" + Date.now())).default;
}

async function runSegment(seg) {
  process.stdout.write(`\n▶ ${seg.id}  ${seg.title}\n`);
  const findings = [];
  // 1) inherited v1 harnesses
  for (const h of (seg.inherits || [])) {
    const r = runInherited(h);
    findings.push({ id: `${seg.id}:${h}`, segment: seg.id, title: `inherited harness ${h}`,
      pass: r.ok, tier: r.ok ? "T3" : "T2", reproduced: true, refereeAgrees: null,
      artifacts: [`scripts/${h}.js`], note: r.tail });
    console.log(`   ${r.ok ? "✓" : "✗"} ${h}: ${r.tail}`);
  }
  // 2) v2 probe (if authored for this segment)
  const probe = await probeFor(seg);
  if (probe) {
    try { findings.push(...await probe(seg, { BASE_URL: "http://localhost:8099" })); }
    catch (e) { findings.push({ id: `${seg.id}:probe-error`, segment: seg.id, title: "probe crashed",
      pass: false, tier: "T1", note: e.message, artifacts: [] }); }
  } else {
    findings.push({ id: `${seg.id}:pending`, segment: seg.id, title: "deep probe pending (framework stub)",
      pass: null, tier: "T0", note: "Authored during the approved sweep.", artifacts: [] });
  }
  ckpt.segments[seg.id] = { done: true, at: new Date().toISOString(), count: findings.length };
  ckpt.findings = ckpt.findings.filter((f) => f.segment !== seg.id).concat(findings);
  save();
  await regenReports();
}

// ── report generation ────────────────────────────────────────────────────────
async function regenReports() {
  const { record } = await import("./lib/scoring.mjs");
  const scored = ckpt.findings.map((f) => (f.pass === null ? { ...mkPending(f) } : record({ ...f, page: f.page })));
  const tally = scored.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
  const pendingWaves = WAVES.map((w) => {
    const segs = SEGMENTS.filter((s) => s.wave === w);
    const done = segs.filter((s) => ckpt.segments[s.id]?.done).length;
    return `Wave ${w}: ${done}/${segs.length} segments`;
  }).join(" · ");

  const dash = [
    "# AUDIT v2 — Live Dashboard",
    `_Updated ${new Date().toISOString()}_`, "",
    `**Progress:** ${pendingWaves}`, "",
    "| Status | Count |", "|---|---:|",
    ...["ASSURED", "FIX_NOW", "ELEVATE", "HUMAN_QUEUE", "PENDING"].map((s) => `| ${s} | ${tally[s] || 0} |`),
    "", "## Findings", "",
    "| Seg | Title | Verdict | C | Q | Status |", "|---|---|---|--:|--:|---|",
    ...scored.map((r) => `| ${r.segment} | ${trunc(r.title)} | ${r.verdict || "-"} | ${r.confidence ?? "-"} | ${r.quality ?? "-"} | ${r.status} |`),
  ].join("\n");
  writeFileSync(REPORTS + "/DASHBOARD.md", dash);

  writeFileSync(REPORTS + "/HUMAN_QUEUE.md", [
    "# 🧍 Human Queue — items requiring your manual verification",
    "_Anything below 95 confidence, engine/hardware-bound, or brand-taste._", "",
    ...scored.filter((r) => r.status === "HUMAN_QUEUE").map((r) => `- **${r.segment}** — ${r.title} (C=${r.confidence ?? "-"})${r.note ? " — " + r.note : ""}`),
  ].join("\n") || "# Human Queue\n(empty)");

  writeFileSync(REPORTS + "/PUNCHLIST.md", [
    "# Punch list — actionable findings", "",
    ...scored.filter((r) => r.status === "FIX_NOW" || r.status === "ELEVATE")
      .map((r) => `- [${r.status}] **${r.segment}** — ${r.title}${r.fix ? " → " + r.fix : ""}`),
  ].join("\n") || "# Punch list\n(none yet)");
}
const mkPending = (f) => ({ segment: f.segment, title: f.title, verdict: "-", confidence: null, quality: null, status: "PENDING", note: f.note, evidence: [] });
const trunc = (s) => (s && s.length > 48 ? s.slice(0, 47) + "…" : s || "");

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`AUDIT v2 — ${todo.length} segment(s) queued${has("--resume") ? " (resume)" : ""}`);
  for (const seg of todo) await runSegment(seg);
  await regenReports();
  console.log(`\n✔ Done. See audit/reports/DASHBOARD.md`);
})();
