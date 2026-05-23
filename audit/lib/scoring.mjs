// AUDIT v2 — Confidence/Quality scoring engine.
// Enforces the prime directive: nothing reaches "Assured" without proof.
import { CONFIDENCE_GATE, ENGINE_RESIDUAL_CAP, EVIDENCE_CEIL, Q_DIMENSIONS, qTargetFor } from "../config.mjs";

/**
 * Compute a Confidence score (0-100) for one finding/verdict.
 * @param {object} o
 *   tier: "T0"|"T1"|"T2"|"T3"   (evidence strength)
 *   reproduced: bool            (held across >=3 runs)
 *   refereeAgrees: bool|null    (fresh-eyes pass concurs)
 *   engineBound: bool           (Safari/Firefox/hardware dependent)
 *   artifacts: string[]         (paths to evidence; T>=1 requires >=1)
 */
export function confidence(o) {
  let c = EVIDENCE_CEIL[o.tier] ?? 0;
  if (o.tier !== "T0" && (!o.artifacts || o.artifacts.length === 0)) c = Math.min(c, EVIDENCE_CEIL.T0); // no artifact -> demote
  if (o.reproduced === false) c -= 30;
  if (o.refereeAgrees === false) c -= 20;
  if (o.engineBound) c = Math.min(c, ENGINE_RESIDUAL_CAP);
  return Math.max(0, Math.min(100, Math.round(c)));
}

/** Weighted Quality score from per-dimension 0-100 values. */
export function quality(dimScores, weights) {
  const w = weights || Object.fromEntries(Q_DIMENSIONS.map((d) => [d, 1]));
  let num = 0, den = 0;
  for (const d of Q_DIMENSIONS) {
    const v = dimScores[d];
    if (v == null) continue;
    num += v * (w[d] ?? 1);
    den += (w[d] ?? 1);
  }
  return den ? Math.round(num / den) : null;
}

/**
 * Resolve a verdict to a status bucket. Mechanical — no judgment.
 * @returns {"ASSURED"|"FIX_NOW"|"ELEVATE"|"HUMAN_QUEUE"}
 */
export function status({ page, pass, c, q, brandTaste, engineBound }) {
  if (brandTaste || engineBound || c < CONFIDENCE_GATE) return "HUMAN_QUEUE";
  if (pass === false) return "FIX_NOW";
  const target = qTargetFor(page);
  if (q != null && q < target) return "ELEVATE";
  return "ASSURED";
}

/** One finding record, fully scored + bucketed. */
export function record(f) {
  const c = confidence(f);
  const q = f.dimScores ? quality(f.dimScores, f.weights) : (f.q ?? null);
  const s = status({ page: f.page, pass: f.pass, c, q, brandTaste: f.brandTaste, engineBound: f.engineBound });
  return {
    id: f.id, segment: f.segment, page: f.page, device: f.device || null,
    title: f.title, severity: f.severity || null, verdict: f.pass === false ? "FAIL" : "PASS",
    confidence: c, quality: q, status: s,
    evidence: f.artifacts || [], note: f.note || "", fix: f.fix || null,
  };
}

export const isAssured = (r) => r.status === "ASSURED";
export const needsHuman = (r) => r.status === "HUMAN_QUEUE";
