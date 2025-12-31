/**
 * TfL Footfall Data Loader
 * ========================
 * Parses TfL station footfall CSV data and provides query functions.
 */

export interface FootfallRecord {
    date: Date
    dateString: string  // YYYYMMDD format for lookups
    dayOfWeek: string
    station: string
    entries: number
    exits: number
    total: number  // entries + exits
}

// In-memory cache
let footfallCache: FootfallRecord[] | null = null
let loadingPromise: Promise<FootfallRecord[]> | null = null

/**
 * Load and parse TfL footfall CSV data from both files
 */
export async function loadTflFootfallData(): Promise<FootfallRecord[]> {
    // Return cached data if available
    if (footfallCache) {
        return footfallCache
    }

    // If already loading, wait for that promise
    if (loadingPromise) {
        return loadingPromise
    }

    loadingPromise = (async () => {
        console.log('[TflDataLoader] Loading TfL footfall data...')
        const startTime = Date.now()

        const allRecords: FootfallRecord[] = []

        // Load both CSV files
        const files = [
            '/tfl_footfall_data/2023.csv',
            '/tfl_footfall_data/StationFootfall_2024_2025 .csv'
        ]

        for (const file of files) {
            try {
                const response = await fetch(file)
                if (!response.ok) {
                    console.warn(`[TflDataLoader] Could not load ${file}`)
                    continue
                }

                const text = await response.text()
                const records = parseCSV(text)
                // Use loop instead of spread to avoid stack overflow on large arrays
                for (const record of records) {
                    allRecords.push(record)
                }
                console.log(`[TflDataLoader] Loaded ${records.length} records from ${file}`)
            } catch (err) {
                console.error(`[TflDataLoader] Error loading ${file}:`, err)
            }
        }

        // Sort by date
        allRecords.sort((a, b) => a.date.getTime() - b.date.getTime())

        const elapsed = Date.now() - startTime
        console.log(`[TflDataLoader] Loaded ${allRecords.length} total records in ${elapsed}ms`)

        footfallCache = allRecords
        return allRecords
    })()

    return loadingPromise
}

/**
 * Parse CSV text into FootfallRecord array
 */
function parseCSV(text: string): FootfallRecord[] {
    const lines = text.split(/\r?\n/)
    const records: FootfallRecord[] = []

    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const parts = line.split(',')
        if (parts.length < 5) continue

        const [dateStr, dayOfWeek, station, entryStr, exitStr] = parts

        // Parse date (YYYYMMDD format)
        const year = parseInt(dateStr.substring(0, 4))
        const month = parseInt(dateStr.substring(4, 6)) - 1 // 0-indexed
        const day = parseInt(dateStr.substring(6, 8))

        if (isNaN(year) || isNaN(month) || isNaN(day)) continue

        const date = new Date(year, month, day)
        const entries = parseInt(entryStr) || 0
        const exits = parseInt(exitStr) || 0

        records.push({
            date,
            dateString: dateStr,
            dayOfWeek,
            station,
            entries,
            exits,
            total: entries + exits
        })
    }

    return records
}

/**
 * Get footfall data for a specific station and date range
 */
export function getStationFootfall(
    allData: FootfallRecord[],
    stationName: string,
    startDate: Date,
    endDate: Date
): FootfallRecord[] {
    return allData.filter(record =>
        record.station === stationName &&
        record.date >= startDate &&
        record.date <= endDate
    )
}

/**
 * Get the 14-week window around a protest date
 * 7 weeks before, protest week, 7 weeks after
 */
export function get14WeekWindow(protestDate: Date): { start: Date; end: Date } {
    const start = new Date(protestDate)
    start.setDate(start.getDate() - 49) // 7 weeks before

    const end = new Date(protestDate)
    end.setDate(end.getDate() + 49) // 7 weeks after

    return { start, end }
}

/**
 * Get footfall for a specific date and station
 */
export function getFootfallForDate(
    allData: FootfallRecord[],
    stationName: string,
    date: Date
): FootfallRecord | null {
    const dateStr = formatDateString(date)
    return allData.find(r => r.station === stationName && r.dateString === dateStr) || null
}

/**
 * Get all records for the same day of week within a date range
 */
export function getSameDayRecords(
    allData: FootfallRecord[],
    stationName: string,
    targetDayOfWeek: string,
    startDate: Date,
    endDate: Date
): FootfallRecord[] {
    return allData.filter(record =>
        record.station === stationName &&
        record.dayOfWeek === targetDayOfWeek &&
        record.date >= startDate &&
        record.date <= endDate
    )
}

/**
 * Format date as YYYYMMDD
 */
export function formatDateString(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}${month}${day}`
}

/**
 * Get all unique stations in the data
 */
export function getUniqueStations(allData: FootfallRecord[]): string[] {
    return [...new Set(allData.map(r => r.station))].sort()
}

/**
 * Get date range covered by the data
 */
export function getDataDateRange(allData: FootfallRecord[]): { min: Date; max: Date } | null {
    if (allData.length === 0) return null
    return {
        min: allData[0].date,
        max: allData[allData.length - 1].date
    }
}
