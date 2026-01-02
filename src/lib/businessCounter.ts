/**
 * Business Counter Utility
 * =========================
 * Counts businesses within a buffer zone using either:
 * - Client-side: Turf.js for demo/offline mode (faster preview)
 * - Server-side: Supabase RPC for production (accurate PostGIS)
 * 
 * Features:
 * - Lazy loading: Only fetches when needed (not on app load)
 * - localStorage caching: Persists POIs across page reloads
 * - Progress callback: Reports loading progress for UI
 */

import * as turf from '@turf/turf'
import { supabase, isDemoMode } from './supabase'

export interface BusinessCount {
    total: number
    retail: number
    hospitality: number
    commercial: number
    other: number
}

export interface BusinessNode {
    id: string
    name: string | null
    type: 'retail' | 'hospitality' | 'commercial' | 'other'
    subtype: string | null
    lng: number
    lat: number
    opening_hours?: string | null
}

// Progress callback type for UI updates
export type LoadingProgressCallback = (loaded: number, total: number | null, status: string) => void

// In-memory cache for current session
let businessNodesCache: BusinessNode[] | null = null
let lastFetchTime = 0

// localStorage cache configuration
const LOCALSTORAGE_KEY = 'mcbmap_business_nodes_v2'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours (data rarely changes)

interface LocalStorageCache {
    version: string
    timestamp: number
    nodes: BusinessNode[]
}

/**
 * Clear all business caches (in-memory and localStorage)
 */
export function clearBusinessCache(): void {
    console.log('[BusinessCounter] Clearing all business caches')
    businessNodesCache = null
    lastFetchTime = 0
    try {
        localStorage.removeItem(LOCALSTORAGE_KEY)
    } catch (e) {
        console.warn('[BusinessCounter] Could not clear localStorage:', e)
    }
}

/**
 * Load cached nodes from localStorage
 */
function loadFromLocalStorage(): BusinessNode[] | null {
    try {
        const cached = localStorage.getItem(LOCALSTORAGE_KEY)
        if (!cached) return null

        const data: LocalStorageCache = JSON.parse(cached)

        // Check version and freshness
        if (data.version !== 'v2') {
            console.log('[BusinessCounter] Cache version mismatch, clearing')
            localStorage.removeItem(LOCALSTORAGE_KEY)
            return null
        }

        const age = Date.now() - data.timestamp
        if (age > CACHE_TTL_MS) {
            console.log('[BusinessCounter] Cache expired, clearing')
            localStorage.removeItem(LOCALSTORAGE_KEY)
            return null
        }

        console.log(`[BusinessCounter] Loaded ${data.nodes.length} nodes from localStorage (age: ${Math.round(age / 60000)}min)`)
        return data.nodes

    } catch (e) {
        console.warn('[BusinessCounter] Error loading from localStorage:', e)
        return null
    }
}

/**
 * Save nodes to localStorage
 */
function saveToLocalStorage(nodes: BusinessNode[]): void {
    try {
        const data: LocalStorageCache = {
            version: 'v2',
            timestamp: Date.now(),
            nodes
        }
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data))
        console.log(`[BusinessCounter] Saved ${nodes.length} nodes to localStorage`)
    } catch (e) {
        console.warn('[BusinessCounter] Could not save to localStorage:', e)
    }
}

/**
 * Fetch all business nodes from Supabase with progress reporting
 * Uses PAGINATION to fetch ALL rows (Supabase defaults to 1000 row limit)
 * Uses RPC for coordinate extraction (location is stored as WKB, needs ST_X/ST_Y)
 * Uses layered caching: in-memory -> localStorage -> network
 */
