/**
 * Protest Loader Service
 * ======================
 * Loads stored protests from GeoJSON files in public/protests/
 * Supports both raw LineString and OSRM-calculated routes
 */

import { calculateMultiWaypointRoute, createRouteBuffer, type OSRMCoordinate } from './osrm'
import { countBusinessesInBuffer } from './businessCounter'
import type { ProtestWithRoute } from './database.types'

// Route calculation mode
export type RouteMode = 'raw' | 'osrm'

// Current mode (persisted in localStorage)
let currentRouteMode: RouteMode = 'raw'
const ROUTE_MODE_KEY = 'pit_route_mode'

// Load mode from storage on init
try {
    const storedMode = localStorage.getItem(ROUTE_MODE_KEY)
    if (storedMode === 'raw' || storedMode === 'osrm') {
        currentRouteMode = storedMode
    }
} catch { /* ignore */ }

/**
 * Get current route mode
 */
export function getRouteMode(): RouteMode {
    return currentRouteMode
}

/**
 * Set route mode
 */
export function setRouteMode(mode: RouteMode): void {
    currentRouteMode = mode
    try {
        localStorage.setItem(ROUTE_MODE_KEY, mode)
    } catch { /* ignore */ }
    console.log(`[ProtestLoader] Route mode set to: ${mode}`)
}

// Types for manifest and GeoJSON
interface ProtestManifestEntry {
    file: string
    name: string
    date: string
    startTime: string
    endTime: string
    attendees?: number
    notes?: string
    speakers?: string[]
    links?: string[]
}

interface ProtestManifest {
    protests: ProtestManifestEntry[]
}

interface CachedRoute {
    geometry: GeoJSON.LineString
    buffer: GeoJSON.Polygon
    distance: number
    duration: number
    retail: number
    hospitality: number
    commercial: number  // Added for commercial establishments
    cachedAt: string
    mode: RouteMode  // Track which mode was used
    bufferSize: number  // Track buffer size for cache invalidation
}

// In-memory cache for current session (separate by mode)
const routeCache = new Map<string, CachedRoute>()

// LocalStorage key for persistent cache
const CACHE_STORAGE_KEY = 'pit_route_cache'

/**
 * Load route cache from localStorage
 */
function loadCacheFromStorage(): void {
    try {
        const stored = localStorage.getItem(CACHE_STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored) as Record<string, CachedRoute>
            Object.entries(parsed).forEach(([key, value]) => {
                routeCache.set(key, value)
            })
            console.log(`[ProtestLoader] Loaded ${routeCache.size} cached routes from storage`)
        }
    } catch (err) {
        console.warn('[ProtestLoader] Failed to load cache from storage:', err)
    }
}

/**
 * Save route cache to localStorage
 */
function saveCacheToStorage(): void {
    try {
        const obj: Record<string, CachedRoute> = {}
        routeCache.forEach((value, key) => {
            obj[key] = value
        })
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj))
    } catch (err) {
        console.warn('[ProtestLoader] Failed to save cache to storage:', err)
    }
}


/**
 * Extract LineString directly from GeoJSON
 */
function extractLineStringFromGeoJSON(geojson: GeoJSON.FeatureCollection): GeoJSON.LineString | null {
    for (const feature of geojson.features) {
        if (feature.geometry.type === 'LineString') {
            return feature.geometry as GeoJSON.LineString
        }
    }
    return null
}

/**
 * Calculate distance of a LineString in meters using Haversine
 */
function calculateLineStringDistance(lineString: GeoJSON.LineString): number {
    const coords = lineString.coordinates as [number, number][]
    let totalDistance = 0

    for (let i = 0; i < coords.length - 1; i++) {
        const [lng1, lat1] = coords[i]
        const [lng2, lat2] = coords[i + 1]
        totalDistance += haversineDistance(lat1, lng1, lat2, lng2)
    }

    return totalDistance
}

