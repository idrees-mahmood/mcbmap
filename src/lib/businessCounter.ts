/**
 * Business Counter Utility
 * =========================
 * Counts businesses within a buffer zone using either:
 * - Client-side: Turf.js for demo/offline mode (faster preview)
 * - Server-side: Supabase RPC for production (accurate PostGIS)
 */

import * as turf from '@turf/turf'
import { supabase, isDemoMode } from './supabase'

export interface BusinessCount {
    total: number
    retail: number
    hospitality: number
    other: number
}

export interface BusinessNode {
    id: string
    name: string | null
    type: 'retail' | 'hospitality' | 'other'
    subtype: string | null
    lng: number
    lat: number
}

// Cache for business nodes to avoid repeated fetches
let businessNodesCache: BusinessNode[] | null = null
let lastFetchTime = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Clear the business nodes cache
 * Call this after dynamic fetching to pick up new data
 */
export function clearBusinessCache(): void {
    console.log('[BusinessCounter] Clearing business cache')
    businessNodesCache = null
    lastFetchTime = 0
}


/**
 * Fetch all business nodes from Supabase
 * Uses caching to avoid repeated network requests
 */
export async function fetchBusinessNodes(): Promise<BusinessNode[]> {
    const now = Date.now()

    // Return cached data if still valid
    if (businessNodesCache && (now - lastFetchTime) < CACHE_TTL_MS) {
        console.log(`[BusinessCounter] Using cached ${businessNodesCache.length} nodes`)
        return businessNodesCache
    }

    // Define the expected RPC result type
    type RPCBusinessNode = {
        id: string
        name: string | null
        type: 'retail' | 'hospitality' | 'other'
        subtype: string | null
        lng: number
        lat: number
    }

    try {
        // Fetch business nodes with coordinates extracted via RPC
        console.log('[BusinessCounter] Fetching business nodes via RPC...')
        const { data, error } = await supabase
            .rpc('get_all_business_nodes') as { data: RPCBusinessNode[] | null; error: Error | null }

        if (error) {
            // RPC not available - this is expected if the SQL function hasn't been deployed
            console.error('[BusinessCounter] ⚠️ RPC get_all_business_nodes failed:', error.message)
            console.error('[BusinessCounter] ⚠️ CRITICAL: You must deploy the SQL function to Supabase!')
            console.error('[BusinessCounter] Run this SQL in Supabase SQL Editor:')
            console.error(`
CREATE OR REPLACE FUNCTION get_all_business_nodes()
RETURNS TABLE (id UUID, name TEXT, type TEXT, subtype TEXT, lng FLOAT, lat FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT bn.id, bn.name, bn.type, bn.subtype,
           ST_X(bn.location::GEOMETRY) as lng,
           ST_Y(bn.location::GEOMETRY) as lat
    FROM business_nodes bn;
END;
$$ LANGUAGE plpgsql STABLE;
`)

            // Fallback: fetch nodes without coordinates (just to show we have data)
            const fallback = await supabase
                .from('business_nodes')
                .select('id, name, type, subtype')

            if (fallback.error) {
                console.error('[BusinessCounter] Fallback query also failed:', fallback.error)
                return []
            }

            // Store nodes without valid coordinates
            businessNodesCache = (fallback.data || []).map((node: any) => ({
                id: node.id,
                name: node.name,
                type: node.type || 'other',
                subtype: node.subtype,
                lng: 0,  // No coordinates available without RPC
                lat: 0
            }))

            console.log(`[BusinessCounter] Loaded ${businessNodesCache.length} nodes WITHOUT coordinates (deploy RPC function to fix)`)
        } else {
            // RPC succeeded - we have proper coordinates
            console.log(`[BusinessCounter] RPC returned ${data?.length || 0} nodes`)
            businessNodesCache = data || []

            // Log sample to verify data
            if (data && data.length > 0) {
                const sample = data[0]
                console.log(`[BusinessCounter] Sample node: id=${sample.id}, lng=${sample.lng}, lat=${sample.lat}`)
            }
        }

        lastFetchTime = now

        // Count valid coordinates
        const validCount = businessNodesCache?.filter(n => n.lng !== 0 && n.lat !== 0).length || 0
        console.log(`[BusinessCounter] Total: ${businessNodesCache?.length || 0} nodes, ${validCount} with valid coordinates`)

        return businessNodesCache || []

    } catch (err) {
        console.error('[BusinessCounter] Error fetching business nodes:', err)
        return []
    }
}


