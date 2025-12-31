/**
 * Statistical Analysis for Footfall Data
 * =======================================
 * Performs 14-week statistical analysis to determine if protest days
 * show significant deviation from baseline footfall.
 */

import type { FootfallRecord } from './tflDataLoader'
import type { DailyWeather } from './weatherService'
import { getSameDayRecords, get14WeekWindow, getFootfallForDate } from './tflDataLoader'
import { getWeatherForDate, isSimilarWeather, getWeatherImpact } from './weatherService'

export interface BaselineStats {
    mean: number
    median: number
    stdDev: number
    min: number
    max: number
    count: number
    values: number[]
}

export interface WeatherAdjustedStats {
    mean: number
    stdDev: number
    count: number
    matchDescription: string
}

export type ImpactCategory = 'NO_IMPACT' | 'MINOR_DECREASE' | 'MODERATE_DECREASE' | 'SIGNIFICANT_DECREASE' | 'INCREASE' | 'INSUFFICIENT_DATA'

export interface AnalysisResult {
    stationName: string
    protestDate: Date
    protestDayOfWeek: string
    protestDayFootfall: number | null
    protestDayWeather: DailyWeather | null

    // 14-week baseline
    baseline: BaselineStats

    // Weather-adjusted baseline
    adjustedBaseline: WeatherAdjustedStats | null

    // Statistical tests
    zScore: number | null
    adjustedZScore: number | null
    percentile: number | null
    pValue: number | null
    isSignificant: boolean

    // Interpretation
    impactCategory: ImpactCategory
    impactExplanation: string
    percentChange: number | null

    // Raw data for charting
    chartData: ChartDataPoint[]
}

export interface ChartDataPoint {
    date: Date
    dateString: string
    footfall: number
    isProtestDay: boolean
    weather: DailyWeather | null
    dayOfWeek: string
}

/**
 * Main analysis function
 */
export function analyzeStationFootfall(
    footfallData: FootfallRecord[],
    weatherData: DailyWeather[],
    stationName: string,
    protestDate: Date
): AnalysisResult {
    // Get date window
    const { start, end } = get14WeekWindow(protestDate)

    // Get protest day details
    const protestRecord = getFootfallForDate(footfallData, stationName, protestDate)
    const protestDayOfWeek = protestRecord?.dayOfWeek || getDayOfWeek(protestDate)
    const protestDayFootfall = protestRecord?.total || null
    const protestDayWeather = getWeatherForDate(weatherData, protestDate)

    // Get same day-of-week records (excluding protest day)
    const sameDayRecords = getSameDayRecords(
        footfallData,
        stationName,
        protestDayOfWeek,
        start,
        end
    ).filter(r => r.dateString !== protestRecord?.dateString)

    // Calculate baseline stats
    const baseline = calculateBaselineStats(sameDayRecords)

    // Calculate weather-adjusted stats if we have weather data
    let adjustedBaseline: WeatherAdjustedStats | null = null
    if (protestDayWeather && weatherData.length > 0) {
        const similarWeatherRecords = sameDayRecords.filter(record => {
            const weather = getWeatherForDate(weatherData, record.date)
            return weather && isSimilarWeather(protestDayWeather, weather)
        })

        if (similarWeatherRecords.length >= 3) {
            const stats = calculateBaselineStats(similarWeatherRecords)
            adjustedBaseline = {
                mean: stats.mean,
                stdDev: stats.stdDev,
                count: similarWeatherRecords.length,
                matchDescription: `${similarWeatherRecords.length} ${getWeatherImpact(protestDayWeather).toLowerCase()} weather ${protestDayOfWeek}s`
            }
        }
    }

    // Calculate z-score
    let zScore: number | null = null
    let adjustedZScore: number | null = null
    let percentile: number | null = null
    let pValue: number | null = null
    let isSignificant = false

    if (protestDayFootfall !== null && baseline.stdDev > 0) {
        zScore = (protestDayFootfall - baseline.mean) / baseline.stdDev
        percentile = calculatePercentile(protestDayFootfall, baseline.values)
        pValue = calculatePValue(zScore)
        isSignificant = pValue < 0.05

        if (adjustedBaseline && adjustedBaseline.stdDev > 0) {
            adjustedZScore = (protestDayFootfall - adjustedBaseline.mean) / adjustedBaseline.stdDev
        }
    }

    // Determine impact category
    const { category, explanation, percentChange } = interpretResults(
        protestDayFootfall,
        baseline,
        adjustedBaseline,
        zScore,
        adjustedZScore,
        isSignificant
    )

    // Build chart data
    const stationData = footfallData.filter(r =>
        r.station === stationName &&
        r.date >= start &&
        r.date <= end
    )

    const chartData: ChartDataPoint[] = stationData.map(record => ({
        date: record.date,
        dateString: record.dateString,
        footfall: record.total,
        isProtestDay: record.dateString === protestRecord?.dateString,
        weather: getWeatherForDate(weatherData, record.date),
        dayOfWeek: record.dayOfWeek
    }))

    return {
        stationName,
        protestDate,
        protestDayOfWeek,
        protestDayFootfall,
        protestDayWeather,
        baseline,
        adjustedBaseline,
        zScore,
        adjustedZScore,
        percentile,
        pValue,
        isSignificant,
        impactCategory: category,
        impactExplanation: explanation,
        percentChange,
        chartData
    }
}

