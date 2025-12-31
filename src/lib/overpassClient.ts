/**
 * Overpass API Client for Dynamic Business Fetching
 * ==================================================
 * Fetches retail and hospitality POIs from OpenStreetMap via Overpass API
 * for areas not already covered in the database.
 */

import { supabase } from './supabase'
import type { BusinessNode } from './businessCounter'

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter'

// OSM amenity tags for hospitality (used in type detection)
const HOSPITALITY_TAGS = ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court', 'biergarten']

interface OverpassElement {
    type: 'node' | 'way' | 'relation'
    id: number
    lat?: number
    lon?: number
    center?: { lat: number; lon: number }
    tags?: {
        name?: string
        shop?: string
        amenity?: string
        [key: string]: string | undefined
    }
}

interface OverpassResponse {
    elements: OverpassElement[]
}

/**
 * Build Overpass QL query for a bounding box
 */
function buildOverpassQuery(bbox: { south: number; west: number; north: number; east: number }): string {
    const { south, west, north, east } = bbox
    const bboxStr = `${south},${west},${north},${east}`

    // Query for shops (retail), hospitality amenities, and commercial establishments
    return `
[out:json][timeout:30];
(
  // Retail - all shops
  node["shop"](${bboxStr});
  way["shop"](${bboxStr});
  
  // Hospitality - restaurants, cafes, bars, pubs
  node["amenity"~"restaurant|cafe|bar|pub|fast_food|food_court|biergarten"](${bboxStr});
  way["amenity"~"restaurant|cafe|bar|pub|fast_food|food_court|biergarten"](${bboxStr});
  
  // Commercial - offices
  node["office"](${bboxStr});
  way["office"](${bboxStr});
  
  // Commercial - banks, post offices, clinics
  node["amenity"~"bank|bureau_de_change|post_office|clinic|dentist"](${bboxStr});
  way["amenity"~"bank|bureau_de_change|post_office|clinic|dentist"](${bboxStr});
  
  // Commercial - gyms and leisure
  node["leisure"~"fitness_centre|gym|sports_centre"](${bboxStr});
  way["leisure"~"fitness_centre|gym|sports_centre"](${bboxStr});
);
out center;
`.trim()
}

/**
 * Parse Overpass API response into BusinessNode format
 */
function parseOverpassResponse(elements: OverpassElement[]): Omit<BusinessNode, 'id'>[] {
    const businesses: Omit<BusinessNode, 'id'>[] = []

    // Tags that indicate commercial amenities
    const COMMERCIAL_AMENITY_TAGS = ['bank', 'bureau_de_change', 'post_office', 'clinic', 'dentist']
    const COMMERCIAL_LEISURE_TAGS = ['fitness_centre', 'gym', 'sports_centre']

    for (const element of elements) {
        // Get coordinates (node has lat/lon, way has center)
        const lat = element.lat ?? element.center?.lat
        const lon = element.lon ?? element.center?.lon

        if (!lat || !lon) continue

        const tags = element.tags || {}

        // Determine type and subtype
        let type: 'retail' | 'hospitality' | 'commercial' | 'other' = 'other'
        let subtype: string | null = null

        if (tags.shop) {
            type = 'retail'
            subtype = tags.shop
        } else if (tags.amenity && HOSPITALITY_TAGS.includes(tags.amenity)) {
            type = 'hospitality'
            subtype = tags.amenity
        } else if (tags.office) {
            type = 'commercial'
            subtype = tags.office
        } else if (tags.amenity && COMMERCIAL_AMENITY_TAGS.includes(tags.amenity)) {
            type = 'commercial'
            subtype = tags.amenity
        } else if (tags.leisure && COMMERCIAL_LEISURE_TAGS.includes(tags.leisure)) {
            type = 'commercial'
            subtype = tags.leisure
        }

        businesses.push({
            name: tags.name || null,
            type,
            subtype,
            lng: lon,
            lat,
            opening_hours: tags.opening_hours || null
        })
    }

    return businesses
}

/**
 * Fetch businesses from Overpass API for a bounding box
 */
export async function fetchBusinessesFromOverpass(
    bbox: { south: number; west: number; north: number; east: number }
): Promise<Omit<BusinessNode, 'id'>[]> {
    console.log(`[Overpass] Fetching POIs for bbox: [${bbox.west.toFixed(4)}, ${bbox.south.toFixed(4)}] to [${bbox.east.toFixed(4)}, ${bbox.north.toFixed(4)}]`)

    const query = buildOverpassQuery(bbox)

    try {
        const response = await fetch(OVERPASS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `data=${encodeURIComponent(query)}`
        })

        if (!response.ok) {
            throw new Error(`Overpass API error: ${response.status} ${response.statusText}`)
        }

        const data: OverpassResponse = await response.json()
        console.log(`[Overpass] Received ${data.elements.length} elements from API`)

        const businesses = parseOverpassResponse(data.elements)
        console.log(`[Overpass] Parsed ${businesses.length} businesses (${businesses.filter(b => b.type === 'retail').length} retail, ${businesses.filter(b => b.type === 'hospitality').length} hospitality)`)

        return businesses

    } catch (error) {
        console.error('[Overpass] Failed to fetch from Overpass API:', error)
        return []
    }
}

