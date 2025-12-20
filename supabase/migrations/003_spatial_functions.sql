-- =============================================================
-- Protest Impact Tracker - Spatial Analysis Functions
-- =============================================================

-- Function: Get all business nodes with extracted coordinates
-- This is used by the client for point-in-polygon counting
CREATE OR REPLACE FUNCTION get_all_business_nodes()
RETURNS TABLE (
    id UUID,
    name TEXT,
    type TEXT,
    subtype TEXT,
    lng FLOAT,
    lat FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bn.id,
        bn.name,
        bn.type,
        bn.subtype,
        ST_X(bn.location::GEOMETRY) as lng,
        ST_Y(bn.location::GEOMETRY) as lat
    FROM business_nodes bn;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Count all businesses within a route's buffer zone
CREATE OR REPLACE FUNCTION count_businesses_in_buffer(route_uuid UUID)
RETURNS TABLE (
    total_count BIGINT,
    retail_count BIGINT,
    hospitality_count BIGINT,
    other_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE bn.type = 'retail') as retail_count,
        COUNT(*) FILTER (WHERE bn.type = 'hospitality') as hospitality_count,
        COUNT(*) FILTER (WHERE bn.type = 'other') as other_count
    FROM business_nodes bn
    JOIN routes r ON r.id = route_uuid
    WHERE ST_DWithin(bn.location, r.buffer_geometry, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Count businesses within a bounding box (for coverage checking)
CREATE OR REPLACE FUNCTION count_businesses_in_bbox(
    min_lng FLOAT,
    min_lat FLOAT,
    max_lng FLOAT,
    max_lat FLOAT
)
RETURNS BIGINT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM business_nodes bn
        WHERE ST_X(bn.location::GEOMETRY) BETWEEN min_lng AND max_lng
          AND ST_Y(bn.location::GEOMETRY) BETWEEN min_lat AND max_lat
    );
END;
$$ LANGUAGE plpgsql STABLE;


-- Function: Get baseline footfall for a protest (matching day of week and time range)
CREATE OR REPLACE FUNCTION get_baseline_for_protest(protest_uuid UUID)
RETURNS TABLE (
    location_name TEXT,
    avg_score NUMERIC,
    point_count BIGINT
) AS $$
DECLARE
    protest_day TEXT;
    protest_start INTEGER;
    protest_end INTEGER;
    protest_route GEOGRAPHY;
BEGIN
    -- Get protest details
    SELECT 
        TO_CHAR(p.event_date, 'Day'),
        EXTRACT(HOUR FROM p.start_time)::INTEGER,
        EXTRACT(HOUR FROM p.end_time)::INTEGER,
        r.buffer_geometry
    INTO protest_day, protest_start, protest_end, protest_route
    FROM protests p
    LEFT JOIN routes r ON r.protest_id = p.id
    WHERE p.id = protest_uuid;
    
    -- Trim the day name
    protest_day := TRIM(protest_day);
    
    RETURN QUERY
    SELECT 
        fb.location_name,
        AVG(fb.avg_footfall_score)::NUMERIC as avg_score,
        COUNT(*) as point_count
    FROM footfall_baseline fb
    WHERE fb.day_of_week = protest_day
    AND fb.hour_of_day >= protest_start
    AND fb.hour_of_day <= protest_end
    AND (protest_route IS NULL OR ST_DWithin(fb.location_point, protest_route, 0))
    GROUP BY fb.location_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get impact statistics for a protest
CREATE OR REPLACE FUNCTION get_protest_impact_stats(protest_uuid UUID)
RETURNS TABLE (
    protest_name TEXT,
    event_date DATE,
    route_distance_km NUMERIC,
    buffer_area_sq_km NUMERIC,
    affected_businesses BIGINT,
    affected_retail BIGINT,
    affected_hospitality BIGINT,
    avg_baseline_score NUMERIC,
    baseline_data_points BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as protest_name,
        p.event_date,
        ROUND((r.route_distance_meters / 1000)::NUMERIC, 2) as route_distance_km,
        ROUND((ST_Area(r.buffer_geometry::GEOMETRY) / 1000000)::NUMERIC, 4) as buffer_area_sq_km,
        (r.affected_retail_count + r.affected_hospitality_count)::BIGINT as affected_businesses,
        r.affected_retail_count::BIGINT as affected_retail,
        r.affected_hospitality_count::BIGINT as affected_hospitality,
        COALESCE((SELECT AVG(avg_score) FROM get_baseline_for_protest(protest_uuid)), 0) as avg_baseline_score,
        COALESCE((SELECT SUM(point_count) FROM get_baseline_for_protest(protest_uuid)), 0) as baseline_data_points
    FROM protests p
    LEFT JOIN routes r ON r.protest_id = p.id
    WHERE p.id = protest_uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get businesses affected by a specific protest
CREATE OR REPLACE FUNCTION get_affected_businesses(protest_uuid UUID)
RETURNS TABLE (
    business_id UUID,
    business_name TEXT,
    business_type TEXT,
    business_subtype TEXT,
    distance_from_route NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bn.id as business_id,
        bn.name as business_name,
        bn.type as business_type,
        bn.subtype as business_subtype,
        ROUND(ST_Distance(bn.location, r.route_geometry)::NUMERIC, 2) as distance_from_route
    FROM business_nodes bn
    JOIN routes r ON r.protest_id = protest_uuid
    WHERE ST_DWithin(bn.location, r.buffer_geometry, 0)
    ORDER BY distance_from_route ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get footfall heatmap data for a specific day and time range
CREATE OR REPLACE FUNCTION get_footfall_heatmap(
    target_day TEXT,
    start_hour INTEGER DEFAULT 0,
    end_hour INTEGER DEFAULT 23
)
RETURNS TABLE (
    location_name TEXT,
    longitude FLOAT,
    latitude FLOAT,
    avg_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fb.location_name,
        ST_X(fb.location_point::GEOMETRY) as longitude,
        ST_Y(fb.location_point::GEOMETRY) as latitude,
        AVG(fb.avg_footfall_score)::NUMERIC as avg_score
    FROM footfall_baseline fb
    WHERE fb.day_of_week = target_day
    AND fb.hour_of_day >= start_hour
    AND fb.hour_of_day <= end_hour
    GROUP BY fb.location_name, fb.location_point;
END;
$$ LANGUAGE plpgsql STABLE;
