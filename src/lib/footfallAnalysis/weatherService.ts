/**
 * Weather Service
 * ===============
 * Fetches historical weather data from Open-Meteo API for London.
 * Used to adjust footfall analysis for weather effects.
 */

export interface DailyWeather {
    date: Date
    dateString: string  // YYYY-MM-DD
    tempMax: number     // °C
    tempMin: number     // °C
    precipitation: number  // mm
    weatherCode: number    // WMO weather code
    weatherDescription: string
}

export type WeatherImpact = 'GOOD' | 'MODERATE' | 'POOR'

// Cache weather data
const weatherCache = new Map<string, DailyWeather[]>()

/**
 * Fetch historical weather for London for a date range
 * Uses Open-Meteo Archive API (free, no key required)
 */
export async function fetchLondonWeather(
    startDate: Date,
    endDate: Date
): Promise<DailyWeather[]> {
    const startStr = formatDate(startDate)
    const endStr = formatDate(endDate)
    const cacheKey = `${startStr}_${endStr}`

    // Check cache
    if (weatherCache.has(cacheKey)) {
        return weatherCache.get(cacheKey)!
    }

    console.log(`[WeatherService] Fetching weather from ${startStr} to ${endStr}`)

    // London coordinates
    const lat = 51.5074
    const lng = -0.1278

    const url = new URL('https://archive-api.open-meteo.com/v1/archive')
    url.searchParams.set('latitude', lat.toString())
    url.searchParams.set('longitude', lng.toString())
    url.searchParams.set('start_date', startStr)
    url.searchParams.set('end_date', endStr)
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code')
    url.searchParams.set('timezone', 'Europe/London')

    try {
        const response = await fetch(url.toString())

        if (!response.ok) {
            console.error('[WeatherService] API error:', response.status)
            return generateFallbackWeather(startDate, endDate)
        }

        const data = await response.json()
        const weather = parseWeatherResponse(data)

        // Cache the result
        weatherCache.set(cacheKey, weather)

        console.log(`[WeatherService] Loaded ${weather.length} days of weather data`)
        return weather

    } catch (err) {
        console.error('[WeatherService] Fetch error:', err)
        return generateFallbackWeather(startDate, endDate)
    }
}

/**
 * Parse Open-Meteo API response
 */
function parseWeatherResponse(data: any): DailyWeather[] {
    const weather: DailyWeather[] = []

    if (!data.daily?.time) return weather

    const { time, temperature_2m_max, temperature_2m_min, precipitation_sum, weather_code } = data.daily

    for (let i = 0; i < time.length; i++) {
        const dateStr = time[i]
        const code = weather_code?.[i] ?? 0

        weather.push({
            date: new Date(dateStr),
            dateString: dateStr,
            tempMax: temperature_2m_max?.[i] ?? 15,
            tempMin: temperature_2m_min?.[i] ?? 8,
            precipitation: precipitation_sum?.[i] ?? 0,
            weatherCode: code,
            weatherDescription: getWeatherDescription(code)
        })
    }

    return weather
}

/**
 * Generate fallback weather if API fails
 * Uses average London weather patterns
 */
function generateFallbackWeather(startDate: Date, endDate: Date): DailyWeather[] {
    const weather: DailyWeather[] = []
    const current = new Date(startDate)

    while (current <= endDate) {
        const month = current.getMonth()
        // Approximate London temperatures by month
        const tempPatterns: Record<number, { max: number; min: number }> = {
            0: { max: 8, min: 3 },  // January
            1: { max: 9, min: 3 },  // February
            2: { max: 11, min: 4 }, // March
            3: { max: 14, min: 6 }, // April
            4: { max: 17, min: 9 }, // May
            5: { max: 20, min: 12 }, // June
            6: { max: 23, min: 14 }, // July
            7: { max: 22, min: 14 }, // August
            8: { max: 19, min: 11 }, // September
            9: { max: 15, min: 9 },  // October
            10: { max: 11, min: 5 }, // November
            11: { max: 8, min: 3 }   // December
        }

        const pattern = tempPatterns[month] || { max: 14, min: 8 }

        weather.push({
            date: new Date(current),
            dateString: formatDate(current),
            tempMax: pattern.max + (Math.random() - 0.5) * 4,
            tempMin: pattern.min + (Math.random() - 0.5) * 3,
            precipitation: Math.random() < 0.35 ? Math.random() * 10 : 0, // 35% chance of rain
            weatherCode: Math.random() < 0.35 ? 61 : 0, // Rain or clear
            weatherDescription: 'Estimated (API unavailable)'
        })

        current.setDate(current.getDate() + 1)
    }

    return weather
}

/**
 * WMO Weather Code to description
 */
function getWeatherDescription(code: number): string {
    const descriptions: Record<number, string> = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Fog',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with hail',
        99: 'Thunderstorm with heavy hail'
    }

    return descriptions[code] || `Weather code ${code}`
}

/**
 * Classify weather impact on footfall
 */
export function getWeatherImpact(weather: DailyWeather): WeatherImpact {
    // Poor: Heavy rain, very cold, or extreme weather
    if (weather.precipitation > 10 || weather.tempMax < 3 || weather.weatherCode >= 65) {
        return 'POOR'
    }

    // Moderate: Some rain, cold, or cloudy
    if (weather.precipitation > 2 || weather.tempMax < 8 || weather.weatherCode >= 51) {
        return 'MODERATE'
    }

    // Good: Dry, mild weather
    return 'GOOD'
}

/**
 * Get weather for a specific date
 */
export function getWeatherForDate(
    weatherData: DailyWeather[],
    date: Date
): DailyWeather | null {
    const dateStr = formatDate(date)
    return weatherData.find(w => w.dateString === dateStr) || null
}

/**
 * Check if two weather days are "similar" for comparison
 */
export function isSimilarWeather(w1: DailyWeather, w2: DailyWeather): boolean {
    // Same weather impact category
    if (getWeatherImpact(w1) !== getWeatherImpact(w2)) return false

    // Temperature within 5°C
    if (Math.abs(w1.tempMax - w2.tempMax) > 5) return false

    // Both dry or both had rain
    const bothDry = w1.precipitation < 1 && w2.precipitation < 1
    const bothRainy = w1.precipitation >= 1 && w2.precipitation >= 1
    if (!bothDry && !bothRainy) return false

    return true
}

/**
 * Format date as YYYY-MM-DD for API
 */
function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * Get emoji for weather code
 */
export function getWeatherEmoji(code: number): string {
    if (code === 0 || code === 1) return '☀️'
    if (code <= 3) return '⛅'
    if (code === 45 || code === 48) return '🌫️'
    if (code >= 51 && code <= 55) return '🌧️'
    if (code >= 61 && code <= 65) return '🌧️'
    if (code >= 71 && code <= 75) return '❄️'
    if (code >= 80 && code <= 82) return '🌦️'
    if (code >= 95) return '⛈️'
    return '🌤️'
}
