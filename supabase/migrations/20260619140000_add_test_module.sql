-- Add IELTS skill module to tests (reading, writing, listening)

ALTER TABLE tests ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'reading'
  CHECK (module IN ('reading', 'writing', 'listening'));
