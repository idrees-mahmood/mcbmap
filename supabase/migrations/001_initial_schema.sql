-- =============================================================
-- Protest Impact Tracker - Initial Database Schema
-- =============================================================
-- Run this in your Supabase SQL Editor

-- 1. Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Protests Table: Stores the manual inputs for each demonstration
CREATE TABLE IF NOT EXISTS protests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    start_location GEOGRAPHY(POINT, 4326) NOT NULL,
    end_location GEOGRAPHY(POINT, 4326) NOT NULL,
    start_address TEXT,  -- Human-readable start address
    end_address TEXT,    -- Human-readable end address
    attendees_estimate INTEGER,
    police_data_link TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Routes Table: Stores the calculated geometry from OSRM
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protest_id UUID REFERENCES protests(id) ON DELETE CASCADE,
    route_geometry GEOGRAPHY(LINESTRING, 4326) NOT NULL, -- The walking path
    buffer_geometry GEOGRAPHY(POLYGON, 4326),            -- The "Impact Zone" (e.g. 50m buffer)
    buffer_distance_meters INTEGER DEFAULT 50,
    affected_retail_count INTEGER DEFAULT 0,
    affected_hospitality_count INTEGER DEFAULT 0,
    route_distance_meters NUMERIC,
    route_duration_seconds NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Footfall_Baseline Table: Stores "Business as Usual" data
-- Source: GLA High Street Data or Google Popular Times averages
CREATE TABLE IF NOT EXISTS footfall_baseline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_name TEXT, -- e.g. "Oxford Circus", "Trafalgar Square"
    location_point GEOGRAPHY(POINT, 4326) NOT NULL,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    avg_footfall_score INTEGER CHECK (avg_footfall_score >= 0 AND avg_footfall_score <= 100), -- 0-100 normalized
    raw_footfall_value NUMERIC, -- Original value before normalization
    source TEXT DEFAULT 'GLA_OPEN_DATA',
    source_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(location_name, day_of_week, hour_of_day, source)
);

-- 5. Business_Nodes Table: Stores shops/cafes for correlation analysis
CREATE TABLE IF NOT EXISTS business_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    type TEXT CHECK (type IN ('retail', 'hospitality', 'other')),
    subtype TEXT, -- e.g. 'cafe', 'restaurant', 'shop', 'supermarket'
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    osm_id BIGINT UNIQUE, -- To prevent duplicates from OpenStreetMap
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for spatial queries
CREATE INDEX IF NOT EXISTS idx_protests_start_location ON protests USING GIST (start_location);
CREATE INDEX IF NOT EXISTS idx_protests_end_location ON protests USING GIST (end_location);
CREATE INDEX IF NOT EXISTS idx_routes_route_geometry ON routes USING GIST (route_geometry);
CREATE INDEX IF NOT EXISTS idx_routes_buffer_geometry ON routes USING GIST (buffer_geometry);
CREATE INDEX IF NOT EXISTS idx_footfall_location ON footfall_baseline USING GIST (location_point);
CREATE INDEX IF NOT EXISTS idx_business_location ON business_nodes USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_footfall_day_hour ON footfall_baseline (day_of_week, hour_of_day);
CREATE INDEX IF NOT EXISTS idx_business_type ON business_nodes (type);

-- Row Level Security (RLS) - Enable for all tables
ALTER TABLE protests ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE footfall_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_nodes ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access for now (public dashboard)
CREATE POLICY "Allow anonymous read on protests" ON protests FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read on routes" ON routes FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read on footfall_baseline" ON footfall_baseline FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read on business_nodes" ON business_nodes FOR SELECT USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated insert on protests" ON protests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on protests" ON protests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on protests" ON protests FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on routes" ON routes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on routes" ON routes FOR UPDATE TO authenticated USING (true);