export async function fetchBusinessNodes(
    onProgress?: LoadingProgressCallback
): Promise<BusinessNode[]> {
    const now = Date.now()

    // Layer 1: In-memory cache (fastest)
    if (businessNodesCache && (now - lastFetchTime) < CACHE_TTL_MS) {
        console.log(`[BusinessCounter] Using in-memory cache: ${businessNodesCache.length} nodes`)
        onProgress?.(businessNodesCache.length, businessNodesCache.length, 'Loaded from cache')
        return businessNodesCache
    }

    // Layer 2: localStorage cache (fast, persists across page reloads)
    const localCached = loadFromLocalStorage()
    if (localCached && localCached.length > 0) {
        businessNodesCache = localCached
        lastFetchTime = now
        onProgress?.(localCached.length, localCached.length, 'Loaded from cache')
        return localCached
    }

    // Layer 3: Network fetch with pagination
    console.log('[BusinessCounter] Fetching from Supabase with pagination...')
    onProgress?.(0, null, 'Connecting to database...')

    // Define the expected RPC result type
    type RPCBusinessNode = {
        id: string
        name: string | null
        type: 'retail' | 'hospitality' | 'commercial' | 'other'
        subtype: string | null
        lng: number
        lat: number
        opening_hours: string | null
    }

    try {
        const BATCH_SIZE = 1000
        const allNodes: BusinessNode[] = []
        let offset = 0
        let hasMore = true
        let estimatedTotal: number | null = null

        while (hasMore) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase as any)
                .rpc('get_business_nodes_paginated', {
                    batch_limit: BATCH_SIZE,
                    batch_offset: offset
                }) as { data: RPCBusinessNode[] | null; error: Error | null }

            if (error) {
                // If paginated RPC doesn't exist, fall back to regular RPC (limited to 1000)
                if (offset === 0 && error.message.includes('does not exist')) {
                    console.log('[BusinessCounter] Paginated RPC not found, falling back to regular RPC...')
                    onProgress?.(0, null, 'Using fallback method...')

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const fallback = await (supabase as any)
                        .rpc('get_all_business_nodes') as { data: RPCBusinessNode[] | null; error: Error | null }

                    if (fallback.error) {
                        console.error('[BusinessCounter] ⚠️ RPC failed:', fallback.error.message)
                        onProgress?.(0, 0, 'Error loading data')
                        return []
                    }

                    businessNodesCache = fallback.data || []
                    lastFetchTime = now
                    saveToLocalStorage(businessNodesCache)
                    onProgress?.(businessNodesCache.length, businessNodesCache.length, 'Loaded (limited)')
                    return businessNodesCache
                }

                console.error(`[BusinessCounter] Error at offset ${offset}:`, error.message)
                break
            }

            if (!data || data.length === 0) {
                hasMore = false
                break
            }

            // Add nodes to collection
            for (const node of data) {
                allNodes.push({
                    id: node.id,
                    name: node.name,
                    type: node.type || 'other',
                    subtype: node.subtype,
                    lng: node.lng || 0,
                    lat: node.lat || 0,
                    opening_hours: node.opening_hours
                })
            }

            // Estimate total based on first batch (if full, likely more to come)
            if (offset === 0 && data.length === BATCH_SIZE) {
                // Rough estimate based on typical London data
                estimatedTotal = 50000
            }

            // Report progress
            onProgress?.(
                allNodes.length,
                estimatedTotal,
                `Loading businesses... ${allNodes.length.toLocaleString()}${estimatedTotal ? ` of ~${estimatedTotal.toLocaleString()}` : ''}`
            )

            console.log(`[BusinessCounter] Batch: offset=${offset}, got ${data.length}, total=${allNodes.length}`)

            offset += BATCH_SIZE
            hasMore = data.length === BATCH_SIZE

            // Safety limit
            if (offset > 100000) {
                console.warn('[BusinessCounter] Safety limit reached')
                break
            }
        }

        // Save to caches
        businessNodesCache = allNodes
        lastFetchTime = now
        saveToLocalStorage(allNodes)

        // Final progress update
        const validCount = allNodes.filter(n => n.lng !== 0 && n.lat !== 0).length
        console.log(`[BusinessCounter] ✅ Fetched ${allNodes.length} nodes, ${validCount} with coords`)
        onProgress?.(allNodes.length, allNodes.length, `Loaded ${allNodes.length.toLocaleString()} businesses`)

        return allNodes

    } catch (err) {
        console.error('[BusinessCounter] Error fetching:', err)
        onProgress?.(0, 0, 'Error loading data')
        return []
    }
}


/**
 * Count businesses within a buffer polygon using Turf.js (client-side)
 */
export function countBusinessesInPolygon(
    bufferPolygon: GeoJSON.Polygon,
    businesses: BusinessNode[]
): BusinessCount {
    const polygon = turf.polygon(bufferPolygon.coordinates)
    const bbox = turf.bbox(polygon)
    console.log(`[BusinessCounter] Checking polygon: [${bbox[0].toFixed(4)}, ${bbox[1].toFixed(4)}] to [${bbox[2].toFixed(4)}, ${bbox[3].toFixed(4)}]`)

    let retail = 0
    let hospitality = 0
    let commercial = 0
    let other = 0
    let checkedCount = 0

    for (const business of businesses) {
        if (business.lng === 0 && business.lat === 0) continue
        checkedCount++

        const point = turf.point([business.lng, business.lat])

        if (turf.booleanPointInPolygon(point, polygon)) {
            switch (business.type) {
                case 'retail': retail++; break
                case 'hospitality': hospitality++; break
                case 'commercial': commercial++; break
                default: other++
            }
        }
    }

    const total = retail + hospitality + commercial + other
    console.log(`[BusinessCounter] Matched: ${total} (${retail}R, ${hospitality}H, ${commercial}C, ${other}O) of ${checkedCount} checked`)

    return { total, retail, hospitality, commercial, other }
}

/**
 * Get the actual businesses matched within a buffer polygon
 */