/**
 * Count businesses within a buffer polygon using Turf.js (client-side)
 * This is used for immediate preview before saving to database
 */
export function countBusinessesInPolygon(
    bufferPolygon: GeoJSON.Polygon,
    businesses: BusinessNode[]
): BusinessCount {
    const polygon = turf.polygon(bufferPolygon.coordinates)

    // Log polygon bounds for debugging
    const bbox = turf.bbox(polygon)
    console.log(`[BusinessCounter] Checking polygon bounds: [${bbox[0].toFixed(4)}, ${bbox[1].toFixed(4)}] to [${bbox[2].toFixed(4)}, ${bbox[3].toFixed(4)}]`)

    let retail = 0
    let hospitality = 0
    let other = 0
    let checkedCount = 0
    let skippedNoCoords = 0

    for (const business of businesses) {
        if (business.lng === 0 && business.lat === 0) {
            skippedNoCoords++
            continue
        }
        checkedCount++

        const point = turf.point([business.lng, business.lat])

        if (turf.booleanPointInPolygon(point, polygon)) {
            switch (business.type) {
                case 'retail':
                    retail++
                    break
                case 'hospitality':
                    hospitality++
                    break
                default:
                    other++
            }
        }
    }

    const total = retail + hospitality + other
    console.log(`[BusinessCounter] Polygon check: ${checkedCount} businesses checked, ${skippedNoCoords} skipped (no coords), ${total} matched (${retail} retail, ${hospitality} hospitality, ${other} other)`)

    // If no matches but we have businesses, log some sample coordinates for debugging
    if (total === 0 && checkedCount > 0) {
        const samples = businesses.filter(b => b.lng !== 0 && b.lat !== 0).slice(0, 5)
        console.log('[BusinessCounter] Sample business locations (not in polygon):')
        samples.forEach((b, i) => {
            console.log(`  [${i}] ${b.name || 'unnamed'}: lng=${b.lng}, lat=${b.lat}`)
        })
    }

    return {
        total,
        retail,
        hospitality,
        other
    }
}

/**
 * Get the actual businesses matched within a buffer polygon
 * Returns full business details, grouped by type, with logging
 */
export function getMatchedBusinesses(
    bufferPolygon: GeoJSON.Polygon,
    businesses: BusinessNode[]
): { retail: BusinessNode[]; hospitality: BusinessNode[]; other: BusinessNode[] } {
    const polygon = turf.polygon(bufferPolygon.coordinates)

    const retail: BusinessNode[] = []
    const hospitality: BusinessNode[] = []
    const other: BusinessNode[] = []

    for (const business of businesses) {
        if (business.lng === 0 && business.lat === 0) continue

        const point = turf.point([business.lng, business.lat])

        if (turf.booleanPointInPolygon(point, polygon)) {
            switch (business.type) {
                case 'retail':
                    retail.push(business)
                    break
                case 'hospitality':
                    hospitality.push(business)
                    break
                default:
                    other.push(business)
            }
        }
    }

    // Log matched businesses by type
    console.log('[BusinessCounter] === MATCHED BUSINESSES ===')

    if (retail.length > 0) {
        console.log(`[BusinessCounter] 🛒 Retail (${retail.length}):`)
        retail.slice(0, 10).forEach(b => {
            console.log(`    - ${b.name || 'unnamed'} (${b.subtype || 'shop'})`)
        })
        if (retail.length > 10) console.log(`    ... and ${retail.length - 10} more`)
    }

    if (hospitality.length > 0) {
        console.log(`[BusinessCounter] 🍽️ Hospitality (${hospitality.length}):`)
        hospitality.slice(0, 10).forEach(b => {
            console.log(`    - ${b.name || 'unnamed'} (${b.subtype || 'venue'})`)
        })
        if (hospitality.length > 10) console.log(`    ... and ${hospitality.length - 10} more`)
    }

    if (other.length > 0) {
        console.log(`[BusinessCounter] 📍 Other (${other.length}):`)
        other.slice(0, 5).forEach(b => {
            console.log(`    - ${b.name || 'unnamed'} (${b.subtype || 'other'})`)
        })
        if (other.length > 5) console.log(`    ... and ${other.length - 5} more`)
    }

    return { retail, hospitality, other }
}


