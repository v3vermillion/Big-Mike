-- =============================================
-- SECURITY MIGRATION - Run this in Supabase SQL Editor
-- Locks down client medical/pharmaceutical data
-- =============================================

-- 1. REMOVE DANGEROUS ANON POLICIES
-- These allowed anyone to read ALL client data (including anabolics, peptides)
DROP POLICY IF EXISTS "anon_read_clients" ON clients;
DROP POLICY IF EXISTS "anon_update_clients" ON clients;

-- Remove unnecessary anon read on sessions (not used by booking/portal)
DROP POLICY IF EXISTS "anon_read_sessions" ON sessions;

-- Remove anon update on bookings (portal doesn't need to update bookings)
DROP POLICY IF EXISTS "anon_update_bookings" ON bookings;

-- 2. KEEP NECESSARY ANON POLICIES (booking portal needs these)
-- anon_read_schedule - booking portal reads available slots (KEEP)
-- anon_write_schedule - booking portal creates new bookings (KEEP)
-- anon_update_schedule - portal cancellations need this (KEEP)
-- anon_write_clients - booking portal creates new clients (KEEP)
-- anon_write_bookings - booking portal logs bookings (KEEP)
-- anon_read_bookings - booking portal checks existing bookings (KEEP)
-- anon_read_settings - booking portal reads availability config (KEEP)

-- 3. ADD AUTHENTICATED POLICIES (for coach app after Supabase Auth login)
-- Coach gets full access to everything when authenticated

CREATE POLICY "auth_all_clients" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_sessions" ON sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_schedule" ON schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_templates" ON templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_meal_plans" ON meal_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_programs" ON programs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_workouts" ON workouts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_bookings" ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_settings" ON app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
