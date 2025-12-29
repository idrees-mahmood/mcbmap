-- Migration: Add opening_hours column and expand business type to include 'commercial'
-- Run this in Supabase SQL Editor

-- 1. Add opening_hours column to store OSM opening_hours tag
ALTER TABLE business_nodes ADD COLUMN IF NOT EXISTS opening_hours TEXT;

-- 2. Drop existing type constraint
ALTER TABLE business_nodes DROP CONSTRAINT IF EXISTS business_nodes_type_check;

-- 3. Add new constraint including 'commercial' type
ALTER TABLE business_nodes ADD CONSTRAINT business_nodes_type_check 
    CHECK (type IN ('retail', 'hospitality', 'commercial', 'other'));

-- 4. Add index for type-based queries
CREATE INDEX IF NOT EXISTS idx_business_type_subtype ON business_nodes (type, subtype);

-- 5. Comment explaining the types
COMMENT ON COLUMN business_nodes.type IS 'Business category: retail (shops), hospitality (restaurants, cafes, bars), commercial (offices, banks, gyms), other';
COMMENT ON COLUMN business_nodes.opening_hours IS 'OSM opening_hours tag value, e.g. "Mo-Fr 09:00-17:00; Sa 10:00-14:00"';
