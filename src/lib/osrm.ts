// OSRM API client for route calculation
// Uses the public OSRM demo server (rate limited, for development only)

const OSRM_BASE_URL = 'https://router.project-osrm.org'

export interface OSRMCoordinate {
    lng: number
    lat: number
}

export interface OSRMRoute {
    geometry: GeoJSON.LineString
    distance: number  // meters
    duration: number  // seconds
    legs: {
        steps: {
            name: string
            distance: number
            duration: number
        }[]
    }[]
}

export interface OSRMResponse {
    code: string
    routes: OSRMRoute[]
    waypoints: {
        name: string
        location: [number, number]
    }[]
}

/**
 * Calculate a walking route between two points using OSRM
 * @param start Starting coordinate
 * @param end Ending coordinate
 * @returns Route geometry and metadata
 */
export async function calculateWalkingRoute(
    start: OSRMCoordinate,
    end: OSRMCoordinate
): Promise<OSRMRoute> {
    const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`

    const url = new URL(`${OSRM_BASE_URL}/route/v1/foot/${coordinates}`)
    url.searchParams.set('overview', 'full')
    url.searchParams.set('geometries', 'geojson')
    url.searchParams.set('steps', 'true')

    const response = await fetch(url.toString())

    if (!response.ok) {
        throw new Error(`OSRM API error: ${response.status} ${response.statusText}`)
    }

    const data: OSRMResponse = await response.json()

    if (data.code !== 'Ok' || !data.routes.length) {
        throw new Error(`OSRM routing failed: ${data.code}`)
    }

    return data.routes[0]
}

/**
 * Calculate a route with multiple waypoints
 */
export async function calculateMultiWaypointRoute(
    waypoints: OSRMCoordinate[]
): Promise<OSRMRoute> {
    if (waypoints.length < 2) {
        throw new Error('At least 2 waypoints required')
    }

    const coordinates = waypoints
        .map(wp => `${wp.lng},${wp.lat}`)
        .join(';')

    const url = new URL(`${OSRM_BASE_URL}/route/v1/foot/${coordinates}`)
    url.searchParams.set('overview', 'full')
    url.searchParams.set('geometries', 'geojson')
    url.searchParams.set('steps', 'true')

    const response = await fetch(url.toString())

    if (!response.ok) {
        throw new Error(`OSRM API error: ${response.status}`)
    }

    const data: OSRMResponse = await response.json()

    if (data.code !== 'Ok' || !data.routes.length) {
        throw new Error(`OSRM routing failed: ${data.code}`)
    }

    return data.routes[0]
}

/**
 * Create a buffer polygon around a LineString
 * Client-side approximation using coordinate shifting
 * For production, use PostGIS ST_Buffer on the server
 */
export function createRouteBuffer(
    route: GeoJSON.LineString,
    bufferMeters: number = 100  // 100m captures more businesses while staying reasonable
): GeoJSON.Polygon {
    const coords = route.coordinates

    // Approximate degrees per meter at London's latitude (~51.5°N)
    const metersPerDegreeLat = 111320
    const metersPerDegreeLng = 111320 * Math.cos((51.5 * Math.PI) / 180)

    const bufferLat = bufferMeters / metersPerDegreeLat
    const bufferLng = bufferMeters / metersPerDegreeLng

    // Create offset paths on both sides
    const leftPath: [number, number][] = []
    const rightPath: [number, number][] = []

    for (let i = 0; i < coords.length; i++) {
        const [lng, lat] = coords[i] as [number, number]

        // Simple perpendicular offset (not accurate for curves, but sufficient for visualization)
        let perpX = 0, perpY = 0

        if (i < coords.length - 1) {
            const [nextLng, nextLat] = coords[i + 1] as [number, number]
            const dx = nextLng - lng
            const dy = nextLat - lat
            const len = Math.sqrt(dx * dx + dy * dy)
            if (len > 0) {
                perpX = -dy / len
                perpY = dx / len
            }
        } else if (i > 0) {
            const [prevLng, prevLat] = coords[i - 1] as [number, number]
            const dx = lng - prevLng
            const dy = lat - prevLat
            const len = Math.sqrt(dx * dx + dy * dy)
            if (len > 0) {
                perpX = -dy / len
                perpY = dx / len
            }
        }

        leftPath.push([lng + perpX * bufferLng, lat + perpY * bufferLat])
        rightPath.push([lng - perpX * bufferLng, lat - perpY * bufferLat])
    }

    // Combine into a closed polygon
    const polygonCoords: [number, number][] = [
        ...leftPath,
        ...rightPath.reverse(),
        leftPath[0] // Close the polygon
    ]

    return {
        type: 'Polygon',
        coordinates: [polygonCoords]
    }
}

/**
 * Format distance in human-readable format
 */
export function formatDistance(meters: number): string {
    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(1)} km`
    }
    return `${Math.round(meters)} m`
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (hours > 0) {
        return `${hours}h ${minutes}m`
    }
    return `${minutes} min`
}
