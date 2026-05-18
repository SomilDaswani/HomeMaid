-- Fix seed maid base_rates to realistic Karachi market values
-- Run this once against your Supabase database

-- Fix base_rate by skill level
UPDATE public.maids SET
  base_rate = CASE skill_level
    WHEN 'basic' THEN 400
    WHEN 'intermediate' THEN 550
    WHEN 'expert' THEN 750
    ELSE 450
  END,
  rate_min = CASE skill_level
    WHEN 'basic' THEN 300
    WHEN 'intermediate' THEN 450
    WHEN 'expert' THEN 650
    ELSE 350
  END,
  rate_max = CASE skill_level
    WHEN 'basic' THEN 600
    WHEN 'intermediate' THEN 800
    WHEN 'expert' THEN 1100
    ELSE 700
  END
WHERE base_rate > 1000 OR base_rate < 200 OR rate_min < 200 OR rate_max > 1500;

-- Also fix any maids that still have childcare in their service_types
UPDATE public.maids SET
  service_types = array_remove(service_types, 'childcare')
WHERE 'childcare' = ANY(service_types);
