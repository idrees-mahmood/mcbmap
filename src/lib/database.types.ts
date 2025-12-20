// Database types generated from Supabase schema
// These match the tables defined in the SQL migrations

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            protests: {
                Row: {
                    id: string
                    name: string
                    event_date: string
                    start_time: string
                    end_time: string
                    start_location: unknown // PostGIS Geography type
                    end_location: unknown
                    start_address: string | null
                    end_address: string | null
                    attendees_estimate: number | null
                    police_data_link: string | null
                    notes: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    event_date: string
                    start_time: string
                    end_time: string
                    start_location: unknown
                    end_location: unknown
                    start_address?: string | null
                    end_address?: string | null
                    attendees_estimate?: number | null
                    police_data_link?: string | null
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    event_date?: string
                    start_time?: string
                    end_time?: string
                    start_location?: unknown
                    end_location?: unknown
                    start_address?: string | null
                    end_address?: string | null
                    attendees_estimate?: number | null
                    police_data_link?: string | null
                    notes?: string | null
                    updated_at?: string
                }
            }
            routes: {
                Row: {
                    id: string
                    protest_id: string
                    route_geometry: unknown
                    buffer_geometry: unknown | null
                    buffer_distance_meters: number
                    affected_retail_count: number
                    affected_hospitality_count: number
                    route_distance_meters: number | null
                    route_duration_seconds: number | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    protest_id: string
                    route_geometry: unknown
                    buffer_geometry?: unknown | null
                    buffer_distance_meters?: number
                    affected_retail_count?: number
                    affected_hospitality_count?: number
                    route_distance_meters?: number | null
                    route_duration_seconds?: number | null
                    created_at?: string
                }
                Update: {
                    protest_id?: string
                    route_geometry?: unknown
                    buffer_geometry?: unknown | null
                    buffer_distance_meters?: number
                    affected_retail_count?: number
                    affected_hospitality_count?: number
                    route_distance_meters?: number | null
                    route_duration_seconds?: number | null
                }
            }
            footfall_baseline: {
                Row: {
                    id: string
                    location_name: string | null
                    location_point: unknown
                    day_of_week: string
                    hour_of_day: number
                    avg_footfall_score: number | null
                    raw_footfall_value: number | null
                    source: string
                    source_date: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    location_name?: string | null
                    location_point: unknown
                    day_of_week: string
                    hour_of_day: number
                    avg_footfall_score?: number | null
                    raw_footfall_value?: number | null
                    source?: string
                    source_date?: string | null
                    created_at?: string
                }
                Update: {
                    location_name?: string | null
                    location_point?: unknown
                    day_of_week?: string
                    hour_of_day?: number
                    avg_footfall_score?: number | null
                    raw_footfall_value?: number | null
                    source?: string
                    source_date?: string | null
                }
            }
            business_nodes: {
                Row: {
                    id: string
                    name: string | null
                    type: 'retail' | 'hospitality' | 'other'
                    subtype: string | null
                    location: unknown
                    osm_id: number | null
                    address: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    name?: string | null
                    type: 'retail' | 'hospitality' | 'other'
                    subtype?: string | null
                    location: unknown
                    osm_id?: number | null
                    address?: string | null
                    created_at?: string
                }
                Update: {
                    name?: string | null
                    type?: 'retail' | 'hospitality' | 'other'
                    subtype?: string | null
                    location?: unknown
                    osm_id?: number | null
                    address?: string | null
                }
            }
        }
        Functions: {
            count_businesses_in_buffer: {
                Args: { route_uuid: string }
                Returns: {
                    total_count: number
                    retail_count: number
                    hospitality_count: number
                    other_count: number
                }[]
            }
            get_baseline_for_protest: {
                Args: { protest_uuid: string }
                Returns: {
                    location_name: string
                    avg_score: number
                    point_count: number
                }[]
            }
            get_protest_impact_stats: {
                Args: { protest_uuid: string }
                Returns: {
                    protest_name: string
                    event_date: string
                    route_distance_km: number
                    buffer_area_sq_km: number
                    affected_businesses: number
                    affected_retail: number
                    affected_hospitality: number
                    avg_baseline_score: number
                    baseline_data_points: number
                }[]
            }
            get_footfall_heatmap: {
                Args: {
                    target_day: string
                    start_hour?: number
                    end_hour?: number
                }
                Returns: {
                    location_name: string
                    longitude: number
                    latitude: number
                    avg_score: number
                }[]
            }
        }
    }
}

// Convenience types
export type Protest = Database['public']['Tables']['protests']['Row']
export type ProtestInsert = Database['public']['Tables']['protests']['Insert']
export type Route = Database['public']['Tables']['routes']['Row']
export type FootfallBaseline = Database['public']['Tables']['footfall_baseline']['Row']
export type BusinessNode = Database['public']['Tables']['business_nodes']['Row']

// GeoJSON types for map rendering
export interface ProtestWithRoute extends Protest {
    route?: {
        geometry: GeoJSON.LineString
        buffer: GeoJSON.Polygon
        distance_meters: number
        duration_seconds: number
        affected_retail: number
        affected_hospitality: number
    }
}

export interface MapPoint {
    lng: number
    lat: number
}

export interface ProtestFormData {
    name: string
    event_date: string
    start_time: string
    end_time: string
    start_point: MapPoint
    end_point: MapPoint
    start_address?: string
    end_address?: string
    attendees_estimate?: number
    notes?: string
}