export function getMatchedBusinesses(
    bufferPolygon: GeoJSON.Polygon,
    businesses: BusinessNode[]
): { retail: BusinessNode[]; hospitality: BusinessNode[]; commercial: BusinessNode[]; other: BusinessNode[] } {
    const polygon = turf.polygon(bufferPolygon.coordinates)

    const retail: BusinessNode[] = []
    const hospitality: BusinessNode[] = []
    const commercial: BusinessNode[] = []
    const other: BusinessNode[] = []

    for (const business of businesses) {
        if (business.lng === 0 && business.lat === 0) continue

        const point = turf.point([business.lng, business.lat])

        if (turf.booleanPointInPolygon(point, polygon)) {
            switch (business.type) {
                case 'retail': retail.push(business); break
                case 'hospitality': hospitality.push(business); break
                case 'commercial': commercial.push(business); break
                default: other.push(business)
            }
        }
    }

    // Log summary
    console.log('[BusinessCounter] === MATCHED BUSINESSES ===')
    if (retail.length > 0) console.log(`  🛒 Retail: ${retail.length}`)
    if (hospitality.length > 0) console.log(`  🍽️ Hospitality: ${hospitality.length}`)
    if (commercial.length > 0) console.log(`  🏢 Commercial: ${commercial.length}`)
    if (other.length > 0) console.log(`  📍 Other: ${other.length}`)

    return { retail, hospitality, commercial, other }
}


/**
 * Count businesses within a buffer zone
 */
export async function countBusinessesInBuffer(
    bufferPolygon: GeoJSON.Polygon,
    options: { enableDynamicFetch?: boolean; onProgress?: LoadingProgressCallback } = {}
): Promise<BusinessCount> {
    const { enableDynamicFetch = false, onProgress } = options  // Disabled by default now
    console.log('[BusinessCounter] countBusinessesInBuffer called')

    // Skip dynamic Overpass fetch - we have enough data from the scraper
    // This prevents 504 timeout errors
    if (enableDynamicFetch && !isDemoMode) {
        try {
            const { ensureBusinessCoverage } = await import('./overpassClient')
            await ensureBusinessCoverage(bufferPolygon)
        } catch (err) {
            console.warn('[BusinessCounter] Dynamic fetch skipped:', err)
        }
    }

    const businesses = await fetchBusinessNodes(onProgress)

    if (businesses.length === 0) {
        console.warn('[BusinessCounter] No business nodes available')
        return { total: 0, retail: 0, hospitality: 0, commercial: 0, other: 0 }
    }

    const matched = getMatchedBusinesses(bufferPolygon, businesses)

    return {
        total: matched.retail.length + matched.hospitality.length + matched.commercial.length + matched.other.length,
        retail: matched.retail.length,
        hospitality: matched.hospitality.length,
        commercial: matched.commercial.length,
        other: matched.other.length
    }
}


/**
 * Count businesses via Supabase RPC (server-side PostGIS)
 */
export async function countBusinessesViaRPC(routeId: string): Promise<BusinessCount> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .rpc('count_businesses_in_buffer', { route_uuid: routeId })

        if (error) {
            console.error('RPC count failed:', error)
            return { total: 0, retail: 0, hospitality: 0, commercial: 0, other: 0 }
        }

        const result = data?.[0] as { total_count?: number; retail_count?: number; hospitality_count?: number; commercial_count?: number; other_count?: number } | undefined
        return {
            total: result?.total_count || 0,
            retail: result?.retail_count || 0,
            hospitality: result?.hospitality_count || 0,
            commercial: result?.commercial_count || 0,
            other: result?.other_count || 0
        }
    } catch (err) {
        console.error('Error counting via RPC:', err)
        return { total: 0, retail: 0, hospitality: 0, commercial: 0, other: 0 }
    }
}

/**
 * Get all matched businesses in a buffer zone with full details
 */
export async function getBusinessesInBuffer(
    bufferPolygon: GeoJSON.Polygon,
    options: { enableDynamicFetch?: boolean; onProgress?: LoadingProgressCallback } = {}
): Promise<{
    retail: BusinessNode[];
    hospitality: BusinessNode[];
    commercial: BusinessNode[];
    other: BusinessNode[];
    total: number;
}> {
    const { enableDynamicFetch = false, onProgress } = options  // Disabled by default
    console.log('[BusinessCounter] getBusinessesInBuffer called')

    // Skip dynamic Overpass fetch to prevent 504 timeouts
    // We rely on the Python scraper for data population
    if (enableDynamicFetch && !isDemoMode) {
        try {
            const { ensureBusinessCoverage } = await import('./overpassClient')
            await ensureBusinessCoverage(bufferPolygon)
        } catch (err) {
            console.warn('[BusinessCounter] Dynamic fetch skipped:', err)
        }
    }

    const businesses = await fetchBusinessNodes(onProgress)

    if (businesses.length === 0) {
        console.warn('[BusinessCounter] No business nodes available')
        return { retail: [], hospitality: [], commercial: [], other: [], total: 0 }
    }

    const matched = getMatchedBusinesses(bufferPolygon, businesses)

    return {
        retail: matched.retail,
        hospitality: matched.hospitality,
        commercial: matched.commercial,
        other: matched.other,
        total: matched.retail.length + matched.hospitality.length + matched.commercial.length + matched.other.length
    }
}
