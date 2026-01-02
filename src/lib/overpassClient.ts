/**
 * Overpass API Client for Dynamic Business Fetching
 * ==================================================
 * Fetches ALL POIs from OpenStreetMap via Overpass API using a "catch-all"
 * approach, then filters with a blacklist and classifies dynamically.
 */

import { supabase } from './supabase'
import type { BusinessNode } from './businessCounter'

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter'

// Blacklist for street furniture and non-business items
const BLACKLIST = new Set([
    'bench', 'waste_basket', 'bicycle_parking', 'telephone',
    'post_box', 'recycling', 'drinking_water', 'toilets',
    'vending_machine', 'atm', 'parking', 'parking_space',
    'parking_entrance', 'motorcycle_parking', 'loading_dock',
    'grit_bin', 'hunting_stand', 'feeding_place', 'watering_place'
])

// Hospitality amenity types
const HOSPITALITY_AMENITIES = new Set([
    'restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court', 'biergarten', 'nightclub'
])

// Hospitality tourism types (hotels)
const HOSPITALITY_TOURISM = new Set([
    'hotel', 'hostel', 'guest_house', 'motel', 'apartment'
])

// Commercial amenity types (services)
const COMMERCIAL_AMENITIES = new Set([
    'bank', 'bureau_de_change', 'post_office', 'clinic', 'dentist',
    'pharmacy', 'doctors', 'hospital', 'veterinary'
])

// Commercial leisure types (gyms)
const COMMERCIAL_LEISURE = new Set([
    'fitness_centre', 'gym', 'sports_centre'
])

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
        office?: string
        tourism?: string
        historic?: string
        leisure?: string
        craft?: string
        opening_hours?: string
        [key: string]: string | undefined
    }
}

interface OverpassResponse {
    elements: OverpassElement[]
}

/**
 * Build Overpass QL query for a bounding box
 * Uses "catch-all" approach to fetch EVERYTHING, then filters client-side
 */
function buildOverpassQuery(bbox: { south: number; west: number; north: number; east: number }): string {
    const { south, west, north, east } = bbox
    const bboxStr = `${south},${west},${north},${east}`

    // Catch-all query: fetches shops, amenities, offices, leisure, tourism, historic, craft
    return `
[out:json][timeout:60];
(
  node["shop"](${bboxStr});
  way["shop"](${bboxStr});
  
  node["amenity"](${bboxStr});
  way["amenity"](${bboxStr});
  
  node["office"](${bboxStr});
  way["office"](${bboxStr});

  node["leisure"](${bboxStr});
  way["leisure"](${bboxStr});

  node["tourism"](${bboxStr});
  way["tourism"](${bboxStr});

  node["historic"](${bboxStr});
  way["historic"](${bboxStr});

  node["craft"](${bboxStr});
  way["craft"](${bboxStr});
);
out center;
`.trim()
}

/**
 * Parse Overpass API response into BusinessNode format
 * Dynamically classifies POIs and filters out blacklisted items
 */
function parseOverpassResponse(elements: OverpassElement[]): Omit<BusinessNode, 'id'>[] {
    const businesses: Omit<BusinessNode, 'id'>[] = []

    for (const element of elements) {
        // Get coordinates (node has lat/lon, way/relation has center)
        const lat = element.lat ?? element.center?.lat
        const lon = element.lon ?? element.center?.lon

        if (!lat || !lon) continue

        const tags = element.tags || {}

        // Determine type and subtype dynamically
        let type: 'retail' | 'hospitality' | 'commercial' | 'other' = 'other'
        let subtype: string | null = null

        // 1. RETAIL: shops
        if (tags.shop) {
            type = 'retail'
            subtype = tags.shop
        }
        // 2. OFFICE: commercial
        else if (tags.office) {
            type = 'commercial'
            subtype = tags.office
        }
        // 3. CRAFT: commercial
        else if (tags.craft) {
            type = 'commercial'
            subtype = `craft:${tags.craft}`
        }
        // 4. AMENITY: check for hospitality, commercial, or blacklist
        else if (tags.amenity) {
            // Skip blacklisted items
            if (BLACKLIST.has(tags.amenity)) continue

            if (HOSPITALITY_AMENITIES.has(tags.amenity)) {
                type = 'hospitality'
                subtype = tags.amenity
            } else if (COMMERCIAL_AMENITIES.has(tags.amenity)) {
                type = 'commercial'
                subtype = tags.amenity
            } else {
                type = 'other'
                subtype = `amenity:${tags.amenity}`
            }
        }
        // 5. TOURISM: hotels are hospitality, rest are other
        else if (tags.tourism) {
            if (HOSPITALITY_TOURISM.has(tags.tourism)) {
                type = 'hospitality'
                subtype = tags.tourism
            } else {
                type = 'other'
                subtype = `tourism:${tags.tourism}`
            }
        }
        // 6. HISTORIC: all are other
        else if (tags.historic) {
            type = 'other'
            subtype = `historic:${tags.historic}`
        }
        // 7. LEISURE: gyms are commercial, rest are other
        else if (tags.leisure) {
            if (BLACKLIST.has(tags.leisure)) continue

            if (COMMERCIAL_LEISURE.has(tags.leisure)) {
                type = 'commercial'
                subtype = tags.leisure
            } else {
                type = 'other'
                subtype = `leisure:${tags.leisure}`
            }
        }

        // Build display name
        const displayName = tags.name || (subtype ? `Unnamed ${subtype}` : 'Unknown')

        businesses.push({
            name: displayName,
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

        // Log breakdown by type
        const typeCounts = { retail: 0, hospitality: 0, commercial: 0, other: 0 }
        for (const b of businesses) {
            typeCounts[b.type]++
        }
        console.log(`[Overpass] Parsed ${businesses.length} businesses: ${typeCounts.retail} retail, ${typeCounts.hospitality} hospitality, ${typeCounts.commercial} commercial, ${typeCounts.other} other`)

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
        // INCREASED THRESHOLD: Only consider covered if more than 50 businesses
        // This helps avoid the "False Coverage Trap" for areas with partial data
        const hasCoverage = count > 50

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
        console.log(`[Overpass] Area already has sufficient coverage (${existingCount} businesses), skipping fetch`)
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
