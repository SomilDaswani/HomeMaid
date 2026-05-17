-- Run this first in Supabase SQL editor
-- Enable PostGIS for spatial queries and uuid-ossp for UUID generation

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;
