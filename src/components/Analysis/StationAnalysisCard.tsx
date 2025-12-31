/**
 * Station Analysis Card
 * =====================
 * Displays analysis results for a single TfL station.
 */

import type { AnalysisResult } from '../../lib/footfallAnalysis'
import { formatZScore, formatPValue, getWeatherEmoji } from '../../lib/footfallAnalysis'
import { FootfallChart } from './FootfallChart'

interface Props {
    result: AnalysisResult
    isExpanded: boolean
    onToggle: () => void
}

export function StationAnalysisCard({ result, isExpanded, onToggle }: Props) {
    const {
        stationName,
        protestDayFootfall,
        protestDayOfWeek,
        protestDayWeather,
        baseline,
        adjustedBaseline,
        zScore,
        percentile,
        pValue,
        isSignificant,
        impactCategory,
        impactExplanation,
        percentChange,
        chartData
    } = result

    // Determine badge color based on impact
    const badgeConfig = {
        'NO_IMPACT': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'No Impact' },
        'MINOR_DECREASE': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Minor' },
        'MODERATE_DECREASE': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', label: 'Moderate' },
        'SIGNIFICANT_DECREASE': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Significant' },
        'INCREASE': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Increase' },
        'INSUFFICIENT_DATA': { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', label: 'No Data' }
    }

    const badge = badgeConfig[impactCategory]

    return (
        <div className={`rounded-xl border transition-all ${badge.border} ${isExpanded ? 'bg-slate-800/70' : 'bg-slate-800/30'}`}>
            {/* Header - Always visible */}
            <button
                onClick={onToggle}
                className="w-full p-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors rounded-xl"
            >
                <div className="flex items-center gap-3">
                    <span className="text-lg">🚇</span>
                    <div className="text-left">
                        <div className="font-medium text-white">{stationName}</div>
                        <div className="text-xs text-slate-400">
                            {protestDayFootfall !== null
                                ? `${protestDayFootfall.toLocaleString()} taps on protest day`
                                : 'No data for protest day'
                            }
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Percent change */}
                    {percentChange !== null && (
                        <span className={`text-sm font-medium ${percentChange > 0 ? 'text-green-400' :
                            percentChange > -5 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                            {percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%
                        </span>
                    )}

                    {/* Impact badge */}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                    </span>

                    {/* Expand arrow */}
                    <span className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                    </span>
                </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="px-3 pb-3 space-y-4">
                    {/* Explanation */}
                    <div className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-sm text-slate-300">{impactExplanation}</p>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="bg-slate-900/50 rounded-lg p-2">
                            <div className="text-lg font-bold text-white">
                                {protestDayFootfall?.toLocaleString() || 'N/A'}
                            </div>
                            <div className="text-xs text-slate-500">Protest Day</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-2">
                            <div className="text-lg font-bold text-slate-300">
                                {Math.round(baseline.mean).toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500">Avg {protestDayOfWeek}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-2">
                            <div className={`text-lg font-bold ${zScore === null ? 'text-slate-400' :
                                Math.abs(zScore) < 1 ? 'text-green-400' :
                                    Math.abs(zScore) < 2 ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                {formatZScore(zScore)}
                            </div>
                            <div className="text-xs text-slate-500">Z-Score</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-2">
                            <div className={`text-lg font-bold ${isSignificant ? 'text-red-400' : 'text-green-400'}`}>
                                {formatPValue(pValue)}
                            </div>
                            <div className="text-xs text-slate-500">P-Value</div>
                        </div>
                    </div>

                    {/* Weather info */}
                    {protestDayWeather && (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span>{getWeatherEmoji(protestDayWeather.weatherCode)}</span>
                            <span>
                                Protest day weather: {protestDayWeather.weatherDescription},
                                {' '}{Math.round(protestDayWeather.tempMax)}°C
                                {protestDayWeather.precipitation > 0 && `, ${protestDayWeather.precipitation.toFixed(1)}mm rain`}
                            </span>
                        </div>
                    )}

                    {/* Weather adjustment info */}
                    {adjustedBaseline && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-sm">
                            <span className="text-blue-400">🌤️ Weather-adjusted baseline:</span>
                            <span className="text-slate-300 ml-2">
                                {Math.round(adjustedBaseline.mean).toLocaleString()} avg from {adjustedBaseline.matchDescription}
                            </span>
                        </div>
                    )}

                    {/* Chart */}
                    {chartData.length > 0 && (
                        <div className="mt-4">
                            <div className="text-xs text-slate-500 mb-2">14-Week Footfall Trend</div>
                            <FootfallChart
                                data={chartData}
                                baseline={baseline}
                                protestDayOfWeek={protestDayOfWeek}
                            />
                        </div>
                    )}

                    {/* Baseline info */}
                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Based on {baseline.count} previous {protestDayOfWeek}s</span>
                        <span>Range: {baseline.min.toLocaleString()} - {baseline.max.toLocaleString()}</span>
                        <span>Std Dev: ±{Math.round(baseline.stdDev).toLocaleString()}</span>
                        {percentile !== null && <span>Percentile: {percentile.toFixed(0)}th</span>}
                    </div>
                </div>
            )}
        </div>
    )
}