/**
 * Haversine formula for distance between two points
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000 // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

/**
 * Estimate walking duration based on distance (assuming 5 km/h walking speed)
 */
function estimateWalkingDuration(distanceMeters: number): number {
    const walkingSpeedMps = 5000 / 3600 // 5 km/h in m/s
    return distanceMeters / walkingSpeedMps
}

/**
 * Extract waypoints from GeoJSON for OSRM routing
 */
function extractWaypointsFromGeoJSON(geojson: GeoJSON.FeatureCollection): OSRMCoordinate[] {
    const waypoints: OSRMCoordinate[] = []

    for (const feature of geojson.features) {
        if (feature.geometry.type === 'LineString') {
            const coords = feature.geometry.coordinates as [number, number][]
            for (const [lng, lat] of coords) {
                waypoints.push({ lng, lat })
            }
            break
        }
    }

    return waypoints
}

/**
 * Load a single protest from GeoJSON file
 * Supports both raw LineString and OSRM routing based on current mode
 */
async function loadSingleProtest(
    entry: ProtestManifestEntry,
    skipCache: boolean = false
): Promise<ProtestWithRoute | null> {
    const mode = currentRouteMode
    const cacheKey = `${entry.file}:${mode}`  // Include mode in cache key

    // Check cache first (must match current mode AND buffer size)
    const EXPECTED_BUFFER_SIZE = 100  // meters
    if (!skipCache && routeCache.has(cacheKey)) {
        const cached = routeCache.get(cacheKey)!
        // Validate cache entry matches current mode and buffer size
        if (cached.mode === mode && cached.bufferSize === EXPECTED_BUFFER_SIZE) {
            console.log(`[ProtestLoader] Using cached ${mode} route for ${entry.name}`)
            return createProtestFromCache(entry, cached)
        } else {
            console.log(`[ProtestLoader] Cache invalidated for ${entry.name} (buffer: ${cached.bufferSize || 50}m -> ${EXPECTED_BUFFER_SIZE}m)`)
            routeCache.delete(cacheKey)
        }
    }

    try {
        // Fetch the GeoJSON file
        const response = await fetch(`/protests/${entry.file}`)
        if (!response.ok) {
            console.error(`[ProtestLoader] Failed to load ${entry.file}: ${response.status}`)
            return null
        }

        const geojson: GeoJSON.FeatureCollection = await response.json()

        // Extract LineString
        const lineString = extractLineStringFromGeoJSON(geojson)

        if (!lineString || lineString.coordinates.length < 2) {
            console.error(`[ProtestLoader] No valid LineString in ${entry.file}`)
            return null
        }

        let routeGeometry: GeoJSON.LineString
        let distance: number
        let duration: number

        if (mode === 'osrm') {
            // OSRM mode: Calculate route via OSRM
            console.log(`[ProtestLoader] Calculating OSRM route for ${entry.name} (${lineString.coordinates.length} waypoints)...`)

            const waypoints = extractWaypointsFromGeoJSON(geojson)
            const route = await calculateMultiWaypointRoute(waypoints)

            routeGeometry = route.geometry
            distance = route.distance
            duration = route.duration
        } else {
            // Raw mode: Use LineString directly
            console.log(`[ProtestLoader] Using raw LineString for ${entry.name} (${lineString.coordinates.length} points)`)

            routeGeometry = lineString
            distance = calculateLineStringDistance(lineString)
            duration = estimateWalkingDuration(distance)
        }

        // Create buffer around the route
        const buffer = createRouteBuffer(routeGeometry)

        // Count affected businesses
        console.log(`[ProtestLoader] Counting businesses for ${entry.name}...`)
        const businessCounts = await countBusinessesInBuffer(buffer)

        // Cache the result - with buffer size for invalidation when parameters change
        const BUFFER_SIZE = 100  // meters - must match osrm.ts default
        const cachedRoute: CachedRoute = {
            geometry: routeGeometry,
            buffer: buffer,
            distance: distance,
            duration: duration,
            retail: businessCounts.retail,
            hospitality: businessCounts.hospitality,
            commercial: businessCounts.commercial,
            cachedAt: new Date().toISOString(),
            mode: mode,
            bufferSize: BUFFER_SIZE
        }

        routeCache.set(cacheKey, cachedRoute)
        saveCacheToStorage()

        console.log(`[ProtestLoader] Loaded ${entry.name} [${mode}]: ${(distance / 1000).toFixed(1)}km, ${businessCounts.retail + businessCounts.hospitality + businessCounts.commercial} businesses`)

        // Extract start/end from route
        const coords = routeGeometry.coordinates as [number, number][]
        const start = { lng: coords[0][0], lat: coords[0][1] }
        const end = { lng: coords[coords.length - 1][0], lat: coords[coords.length - 1][1] }

        return createProtestFromCache(entry, cachedRoute, start, end)

    } catch (err) {
        console.error(`[ProtestLoader] Error loading ${entry.file}:`, err)
        return null
    }
}

