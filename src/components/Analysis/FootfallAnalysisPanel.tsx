/**
 * Footfall Analysis Panel
 * =======================
 * Main container for TfL footfall statistical analysis.
 */

import { useState, useEffect } from 'react'
import type { ProtestWithRoute } from '../../lib/database.types'
import {
    findStationsNearRoute,
    loadTflFootfallData,
    fetchLondonWeather,
    get14WeekWindow,
    analyzeStationFootfall,
    type AnalysisResult
} from '../../lib/footfallAnalysis'
import { StationAnalysisCard } from './StationAnalysisCard'
import { MethodologySection } from './MethodologySection'

interface Props {
    protest: ProtestWithRoute
}

export function FootfallAnalysisPanel({ protest }: Props) {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [results, setResults] = useState<AnalysisResult[]>([])
    const [expandedStation, setExpandedStation] = useState<string | null>(null)

    useEffect(() => {
        runAnalysis()
    }, [protest.id])

    async function runAnalysis() {
        setIsLoading(true)
        setError(null)

        try {
            // Get route coordinates
            const routeCoords = protest.route?.geometry?.coordinates as [number, number][] || []

            if (routeCoords.length === 0) {
                setError('No route data available for this protest.')
                setIsLoading(false)
                return
            }

            // Find nearby stations (300m radius)
            const nearbyStations = findStationsNearRoute(routeCoords, 300)

            if (nearbyStations.length === 0) {
                setError('No TfL stations found within 300m of the protest route.')
                setIsLoading(false)
                return
            }

            console.log(`[FootfallAnalysis] Found ${nearbyStations.length} nearby stations:`, nearbyStations.map(s => s.name))

            // Load footfall data
            const footfallData = await loadTflFootfallData()

            // Get protest date
            const protestDate = new Date(protest.event_date)

            // Fetch weather for 14-week window
            const { start, end } = get14WeekWindow(protestDate)
            const weatherData = await fetchLondonWeather(start, end)

            // Run analysis for each station
            const analysisResults: AnalysisResult[] = []

            for (const station of nearbyStations) {
                const result = analyzeStationFootfall(
                    footfallData,
                    weatherData,
                    station.name,
                    protestDate
                )
                analysisResults.push(result)
            }

            // Sort by impact (most significant first)
            analysisResults.sort((a, b) => {
                if (a.zScore === null) return 1
                if (b.zScore === null) return -1
                return Math.abs(b.zScore) - Math.abs(a.zScore)
            })

            setResults(analysisResults)

            // Auto-expand first station
            if (analysisResults.length > 0) {
                setExpandedStation(analysisResults[0].stationName)
            }

        } catch (err) {
            console.error('[FootfallAnalysis] Error:', err)
            setError('Failed to load footfall analysis data.')
        } finally {
            setIsLoading(false)
        }
    }

    // Calculate summary stats
    const validResults = results.filter(r => r.protestDayFootfall !== null)
    const avgPercentChange = validResults.length > 0
        ? validResults.reduce((sum, r) => sum + (r.percentChange || 0), 0) / validResults.length
        : null
    const significantCount = validResults.filter(r => r.isSignificant).length

    if (isLoading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🚇</span>
                    <span className="text-slate-400">Loading TfL footfall analysis...</span>
                </div>
                <div className="h-24 bg-slate-700/50 rounded-lg"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400">
                    <span>⚠️</span>
                    <span>{error}</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    🚇 TfL Footfall Analysis
                </h4>
                <span className="text-xs text-slate-500">14-week comparison</span>
            </div>

            {/* Summary Card */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-2xl font-bold text-blue-400">{results.length}</div>
                        <div className="text-xs text-slate-400">Nearby Stations</div>
                    </div>
                    <div>
                        <div className={`text-2xl font-bold ${avgPercentChange === null ? 'text-slate-400' :
                            avgPercentChange > 0 ? 'text-green-400' :
                                avgPercentChange > -5 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                            {avgPercentChange !== null
                                ? `${avgPercentChange > 0 ? '+' : ''}${avgPercentChange.toFixed(1)}%`
                                : 'N/A'
                            }
                        </div>
                        <div className="text-xs text-slate-400">Avg. Change</div>
                    </div>
                    <div>
                        <div className={`text-2xl font-bold ${significantCount === 0 ? 'text-green-400' : 'text-yellow-400'
                            }`}>
                            {significantCount}
                        </div>
                        <div className="text-xs text-slate-400">Significant</div>
                    </div>
                </div>

                {/* Verdict */}
                <div className="mt-3 pt-3 border-t border-blue-500/20">
                    <p className="text-sm text-slate-300 text-center">
                        {significantCount === 0 && validResults.length > 0
                            ? '✅ No statistically significant impact on station footfall detected'
                            : significantCount > 0
                                ? `⚠️ ${significantCount} station(s) showed significant variation`
                                : 'ℹ️ Insufficient data for this date range'
                        }
                    </p>
                </div>
            </div>

            {/* Station Cards */}
            <div className="space-y-2">
                {results.map(result => (
                    <StationAnalysisCard
                        key={result.stationName}
                        result={result}
                        isExpanded={expandedStation === result.stationName}
                        onToggle={() => setExpandedStation(
                            expandedStation === result.stationName ? null : result.stationName
                        )}
                    />
                ))}
            </div>

            {/* Methodology */}
            <MethodologySection />
        </div>
    )
}
