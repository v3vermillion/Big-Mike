-- ============================================================
-- RLS LOCKDOWN: Restrict anon access to coach-only tables
-- Run this in Supabase SQL Editor to secure the database.
--
-- After applying: only authenticated coach (via app.html) can
-- read/write client data. The anon key (exposed in page source)
-- can only access schedule/bookings/app_settings with limits.
-- ============================================================

-- Drop the wide-open "Allow all" policies
DROP POLICY IF EXISTS "Allow all" ON clients;
DROP POLICY IF EXISTS "Allow all" ON sessions;
DROP POLICY IF EXISTS "Allow all" ON schedule;
DROP POLICY IF EXISTS "Allow all" ON templates;
DROP POLICY IF EXISTS "Allow all" ON meal_plans;
DROP POLICY IF EXISTS "Allow all" ON programs;
DROP POLICY IF EXISTS "Allow all" ON workouts;
DROP POLICY IF EXISTS "Allow all" ON app_settings;
DROP POLICY IF EXISTS "Allow all" ON bookings;
DROP POLICY IF EXISTS "Allow all" ON app_state;

-- ── COACH-ONLY TABLES (require Supabase auth) ──
-- Only the authenticated coach can read/write these tables.
-- The anon key CANNOT access them at all.

CREATE POLICY "Coach full access" ON clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Coach full access" ON sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Coach full access" ON templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Coach full access" ON meal_plans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Coach full access" ON programs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Coach full access" ON workouts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Coach full access" ON app_state
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── SCHEDULE: Coach full access, anon limited ──
-- Anon can only SELECT (for booking availability) and INSERT (new bookings).
-- Cannot UPDATE or DELETE (prevents unauthorized cancellations).

CREATE POLICY "Coach full access" ON schedule
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon read schedule" ON schedule
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon insert schedule" ON schedule
  FOR INSERT TO anon WITH CHECK (true);

-- ── BOOKINGS: Anon can only INSERT ──
CREATE POLICY "Coach full access" ON bookings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon insert bookings" ON bookings
  FOR INSERT TO anon WITH CHECK (true);

-- ── APP SETTINGS: Anon read-only for themes/availability ──
CREATE POLICY "Coach full access" ON app_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon read settings" ON app_settings
  FOR SELECT TO anon USING (true);
