-- =============================================
-- BIG MIKE ELY COACHING LAB - DATABASE SETUP
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SCHEDULE TABLE
CREATE TABLE IF NOT EXISTS schedule (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. MEAL PLANS TABLE
CREATE TABLE IF NOT EXISTS meal_plans (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PROGRAMS TABLE
CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. WORKOUTS TABLE
CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. APP SETTINGS TABLE (key-value store)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'
);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- BOOKING PORTAL (anon key) policies
CREATE POLICY "anon_read_schedule" ON schedule FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_schedule" ON schedule FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_schedule" ON schedule FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_read_clients" ON clients FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_clients" ON clients FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_clients" ON clients FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_write_bookings" ON bookings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_bookings" ON bookings FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_read_bookings" ON bookings FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_settings" ON app_settings FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_sessions" ON sessions FOR SELECT TO anon USING (true);
