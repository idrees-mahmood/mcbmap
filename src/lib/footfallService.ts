/**
 * Footfall Service
 * ================
 * Fetches and processes footfall baseline data for heatmap visualization
 * and impact comparison analysis.
 */

import { supabase } from './supabase'
import * as turf from '@turf/turf'

export interface FootfallPoint {
    id: string
    location_name: string
    lng: number
    lat: number
    day_of_week: string
    hour_of_day: number
    avg_footfall_score: number  // 0-100
    source: string
}

export interface FootfallImpact {
    baselineAvg: number
    estimatedReduction: number  // percentage (e.g., 30)
    impactedScore: number
    pointsInZone: number
}

// Cache for footfall data
let footfallCache: FootfallPoint[] | null = null
let lastFetchTime = 0
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

// Fixed impact reduction percentage
const IMPACT_REDUCTION_PERCENT = 30

/**
 * Fetch all footfall baseline points from Supabase
 */
export async function fetchFootfallBaseline(): Promise<FootfallPoint[]> {
    const now = Date.now()

    if (footfallCache && (now - lastFetchTime) < CACHE_TTL_MS) {
        console.log(`[FootfallService] Using cached ${footfallCache.length} points`)
        return footfallCache
    }

    console.log('[FootfallService] Fetching footfall baseline data...')

    try {
        // Try RPC first for proper coordinate extraction
        const { data, error } = await supabase
            .rpc('get_footfall_points')

        if (error) {
            console.warn('[FootfallService] RPC not available, using direct query')
            // Fallback to direct query
            const fallback = await supabase
                .from('footfall_baseline')
                .select('*')

            if (fallback.error) {
                console.error('[FootfallService] Query failed:', fallback.error)
                return []
            }

            // Note: Without RPC, we can't extract coordinates from geography
            console.warn('[FootfallService] Direct query cannot extract coordinates')
            footfallCache = []
            return []
        }

        footfallCache = data || []
        lastFetchTime = now

        console.log(`[FootfallService] Loaded ${footfallCache?.length || 0} footfall points`)
        return footfallCache || []

    } catch (err) {
        console.error('[FootfallService] Error fetching footfall:', err)
        return []
    }
}

/**
 * Get footfall points near a buffer polygon
 */
export function getFootfallInBuffer(
    bufferPolygon: GeoJSON.Polygon,
    footfallPoints: FootfallPoint[],
    dayOfWeek?: string,
    hour?: number
): FootfallPoint[] {
    const polygon = turf.polygon(bufferPolygon.coordinates)

    let filtered = footfallPoints.filter(point => {
        if (point.lng === 0 && point.lat === 0) return false

        const pt = turf.point([point.lng, point.lat])
        return turf.booleanPointInPolygon(pt, polygon)
    })

    // Filter by day/hour if specified
    if (dayOfWeek) {
        filtered = filtered.filter(p => p.day_of_week === dayOfWeek)
    }
    if (hour !== undefined) {
        filtered = filtered.filter(p => p.hour_of_day === hour)
    }

    return filtered
}

/**
 * Get footfall points within radius of a route (for smooth heatmap)
 */
export function getFootfallNearRoute(
    routeCoordinates: [number, number][],
    footfallPoints: FootfallPoint[],
    radiusKm: number = 0.5
): FootfallPoint[] {
    const line = turf.lineString(routeCoordinates)

    return footfallPoints.filter(point => {
        if (point.lng === 0 && point.lat === 0) return false

        const pt = turf.point([point.lng, point.lat])
        const distance = turf.pointToLineDistance(pt, line, { units: 'kilometers' })
        return distance <= radiusKm
    })
}

/**
 * Calculate average footfall score for a set of points
 */
export function calculateAverageFootfall(points: FootfallPoint[]): number {
    if (points.length === 0) return 0

    const sum = points.reduce((acc, p) => acc + p.avg_footfall_score, 0)
    return Math.round(sum / points.length)
}

