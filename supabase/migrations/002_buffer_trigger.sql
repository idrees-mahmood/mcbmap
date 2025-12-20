-- =============================================================
-- Protest Impact Tracker - Buffer Geometry Trigger
-- =============================================================
-- Automatically calculates a 50-meter buffer around route geometry

-- Function to calculate buffer and update affected business counts
CREATE OR REPLACE FUNCTION calculate_route_buffer()
RETURNS TRIGGER AS $$
DECLARE
    buffer_dist INTEGER;
    retail_count INTEGER;
    hospitality_count INTEGER;
BEGIN
    -- Get buffer distance (default 50 meters)
    buffer_dist := COALESCE(NEW.buffer_distance_meters, 50);
    
    -- Calculate the buffer polygon around the route
    NEW.buffer_geometry := ST_Buffer(NEW.route_geometry, buffer_dist);
    
    -- Count retail businesses within the buffer
    SELECT COUNT(*) INTO retail_count
    FROM business_nodes bn
    WHERE bn.type = 'retail'
    AND ST_DWithin(bn.location, NEW.route_geometry, buffer_dist);
    
    -- Count hospitality businesses within the buffer
    SELECT COUNT(*) INTO hospitality_count
    FROM business_nodes bn
    WHERE bn.type = 'hospitality'
    AND ST_DWithin(bn.location, NEW.route_geometry, buffer_dist);
    
    NEW.affected_retail_count := retail_count;
    NEW.affected_hospitality_count := hospitality_count;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT
DROP TRIGGER IF EXISTS trigger_calculate_buffer_insert ON routes;
CREATE TRIGGER trigger_calculate_buffer_insert
    BEFORE INSERT ON routes
    FOR EACH ROW
    EXECUTE FUNCTION calculate_route_buffer();

-- Create trigger for UPDATE (when route_geometry changes)
DROP TRIGGER IF EXISTS trigger_calculate_buffer_update ON routes;
CREATE TRIGGER trigger_calculate_buffer_update
    BEFORE UPDATE OF route_geometry, buffer_distance_meters ON routes
    FOR EACH ROW
    WHEN (OLD.route_geometry IS DISTINCT FROM NEW.route_geometry 
          OR OLD.buffer_distance_meters IS DISTINCT FROM NEW.buffer_distance_meters)
    EXECUTE FUNCTION calculate_route_buffer();

-- Function to update timestamp on protests table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protests_updated_at ON protests;
CREATE TRIGGER trigger_protests_updated_at
    BEFORE UPDATE ON protests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