/**
 * Create ProtestWithRoute from cached data
 */
function createProtestFromCache(
    entry: ProtestManifestEntry,
    cached: CachedRoute,
    start?: OSRMCoordinate | null,
    end?: OSRMCoordinate | null
): ProtestWithRoute {
    // Default to first/last waypoints from route if no explicit start/end
    const routeCoords = cached.geometry.coordinates as [number, number][]
    const firstCoord = routeCoords[0]
    const lastCoord = routeCoords[routeCoords.length - 1]

    return {
        id: `stored-${entry.file.replace('.json', '')}`,
        name: entry.name,
        event_date: entry.date,
        start_time: entry.startTime,
        end_time: entry.endTime,
        start_location: {
            type: 'Point',
            coordinates: start ? [start.lng, start.lat] : firstCoord
        },
        end_location: {
            type: 'Point',
            coordinates: end ? [end.lng, end.lat] : lastCoord
        },
        start_address: null,
        end_address: null,
        attendees_estimate: entry.attendees || null,
        police_data_link: null,
        notes: entry.notes || null,
        created_at: cached.cachedAt,
        updated_at: cached.cachedAt,
        route: {
            geometry: cached.geometry,
            buffer: cached.buffer,
            distance_meters: cached.distance,
            duration_seconds: cached.duration,
            affected_retail: cached.retail,
            affected_hospitality: cached.hospitality,
            affected_commercial: cached.commercial || 0
        },
        // Mark as stored protest
        isStored: true,
        // Additional metadata
        speakers: entry.speakers,
        links: entry.links
    }
}

/**
 * Load all stored protests from manifest
 */
export async function loadStoredProtests(): Promise<ProtestWithRoute[]> {
    console.log('[ProtestLoader] Loading stored protests...')

    // Load cache from storage first
    loadCacheFromStorage()

    try {
        // Fetch manifest
        const response = await fetch('/protests/manifest.json')
        if (!response.ok) {
            console.warn('[ProtestLoader] No manifest found, no stored protests to load')
            return []
        }

        const manifest: ProtestManifest = await response.json()
        console.log(`[ProtestLoader] Found ${manifest.protests.length} protests in manifest`)

        // Load each protest
        const protests: ProtestWithRoute[] = []

        for (const entry of manifest.protests) {
            const protest = await loadSingleProtest(entry)
            if (protest) {
                protests.push(protest)
            }
        }

        console.log(`[ProtestLoader] Successfully loaded ${protests.length} stored protests`)
        return protests

    } catch (err) {
        console.error('[ProtestLoader] Error loading manifest:', err)
        return []
    }
}

/**
 * Clear the route cache
 */
export function clearRouteCache(): void {
    routeCache.clear()
    localStorage.removeItem(CACHE_STORAGE_KEY)
    console.log('[ProtestLoader] Route cache cleared')
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; entries: string[] } {
    return {
        count: routeCache.size,
        entries: Array.from(routeCache.keys())
    }
}