/**
 * Calculate footfall impact for a protest
 */
export function calculateFootfallImpact(
    bufferPolygon: GeoJSON.Polygon,
    footfallPoints: FootfallPoint[],
    protestDate: Date,
    startHour: number
): FootfallImpact {
    const dayOfWeek = getDayOfWeek(protestDate)

    // Get points in the buffer zone for this day/hour
    const pointsInZone = getFootfallInBuffer(
        bufferPolygon,
        footfallPoints,
        dayOfWeek,
        startHour
    )

    const baselineAvg = calculateAverageFootfall(pointsInZone)
    const impactedScore = Math.round(baselineAvg * (1 - IMPACT_REDUCTION_PERCENT / 100))

    console.log(`[FootfallService] Impact calculation:`)
    console.log(`  Day: ${dayOfWeek}, Hour: ${startHour}`)
    console.log(`  Points in zone: ${pointsInZone.length}`)
    console.log(`  Baseline avg: ${baselineAvg}%`)
    console.log(`  Est. reduction: ${IMPACT_REDUCTION_PERCENT}%`)
    console.log(`  Impacted score: ${impactedScore}%`)

    return {
        baselineAvg,
        estimatedReduction: IMPACT_REDUCTION_PERCENT,
        impactedScore,
        pointsInZone: pointsInZone.length
    }
}

/**
 * Convert Date to day-of-week string matching database format
 */
function getDayOfWeek(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[date.getDay()]
}

/**
 * Format footfall points for Mapbox heatmap layer
 * Returns GeoJSON FeatureCollection with intensity weights
 */
export function formatForHeatmap(
    footfallPoints: FootfallPoint[],
    dayOfWeek?: string,
    hour?: number
): GeoJSON.FeatureCollection {
    let filtered = footfallPoints.filter(p => p.lng !== 0 && p.lat !== 0)

    if (dayOfWeek) {
        filtered = filtered.filter(p => p.day_of_week === dayOfWeek)
    }
    if (hour !== undefined) {
        filtered = filtered.filter(p => p.hour_of_day === hour)
    }

    const features: GeoJSON.Feature[] = filtered.map(point => ({
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [point.lng, point.lat]
        },
        properties: {
            intensity: point.avg_footfall_score / 100,  // Normalize to 0-1
            name: point.location_name,
            score: point.avg_footfall_score
        }
    }))

    return {
        type: 'FeatureCollection',
        features
    }
}

/**
 * Create impacted heatmap (with reduction applied in buffer)
 */
export function formatImpactedHeatmap(
    footfallPoints: FootfallPoint[],
    bufferPolygon: GeoJSON.Polygon,
    dayOfWeek?: string,
    hour?: number
): GeoJSON.FeatureCollection {
    let filtered = footfallPoints.filter(p => p.lng !== 0 && p.lat !== 0)

    if (dayOfWeek) {
        filtered = filtered.filter(p => p.day_of_week === dayOfWeek)
    }
    if (hour !== undefined) {
        filtered = filtered.filter(p => p.hour_of_day === hour)
    }

    const polygon = turf.polygon(bufferPolygon.coordinates)

    const features: GeoJSON.Feature[] = filtered.map(point => {
        const pt = turf.point([point.lng, point.lat])
        const inBuffer = turf.booleanPointInPolygon(pt, polygon)

        // Apply reduction if in buffer
        let adjustedScore = point.avg_footfall_score
        if (inBuffer) {
            adjustedScore = Math.round(adjustedScore * (1 - IMPACT_REDUCTION_PERCENT / 100))
        }

        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [point.lng, point.lat]
            },
            properties: {
                intensity: adjustedScore / 100,
                name: point.location_name,
                score: adjustedScore,
                impacted: inBuffer
            }
        }
    })

    return {
        type: 'FeatureCollection',
        features
    }
}
