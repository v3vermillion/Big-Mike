CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach full access" ON messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read messages" ON messages
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert messages" ON messages
  FOR INSERT TO anon WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages ((data->>'clientId'));
