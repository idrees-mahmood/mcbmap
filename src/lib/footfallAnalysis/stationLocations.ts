/**
 * TfL Station Locations
 * =====================
 * Central London station coordinates for proximity detection.
 * Station names must match the CSV data exactly.
 */

export interface TflStation {
    name: string       // Must match CSV exactly
    lat: number
    lng: number
    lines: string[]    // Tube/rail lines serving the station
}

/**
 * Central London TfL stations relevant to protest areas
 * Coordinates sourced from TfL open data
 */
export const TFL_STATIONS: TflStation[] = [
    // Zone 1 - Central
    { name: "Westminster", lat: 51.5014, lng: -0.1247, lines: ["Circle", "District", "Jubilee"] },
    { name: "Embankment", lat: 51.5074, lng: -0.1223, lines: ["Bakerloo", "Circle", "District", "Northern"] },
    { name: "Charing Cross", lat: 51.5080, lng: -0.1247, lines: ["Bakerloo", "Northern"] },
    { name: "Waterloo", lat: 51.5033, lng: -0.1134, lines: ["Bakerloo", "Jubilee", "Northern", "Waterloo & City"] },
    { name: "Piccadilly Circus", lat: 51.5099, lng: -0.1342, lines: ["Bakerloo", "Piccadilly"] },
    { name: "Leicester Square", lat: 51.5115, lng: -0.1281, lines: ["Northern", "Piccadilly"] },
    { name: "Covent Garden", lat: 51.5129, lng: -0.1243, lines: ["Piccadilly"] },
    { name: "Holborn", lat: 51.5174, lng: -0.1200, lines: ["Central", "Piccadilly"] },
    { name: "Temple", lat: 51.5111, lng: -0.1141, lines: ["Circle", "District"] },
    { name: "Blackfriars", lat: 51.5117, lng: -0.1034, lines: ["Circle", "District"] },
    { name: "St James's Park", lat: 51.4994, lng: -0.1335, lines: ["Circle", "District"] },
    { name: "Victoria", lat: 51.4965, lng: -0.1447, lines: ["Circle", "District", "Victoria"] },
    { name: "Green Park", lat: 51.5067, lng: -0.1428, lines: ["Jubilee", "Piccadilly", "Victoria"] },
    { name: "Hyde Park Corner", lat: 51.5027, lng: -0.1527, lines: ["Piccadilly"] },
    { name: "Knightsbridge", lat: 51.5015, lng: -0.1607, lines: ["Piccadilly"] },
    { name: "Oxford Circus", lat: 51.5152, lng: -0.1415, lines: ["Bakerloo", "Central", "Victoria"] },
    { name: "Bond Street", lat: 51.5142, lng: -0.1494, lines: ["Central", "Jubilee", "Elizabeth"] },
    { name: "Marble Arch", lat: 51.5136, lng: -0.1586, lines: ["Central"] },
    { name: "Tottenham Court Road", lat: 51.5165, lng: -0.1310, lines: ["Central", "Northern", "Elizabeth"] },
    { name: "Bank", lat: 51.5133, lng: -0.0886, lines: ["Central", "Northern", "Waterloo & City", "DLR"] },
    { name: "Monument", lat: 51.5108, lng: -0.0863, lines: ["Circle", "District"] },
    { name: "Tower Hill", lat: 51.5098, lng: -0.0766, lines: ["Circle", "District"] },
    { name: "London Bridge", lat: 51.5052, lng: -0.0864, lines: ["Jubilee", "Northern"] },
    { name: "Southwark", lat: 51.5041, lng: -0.1050, lines: ["Jubilee"] },
    { name: "Borough", lat: 51.5011, lng: -0.0943, lines: ["Northern"] },
    { name: "Elephant & Castle", lat: 51.4943, lng: -0.1001, lines: ["Bakerloo", "Northern"] },
    { name: "Lambeth North", lat: 51.4991, lng: -0.1115, lines: ["Bakerloo"] },

    // Near Parliament / Whitehall
    { name: "Pimlico", lat: 51.4893, lng: -0.1334, lines: ["Victoria"] },
    { name: "Vauxhall", lat: 51.4861, lng: -0.1233, lines: ["Victoria"] },

    // Near Trafalgar Square / Strand
    { name: "Goodge Street", lat: 51.5205, lng: -0.1347, lines: ["Northern"] },
    { name: "Warren Street", lat: 51.5247, lng: -0.1384, lines: ["Northern", "Victoria"] },
    { name: "Euston Square", lat: 51.5260, lng: -0.1359, lines: ["Circle", "Hammersmith & City", "Metropolitan"] },
    { name: "Euston", lat: 51.5282, lng: -0.1337, lines: ["Northern", "Victoria"] },
    { name: "Kings Cross St Pancras", lat: 51.5308, lng: -0.1238, lines: ["Circle", "Hammersmith & City", "Metropolitan", "Northern", "Piccadilly", "Victoria"] },
    { name: "Russell Square", lat: 51.5234, lng: -0.1244, lines: ["Piccadilly"] },
    { name: "Chancery Lane", lat: 51.5185, lng: -0.1111, lines: ["Central"] },

    // City
    { name: "St Pauls", lat: 51.5146, lng: -0.0973, lines: ["Central"] },
    { name: "Mansion House", lat: 51.5122, lng: -0.0940, lines: ["Circle", "District"] },
    { name: "Cannon Street", lat: 51.5113, lng: -0.0904, lines: ["Circle", "District"] },
    { name: "Moorgate", lat: 51.5186, lng: -0.0886, lines: ["Circle", "Hammersmith & City", "Metropolitan", "Northern"] },
    { name: "Liverpool Street", lat: 51.5178, lng: -0.0823, lines: ["Central", "Circle", "Hammersmith & City", "Metropolitan", "Elizabeth"] },
    { name: "Aldgate", lat: 51.5143, lng: -0.0755, lines: ["Circle", "Metropolitan"] },
    { name: "Aldgate East", lat: 51.5152, lng: -0.0715, lines: ["District", "Hammersmith & City"] },
    { name: "Old Street", lat: 51.5263, lng: -0.0878, lines: ["Northern"] },
    { name: "Barbican", lat: 51.5204, lng: -0.0979, lines: ["Circle", "Hammersmith & City", "Metropolitan"] },
    { name: "Farringdon", lat: 51.5203, lng: -0.1053, lines: ["Circle", "Hammersmith & City", "Metropolitan", "Elizabeth"] },

    // South Bank
    { name: "Kennington", lat: 51.4884, lng: -0.1053, lines: ["Northern"] },
    { name: "Oval", lat: 51.4819, lng: -0.1126, lines: ["Northern"] },
    { name: "Stockwell", lat: 51.4723, lng: -0.1228, lines: ["Northern", "Victoria"] },

    // West End Extensions
    { name: "Lancaster Gate", lat: 51.5119, lng: -0.1756, lines: ["Central"] },
    { name: "Queensway", lat: 51.5107, lng: -0.1871, lines: ["Central"] },
    { name: "Bayswater", lat: 51.5121, lng: -0.1879, lines: ["Circle", "District"] },
    { name: "Notting Hill Gate", lat: 51.5094, lng: -0.1967, lines: ["Central", "Circle", "District"] },
    { name: "High Street Kensington", lat: 51.5009, lng: -0.1925, lines: ["Circle", "District"] },
    { name: "South Kensington", lat: 51.4941, lng: -0.1738, lines: ["Circle", "District", "Piccadilly"] },
    { name: "Gloucester Road", lat: 51.4945, lng: -0.1829, lines: ["Circle", "District", "Piccadilly"] },
    { name: "Earls Court", lat: 51.4914, lng: -0.1934, lines: ["District", "Piccadilly"] },
    { name: "Sloane Square", lat: 51.4924, lng: -0.1565, lines: ["Circle", "District"] },

    // Battersea / Nine Elms (Northern Line Extension)
    { name: "Nine Elms", lat: 51.4824, lng: -0.1262, lines: ["Northern"] },
    { name: "Battersea Power Station", lat: 51.4756, lng: -0.1366, lines: ["Northern"] },
]

/**
 * Find stations within a given radius of a point
 */
export function findNearbyStations(
    lat: number,
    lng: number,
    radiusMeters: number = 300
): TflStation[] {
    return TFL_STATIONS.filter(station => {
        const distance = haversineDistance(lat, lng, station.lat, station.lng)
        return distance <= radiusMeters
    })
}

/**
 * Find stations within radius of any point along a route
 */
export function findStationsNearRoute(
    routeCoordinates: [number, number][],  // [lng, lat] pairs
    radiusMeters: number = 300
): TflStation[] {
    const nearbySet = new Set<string>()
    const nearbyStations: TflStation[] = []

    for (const [lng, lat] of routeCoordinates) {
        for (const station of TFL_STATIONS) {
            if (!nearbySet.has(station.name)) {
                const distance = haversineDistance(lat, lng, station.lat, station.lng)
                if (distance <= radiusMeters) {
                    nearbySet.add(station.name)
                    nearbyStations.push(station)
                }
            }
        }
    }

    return nearbyStations
}

/**
 * Haversine distance between two points in meters
 */
function haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371000 // Earth radius in meters
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180)
}