/**
 * Insert businesses into Supabase database
 * Uses insert with conflict handling since we don't have a unique OSM ID column
 */
export async function insertBusinessesToSupabase(
    businesses: Omit<BusinessNode, 'id'>[]
): Promise<number> {
    if (businesses.length === 0) return 0

    console.log(`[Overpass] Inserting ${businesses.length} businesses into Supabase...`)

    // Convert to database format with WKT location and opening_hours
    const records = businesses.map(b => ({
        name: b.name,
        type: b.type,
        subtype: b.subtype,
        location: `POINT(${b.lng} ${b.lat})`,
        opening_hours: b.opening_hours || null
    }))

    try {
        // Insert in batches of 100
        let inserted = 0
        const batchSize = 100

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize)

            // Use simple insert - duplicates are ok since we dedupe during counting
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase as any)
                .from('business_nodes')
                .insert(batch)

            if (error) {
                console.warn(`[Overpass] Batch insert warning: ${error.message}`)
            } else {
                inserted += batch.length
            }
        }

        console.log(`[Overpass] Successfully inserted ${inserted} businesses`)
        return inserted

    } catch (error) {
        console.error('[Overpass] Failed to insert businesses:', error)
        return 0
    }
}

/**
 * Check if a bounding box has sufficient coverage in the database
 * Returns true if we have data, false if we need to fetch more
 */
export async function checkCoverage(
    bbox: { south: number; west: number; north: number; east: number }
): Promise<{ hasCoverage: boolean; existingCount: number }> {
    try {
        // Check how many businesses exist in this bbox
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .rpc('count_businesses_in_bbox', {
                min_lng: bbox.west,
                min_lat: bbox.south,
                max_lng: bbox.east,
                max_lat: bbox.north
            }) as { data: number | null; error: Error | null }

        if (error) {
            // RPC might not exist, fall back to assuming no coverage
            console.warn('[Overpass] Coverage check RPC not available, assuming no coverage')
            return { hasCoverage: false, existingCount: 0 }
        }

        const count = data || 0
        const hasCoverage = count > 10 // Consider covered if more than 10 businesses

        console.log(`[Overpass] Coverage check: ${count} businesses in bbox, hasCoverage=${hasCoverage}`)
        return { hasCoverage, existingCount: count }

    } catch (error) {
        console.error('[Overpass] Coverage check failed:', error)
        return { hasCoverage: false, existingCount: 0 }
    }
}

/**
 * Fetch businesses for a route buffer if not already covered
 * This is the main entry point for dynamic fetching
 */
export async function ensureBusinessCoverage(
    bufferPolygon: GeoJSON.Polygon
): Promise<void> {
    // Get bbox from polygon
    const coords = bufferPolygon.coordinates[0]
    const lngs = coords.map(c => c[0])
    const lats = coords.map(c => c[1])

    const bbox = {
        west: Math.min(...lngs),
        east: Math.max(...lngs),
        south: Math.min(...lats),
        north: Math.max(...lats)
    }

    // Add small padding to bbox
    const padding = 0.002 // ~200m
    bbox.west -= padding
    bbox.east += padding
    bbox.south -= padding
    bbox.north += padding

    console.log(`[Overpass] Ensuring coverage for route buffer...`)

    // Check existing coverage
    const { hasCoverage, existingCount } = await checkCoverage(bbox)

    if (hasCoverage) {
        console.log(`[Overpass] Area already has coverage (${existingCount} businesses), skipping fetch`)
        return
    }

    // Fetch from Overpass API
    console.log(`[Overpass] Area has insufficient coverage (${existingCount} businesses), fetching from Overpass...`)
    const businesses = await fetchBusinessesFromOverpass(bbox)

    if (businesses.length > 0) {
        // Insert into database
        const inserted = await insertBusinessesToSupabase(businesses)
        console.log(`[Overpass] Dynamic fetch complete: ${inserted} new businesses added`)

        // Clear the business cache so next count picks up new data
        try {
            const { clearBusinessCache } = await import('./businessCounter')
            clearBusinessCache()
        } catch (err) {
            console.warn('[Overpass] Could not clear business cache:', err)
        }
    }
}