/**
 * Calculate baseline statistics
 */
function calculateBaselineStats(records: FootfallRecord[]): BaselineStats {
    if (records.length === 0) {
        return {
            mean: 0,
            median: 0,
            stdDev: 0,
            min: 0,
            max: 0,
            count: 0,
            values: []
        }
    }

    const values = records.map(r => r.total)
    const sorted = [...values].sort((a, b) => a - b)

    const sum = values.reduce((a, b) => a + b, 0)
    const mean = sum / values.length

    const squareDiffs = values.map(v => (v - mean) ** 2)
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length
    const stdDev = Math.sqrt(avgSquareDiff)

    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2

    return {
        mean,
        median,
        stdDev,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        count: values.length,
        values: sorted
    }
}

/**
 * Calculate percentile of a value in a sorted array
 */
function calculatePercentile(value: number, sortedValues: number[]): number {
    if (sortedValues.length === 0) return 50

    let count = 0
    for (const v of sortedValues) {
        if (v < value) count++
    }

    return (count / sortedValues.length) * 100
}

/**
 * Calculate two-tailed p-value from z-score
 * Using standard normal approximation
 */
function calculatePValue(zScore: number): number {
    // Use error function approximation
    const absZ = Math.abs(zScore)
    const t = 1 / (1 + 0.2316419 * absZ)
    const d = 0.3989423 * Math.exp(-absZ * absZ / 2)
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))

    // Two-tailed p-value
    return 2 * p
}

/**
 * Interpret analysis results into human-readable category and explanation
 */
function interpretResults(
    protestFootfall: number | null,
    baseline: BaselineStats,
    adjustedBaseline: WeatherAdjustedStats | null,
    zScore: number | null,
    adjustedZScore: number | null,
    isSignificant: boolean
): { category: ImpactCategory; explanation: string; percentChange: number | null } {

    if (protestFootfall === null || baseline.count < 3) {
        return {
            category: 'INSUFFICIENT_DATA',
            explanation: 'Not enough data to perform statistical analysis for this station.',
            percentChange: null
        }
    }

    const percentChange = ((protestFootfall - baseline.mean) / baseline.mean) * 100

    // Use adjusted z-score if available, otherwise raw
    const effectiveZ = adjustedZScore ?? zScore

    if (effectiveZ === null) {
        return {
            category: 'INSUFFICIENT_DATA',
            explanation: 'Unable to calculate statistical significance.',
            percentChange
        }
    }

    // Interpretation based on z-score
    if (effectiveZ > 1) {
        return {
            category: 'INCREASE',
            explanation: `Footfall was ${Math.abs(percentChange).toFixed(1)}% HIGHER than the ${adjustedBaseline ? 'weather-adjusted' : ''} baseline. The protest may have attracted more visitors to the area.`,
            percentChange
        }
    }

    if (effectiveZ > -1) {
        return {
            category: 'NO_IMPACT',
            explanation: `Footfall was within normal variation (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}% of baseline). No statistically significant impact detected.`,
            percentChange
        }
    }

    if (effectiveZ > -2 && !isSignificant) {
        return {
            category: 'MINOR_DECREASE',
            explanation: `Footfall was ${Math.abs(percentChange).toFixed(1)}% below baseline, but this is within normal weekly variation and not statistically significant (p > 0.05).`,
            percentChange
        }
    }

    if (effectiveZ > -2) {
        return {
            category: 'MODERATE_DECREASE',
            explanation: `Footfall was ${Math.abs(percentChange).toFixed(1)}% below baseline. This may be related to the protest, but should be interpreted with caution.`,
            percentChange
        }
    }

    return {
        category: 'SIGNIFICANT_DECREASE',
        explanation: `Footfall was ${Math.abs(percentChange).toFixed(1)}% below baseline, which is statistically significant (z = ${effectiveZ.toFixed(2)}, p < 0.05).`,
        percentChange
    }
}

/**
 * Get day of week name from date
 */
function getDayOfWeek(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[date.getDay()]
}

/**
 * Format z-score for display
 */
export function formatZScore(z: number | null): string {
    if (z === null) return 'N/A'
    const sign = z >= 0 ? '+' : ''
    return `${sign}${z.toFixed(2)}σ`
}

/**
 * Format p-value for display
 */
export function formatPValue(p: number | null): string {
    if (p === null) return 'N/A'
    if (p < 0.001) return 'p < 0.001'
    if (p < 0.01) return `p < 0.01`
    if (p < 0.05) return `p < 0.05`
    return `p = ${p.toFixed(3)}`
}
