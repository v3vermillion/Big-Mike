-- 006_schedule_unique_slot.sql
-- Subagent fresh-eyes audit P0 #6: prevent double-booking races.
--
-- Background: schedule rows are JSONB blobs. Two clients can hit
-- "Book Tuesday 6 AM" in the exact same moment and the application's
-- in-memory conflict check (`isSlotTaken`) cannot detect a collision
-- before its sibling upsert lands. Without a database-level guard
-- the second writer simply lands a duplicate row and Mike now has
-- two clients fighting over the same slot.
--
-- The fix: a partial unique index keyed on (date, time) for any
-- schedule row that has a non-null clientId. Blocked-time rows
-- (which have no client) are intentionally excluded so Mike can
-- still stack a personal block on top of an existing entry without
-- the index rejecting it. The application catches the unique-violation
-- (Postgres SQLSTATE 23505) and surfaces a "slot just got booked"
-- toast so the racing client retries the slot picker.

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_unique_slot
  ON schedule ((data->>'date'), (data->>'time'))
  WHERE (data->>'clientId') IS NOT NULL
    AND (data->>'clientId') <> '';
