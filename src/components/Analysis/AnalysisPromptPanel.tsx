/**
 * Analysis Prompt Panel
 * =====================
 * Displays a generated LLM prompt for unbiased analysis of protest impact.
 * Includes TfL footfall analysis data for comprehensive assessment.
 * Allows users to copy the prompt for use with ChatGPT, Claude, etc.
 */

import { useState, useEffect, useCallback } from 'react'
import type { ProtestWithRoute } from '../../lib/database.types'
import type { BusinessWithStatus } from '../../lib/businessStatusHelper'
import {
    logAndGeneratePrompt,
    generateAnalysisSummary,
    type AnalysisData
} from '../../lib/llmPromptGenerator'
import {
    findStationsNearRoute,
    loadTflFootfallData,
    fetchLondonWeather,
    get14WeekWindow,
    analyzeStationFootfall,
    type AnalysisResult
} from '../../lib/footfallAnalysis'

interface Props {
    protest: ProtestWithRoute
    businesses: BusinessWithStatus[]
}

export function AnalysisPromptPanel({ protest, businesses }: Props) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [prompt, setPrompt] = useState('')
    const [copied, setCopied] = useState(false)
    const [isLoadingTfl, setIsLoadingTfl] = useState(false)
    const [tflResults, setTflResults] = useState<AnalysisResult[]>([])
    const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)

    // Load TfL data and generate prompt when businesses change
    useEffect(() => {
        if (businesses.length > 0) {
            loadTflAndGeneratePrompt()
        }
    }, [protest, businesses])

    async function loadTflAndGeneratePrompt() {
        setIsLoadingTfl(true)

        try {
            // Get route coordinates
            const routeCoords = protest.route?.geometry?.coordinates as [number, number][] || []

            let tflAnalysisResults: AnalysisResult[] = []

            if (routeCoords.length > 0) {
                // Find nearby stations (300m radius)
                const nearbyStations = findStationsNearRoute(routeCoords, 300)

                if (nearbyStations.length > 0) {
                    console.log(`[AnalysisPrompt] Found ${nearbyStations.length} TfL stations for analysis`)

                    // Load footfall data
                    const footfallData = await loadTflFootfallData()

                    // Get protest date
                    const protestDate = new Date(protest.event_date)

                    // Fetch weather for 14-week window
                    const { start, end } = get14WeekWindow(protestDate)
                    const weatherData = await fetchLondonWeather(start, end)

                    // Run analysis for each station
                    for (const station of nearbyStations) {
                        const result = analyzeStationFootfall(
                            footfallData,
                            weatherData,
                            station.name,
                            protestDate
                        )
                        tflAnalysisResults.push(result)
                    }

                    // Sort by impact (most significant first)
                    tflAnalysisResults.sort((a, b) => {
                        if (a.zScore === null) return 1
                        if (b.zScore === null) return -1
                        return Math.abs(b.zScore) - Math.abs(a.zScore)
                    })
                }
            }

            setTflResults(tflAnalysisResults)

            // Generate prompt with TfL data
            const generatedPrompt = logAndGeneratePrompt(protest, businesses, tflAnalysisResults)
            setPrompt(generatedPrompt)

            // Store analysis data for display
            setAnalysisData(generateAnalysisSummary(protest, businesses, tflAnalysisResults))

        } catch (err) {
            console.error('[AnalysisPrompt] Error loading TfL data:', err)
            // Generate prompt without TfL data
            const generatedPrompt = logAndGeneratePrompt(protest, businesses, [])
            setPrompt(generatedPrompt)
            setAnalysisData(generateAnalysisSummary(protest, businesses, []))
        } finally {
            setIsLoadingTfl(false)
        }
    }

    // Copy to clipboard
    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(prompt)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (e) {
            console.error('Failed to copy:', e)
        }
    }, [prompt])

    // Get summary for display
    const summary = analysisData?.summary
    const tflSummary = analysisData?.tflSummary

    if (!summary || summary.total === 0) {
        return null
    }

    return (
        <div className="border border-slate-700 rounded-xl overflow-hidden mt-3">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 flex items-center justify-between bg-gradient-to-r from-indigo-900/50 to-purple-900/50 hover:from-indigo-800/50 hover:to-purple-800/50 transition-colors"
            >
                <span className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    🤖 LLM Analysis Prompt
                    {isLoadingTfl && <span className="text-xs text-slate-400">(loading TfL data...)</span>}
                </span>
                <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="p-4 bg-slate-900/50 space-y-4">
                    {/* Quick stats - Business & TfL */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-800/50 rounded-lg p-2">
                            <div className="text-slate-400">Total POIs</div>
                            <div className="text-lg font-bold text-white">{summary.total.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                            <div className="text-slate-400">Would Be Open</div>
                            <div className="text-lg font-bold text-green-400">
                                {(summary.open + summary.partiallyOpen).toLocaleString()}
                                <span className="text-xs text-slate-500 ml-1">
                                    ({summary.total > 0 ? ((summary.open + summary.partiallyOpen) / summary.total * 100).toFixed(0) : 0}%)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* TfL Summary */}
                    {tflSummary && (
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <span>🚇</span>
                                <span className="text-sm font-medium text-blue-300">TfL Footfall Analysis</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                    <div className="text-slate-400">Stations</div>
                                    <div className="font-bold text-white">{tflSummary.stationsAnalyzed}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400">Avg Change</div>
                                    <div className={`font-bold ${tflSummary.avgPercentChange === null ? 'text-slate-400' :
                                            tflSummary.avgPercentChange > 0 ? 'text-green-400' :
                                                tflSummary.avgPercentChange > -5 ? 'text-yellow-400' : 'text-red-400'
                                        }`}>
                                        {tflSummary.avgPercentChange !== null
                                            ? `${tflSummary.avgPercentChange > 0 ? '+' : ''}${tflSummary.avgPercentChange.toFixed(1)}%`
                                            : 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-slate-400">Significant</div>
                                    <div className={`font-bold ${tflSummary.significantStations === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {tflSummary.significantStations}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div className="text-xs text-slate-400">
                        <p className="mb-2">
                            This prompt includes <strong className="text-slate-300">business data</strong> AND <strong className="text-blue-300">TfL footfall analysis</strong> for
                            {' '}<strong className="text-slate-300">unbiased, evidence-based analysis</strong>.
                        </p>
                        <p className="text-slate-500 italic">
                            Context: Legal experts argue the Met Police are using outdated powers. This data helps assess
                            claims of "serious disruption."
                        </p>
                    </div>

                    {/* Prompt preview */}
                    <div className="relative">
                        <pre className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto max-h-48 overflow-y-auto">
                            {prompt.slice(0, 600)}...
                        </pre>

                        {/* Copy button */}
                        <button
                            onClick={handleCopy}
                            disabled={isLoadingTfl}
                            className={`absolute top-2 right-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied
                                    ? 'bg-green-600 text-white'
                                    : isLoadingTfl
                                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                }`}
                        >
                            {copied ? '✓ Copied!' : isLoadingTfl ? '⏳ Loading...' : '📋 Copy Full Prompt'}
                        </button>
                    </div>

                    {/* Usage hint */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>💡</span>
                        <span>
                            Full prompt (~{prompt.length.toLocaleString()} chars) includes business data,
                            TfL station analysis, and analysis questions
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
