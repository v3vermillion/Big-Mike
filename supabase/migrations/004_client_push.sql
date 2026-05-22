CREATE TABLE IF NOT EXISTS client_push_subs (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE client_push_subs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach full access" ON client_push_subs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon upsert subs" ON client_push_subs
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update subs" ON client_push_subs
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon read subs" ON client_push_subs
  FOR SELECT TO anon USING (true);
