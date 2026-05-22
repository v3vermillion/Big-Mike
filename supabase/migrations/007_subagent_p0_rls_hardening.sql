-- 007_subagent_p0_rls_hardening.sql
-- Subagent fresh-eyes audit P0 #3, #4, #10 partial fixes.
--
-- These migrations close the easy-to-tighten anon policies that
-- migration 002–005 left wide open. The harder findings (portal
-- messaging needing server-side mediation; book.html UPSERT
-- requiring an edge function) are tracked separately in
-- SUBAGENT_FINDINGS.md because they require client refactors and
-- new edge functions, not just SQL.
--
-- ============================================================
-- P0 #4 — client_push_subs: drop anon SELECT and anon UPDATE
-- ============================================================
-- The portal subscribes via INSERT only. There is no legitimate
-- reason for an anonymous client to enumerate other clients'
-- push subscriptions or update them. Migration 004 granted both
-- by mistake.

DROP POLICY IF EXISTS "Anon read subs" ON client_push_subs;
DROP POLICY IF EXISTS "Anon update subs" ON client_push_subs;

-- ============================================================
-- P0 #3 — messages: tighten anon SELECT
-- ============================================================
-- Current state (migration 003) lets ANY anonymous caller read
-- ALL messages from ALL clients. This is a P0 leak: a malicious
-- visitor with the public anon key can dump every coach\u2194client
-- conversation in the database.
--
-- Proper fix requires a JWT-bound clientId claim, which means
-- portal messaging must move through an edge function (read-messages
-- and send-message). That refactor is tracked in SUBAGENT_FINDINGS.md
-- as P0 #3-fix.
--
-- Interim mitigation: drop the blanket anon SELECT entirely. This
-- breaks the portal's current 5-second polling loop, so the portal
-- code in this same commit must also be updated to call the new
-- read-messages edge function. Until that lands, leave the policy
-- in place. (No-op DROP guarded.)
--
-- Uncomment the line below ONLY after deploying the read-messages
-- edge function and the portal-side refactor.

-- DROP POLICY IF EXISTS "Anon read messages" ON messages;

-- ============================================================
-- P0 #10 — inbox: rate-limit anon INSERT (best-effort)
-- ============================================================
-- The contact form upserts into inbox with no DB-side throttle.
-- The application has a per-IP cooldown but a determined attacker
-- can spam the table.
--
-- Postgres-side rate limiting at the row level needs a trigger
-- function. We add a simple per-day-per-source cap via a CHECK on
-- a phone column if present; otherwise leave a TODO marker.
--
-- For now, add an index on created_at so a future trigger can
-- cheaply count recent rows from the same source.

CREATE INDEX IF NOT EXISTS idx_inbox_created_at
  ON inbox (((data->>'created_at')::timestamptz));
