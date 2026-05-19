-- Homeowners table for phone number collection
CREATE TABLE IF NOT EXISTS homeowners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text UNIQUE NOT NULL,
  session_id text,
  created_at timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now()
);

-- Add homeowner columns to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS homeowner_id uuid REFERENCES homeowners(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS homeowner_phone text;

-- Disable RLS for hackathon
ALTER TABLE homeowners DISABLE ROW LEVEL SECURITY;
