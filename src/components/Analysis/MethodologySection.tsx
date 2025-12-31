/**
 * Methodology Section
 * ===================
 * Explains the statistical methodology used in the analysis.
 */

import { useState } from 'react'

export function MethodologySection() {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div className="border border-slate-700 rounded-xl overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 flex items-center justify-between bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
                <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    📊 How We Calculate Impact
                </span>
                <span className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </button>

            {isExpanded && (
                <div className="p-4 space-y-4 text-sm text-slate-400 bg-slate-900/30">
                    {/* Step 1 */}
                    <div>
                        <h5 className="font-medium text-slate-300 mb-1">1. Identify Nearby Stations</h5>
                        <p>
                            We find all TfL stations within <strong className="text-white">300 meters</strong> of the protest route
                            using GPS coordinates and the Haversine distance formula.
                        </p>
                    </div>

                    {/* Step 2 */}
                    <div>
                        <h5 className="font-medium text-slate-300 mb-1">2. Build a 14-Week Baseline</h5>
                        <p>
                            We collect entry/exit tap data for <strong className="text-white">7 weeks before and 7 weeks after</strong> the protest.
                            We only compare the same day of week (e.g., all Saturdays with Saturdays).
                        </p>
                    </div>

                    {/* Step 3 */}
                    <div>
                        <h5 className="font-medium text-slate-300 mb-1">3. Weather Adjustment</h5>
                        <p>
                            Weather significantly affects footfall. We fetch historical weather from Open-Meteo and
                            calculate a <strong className="text-white">weather-adjusted baseline</strong> using only days with similar conditions
                            (temperature within 5°C, similar precipitation levels).
                        </p>
                    </div>

                    {/* Step 4 */}
                    <div>
                        <h5 className="font-medium text-slate-300 mb-1">4. Statistical Testing</h5>
                        <p>
                            We calculate a <strong className="text-white">Z-score</strong>: how many standard deviations the protest day
                            is from the baseline mean.
                        </p>
                        <div className="bg-slate-800/50 rounded p-2 mt-2 font-mono text-xs">
                            Z = (protest_day - mean) / standard_deviation
                        </div>
                        <ul className="mt-2 space-y-1 list-disc list-inside text-slate-500">
                            <li>|Z| &lt; 1: Within normal variation (no impact)</li>
                            <li>|Z| 1-2: Mild variation (possible impact, not significant)</li>
                            <li>|Z| &gt; 2: Significant variation (p &lt; 0.05)</li>
                        </ul>
                    </div>

                    {/* Step 5 */}
                    <div>
                        <h5 className="font-medium text-slate-300 mb-1">5. Interpretation</h5>
                        <p>
                            A <strong className="text-white">p-value &gt; 0.05</strong> means the protest day footfall is within
                            normal weekly variation. This provides evidence that the protest did not significantly
                            affect station usage.
                        </p>
                    </div>

                    {/* Data sources */}
                    <div className="pt-3 border-t border-slate-700">
                        <h5 className="font-medium text-slate-300 mb-2">Data Sources</h5>
                        <ul className="space-y-1 text-xs">
                            <li className="flex items-center gap-2">
                                <span className="text-blue-400">🚇</span>
                                <span>TfL Oyster/Contactless tap data (daily aggregates)</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-yellow-400">🌤️</span>
                                <span>Open-Meteo historical weather API</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-green-400">📍</span>
                                <span>TfL station coordinates</span>
                            </li>
                        </ul>
                    </div>

                    {/* Limitations */}
                    <div className="pt-3 border-t border-slate-700">
                        <h5 className="font-medium text-slate-300 mb-2">Limitations</h5>
                        <ul className="space-y-1 text-xs text-slate-500">
                            <li>• Analysis is at station level, not street level</li>
                            <li>• Cannot distinguish cause of variation (protest vs events vs holidays)</li>
                            <li>• Weekend protests may show less variation due to lower baseline footfall</li>
                            <li>• Data is for TfL services only (excludes buses, walking, driving)</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    )
}