/**
 * Count businesses within a buffer zone
 * Uses Supabase RPC for server-side counting if available,
 * falls back to client-side turf.js calculation.
 * Also dynamically fetches from Overpass API if area not covered.
 */
export async function countBusinessesInBuffer(
    bufferPolygon: GeoJSON.Polygon,
    options: { enableDynamicFetch?: boolean } = {}
): Promise<BusinessCount> {
    const { enableDynamicFetch = true } = options
    console.log('[BusinessCounter] countBusinessesInBuffer called')

    // Try to ensure coverage via Overpass API if enabled
    if (enableDynamicFetch && !isDemoMode) {
        try {
            const { ensureBusinessCoverage } = await import('./overpassClient')
            await ensureBusinessCoverage(bufferPolygon)
        } catch (err) {
            console.warn('[BusinessCounter] Dynamic fetch not available:', err)
        }
    }

    // Fetch all business nodes
    const businesses = await fetchBusinessNodes()

    if (businesses.length === 0) {
        console.warn('[BusinessCounter] No business nodes available for counting')
        return { total: 0, retail: 0, hospitality: 0, other: 0 }
    }

    console.log(`[BusinessCounter] Starting polygon check with ${businesses.length} businesses`)

    // Get matched businesses with names for logging
    const matched = getMatchedBusinesses(bufferPolygon, businesses)

    const result = {
        total: matched.retail.length + matched.hospitality.length + matched.other.length,
        retail: matched.retail.length,
        hospitality: matched.hospitality.length,
        other: matched.other.length
    }

    console.log(`[BusinessCounter] Final count: total=${result.total}, retail=${result.retail}, hospitality=${result.hospitality}, other=${result.other}`)
    return result
}


/**
 * Count businesses within a route's buffer using Supabase RPC
 * This is more accurate as it uses PostGIS server-side
 */
export async function countBusinessesViaRPC(routeId: string): Promise<BusinessCount> {
    try {
        // Use type assertion to work around strict RPC typing
        const { data, error } = await (supabase as any)
            .rpc('count_businesses_in_buffer', { route_uuid: routeId })

        if (error) {
            console.error('RPC count failed:', error)
            return { total: 0, retail: 0, hospitality: 0, other: 0 }
        }

        const result = data?.[0] as { total_count?: number; retail_count?: number; hospitality_count?: number; other_count?: number } | undefined
        return {
            total: result?.total_count || 0,
            retail: result?.retail_count || 0,
            hospitality: result?.hospitality_count || 0,
            other: result?.other_count || 0
        }
    } catch (err) {
        console.error('Error counting businesses via RPC:', err)
        return { total: 0, retail: 0, hospitality: 0, other: 0 }
    }
}

/**
 * Pre-fetch business nodes on module load for faster counting
 */
if (!isDemoMode) {
    console.log('[BusinessCounter] Pre-fetching business nodes on module load...')
    fetchBusinessNodes().then(nodes => {
        const validNodes = nodes.filter(n => n.lng !== 0 && n.lat !== 0)
        console.log(`[BusinessCounter] Pre-fetch complete: ${nodes.length} total, ${validNodes.length} with valid coordinates`)
    }).catch(err => {
        console.error('[BusinessCounter] Pre-fetch failed:', err)
    })
}

