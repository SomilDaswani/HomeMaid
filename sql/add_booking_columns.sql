-- Add missing columns to bookings table for Quick Service integration
-- Run this in Supabase SQL Editor

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source text DEFAULT 'standard';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS agreed_price numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS qs_request_id uuid REFERENCES quick_service_requests(id);

-- Update agreed_price from total_price for existing rows
UPDATE bookings SET agreed_price = total_price WHERE agreed_price IS NULL AND total_price IS NOT NULL;
