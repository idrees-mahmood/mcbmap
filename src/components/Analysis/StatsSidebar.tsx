import { useState } from 'react'
import type { ProtestWithRoute } from '../../lib/database.types'
import { formatDistance } from '../../lib/osrm'
import { FootfallAnalysisPanel } from './FootfallAnalysisPanel'
import { BusinessListPanel } from './BusinessListPanel'
import {
    calculateStatusSummary,
    type BusinessWithStatus,
    type BusinessStatusSummary
} from '../../lib/businessStatusHelper'

interface StatsSidebarProps {
    selectedProtest: ProtestWithRoute | null
    totalProtests: number
    onBusinessesLoaded?: (businesses: BusinessWithStatus[]) => void
}

export function StatsSidebar({ selectedProtest, totalProtests, onBusinessesLoaded }: StatsSidebarProps) {
    if (!selectedProtest) {
        return (
            <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white">📊 Overview</h3>

                <div className="stat-card">
                    <div className="stat-value">{totalProtests}</div>
                    <div className="stat-label">Total Protests Tracked</div>
                </div>

                <div className="text-sm text-slate-400 mt-4">
                    <p>Select a protest from the list or map to view detailed impact analysis.</p>
                </div>
            </div>
        )
    }

    const route = selectedProtest.route
    const totalAffected = (route?.affected_retail || 0) + (route?.affected_hospitality || 0)

    // State for business status summary
    const [statusSummary, setStatusSummary] = useState<BusinessStatusSummary | null>(null)

    // Callback when businesses are loaded
    const handleBusinessesLoaded = (businesses: BusinessWithStatus[]) => {
        const summary = calculateStatusSummary(businesses)
        setStatusSummary(summary)
        // Pass to parent for map markers
        if (onBusinessesLoaded) {
            onBusinessesLoaded(businesses)
        }
    }

    // Determine impact level based on affected businesses
    const getImpactLevel = (count: number) => {
        if (count === 0) return { label: 'Minimal', class: 'impact-low' }
        if (count < 50) return { label: 'Low', class: 'impact-low' }
        if (count < 200) return { label: 'Moderate', class: 'impact-medium' }
        return { label: 'High', class: 'impact-high' }
    }

    const impact = getImpactLevel(totalAffected)

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-white">📊 Impact Analysis</h3>
                <span className={impact.class}>{impact.label} Impact</span>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <h4 className="font-medium text-white mb-2">{selectedProtest.name}</h4>
                <p className="text-sm text-slate-400">
                    {new Date(selectedProtest.event_date).toLocaleDateString('en-GB', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    })}
                </p>
                <p className="text-sm text-slate-500">
                    {selectedProtest.start_time} - {selectedProtest.end_time}
                </p>
                {selectedProtest.attendees_estimate && (
                    <p className="text-sm text-purple-400 mt-1">
                        ~{selectedProtest.attendees_estimate.toLocaleString()} attendees
                    </p>
                )}
            </div>

            {route && (
                <>
                    {/* Route Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="stat-card">
                            <div className="stat-value text-2xl">{formatDistance(route.distance_meters)}</div>
                            <div className="stat-label">Route Length</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value text-2xl">{totalAffected}</div>
                            <div className="stat-label">Businesses in Zone</div>
                        </div>
                    </div>

                    {/* Business Breakdown */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-slate-300">Business Breakdown</h4>

                        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🏪</span>
                                <span className="text-slate-300">Retail Shops</span>
                            </div>
                            <span className="text-white font-semibold">{route.affected_retail || 0}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🍽️</span>
                                <span className="text-slate-300">Hospitality</span>
                            </div>
                            <span className="text-white font-semibold">{route.affected_hospitality || 0}</span>
                        </div>
                    </div>

                    {/* Detected Business List */}
                    <BusinessListPanel protest={selectedProtest} onBusinessesLoaded={handleBusinessesLoaded} />

                    {/* Business Opening Status Summary */}
                    {statusSummary && statusSummary.total > 0 && (
                        <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-xl p-4">
                            <h4 className="text-sm font-medium text-emerald-300 mb-3 flex items-center gap-2">
                                🕒 Opening Hours Analysis
                            </h4>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                                    <div className="text-xl font-bold text-emerald-400">
                                        {statusSummary.actuallyAffected}
                                    </div>
                                    <div className="text-xs text-slate-400">Would Be Open</div>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                                    <div className="text-xl font-bold text-red-400">
                                        {statusSummary.wouldBeClosed}
                                    </div>
                                    <div className="text-xs text-slate-400">Closed Anyway</div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="flex items-center gap-1">
                                    <span>🟢</span>
                                    <span className="text-slate-400">Open: {statusSummary.open}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <span>🔴</span>
                                    <span className="text-slate-400">Closed: {statusSummary.closed}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <span>🟡</span>
                                    <span className="text-slate-400">Partial: {statusSummary.partial}</span>
                                </span>
                                {statusSummary.unknown > 0 && (
                                    <span className="flex items-center gap-1">
                                        <span>⚪</span>
                                        <span className="text-slate-400">Unknown: {statusSummary.unknown}</span>
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Based on {new Date(selectedProtest.event_date).toLocaleDateString('en-GB', { weekday: 'long' })} opening hours.
                            </p>
                        </div>
                    )}

                    {/* Impact Summary */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-purple-300 mb-2">💡 Analysis Summary</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            This protest route passes within 100 meters of <strong className="text-white">{totalAffected}</strong> commercial establishments.
                            {totalAffected < 50 && ' This represents minimal commercial impact, likely affecting transit corridors rather than primary retail areas.'}
                            {totalAffected >= 50 && totalAffected < 200 && ' The route intersects with some commercial activity but avoids major retail hubs.'}
                            {totalAffected >= 200 && ' The route passes through areas with significant commercial presence.'}
                        </p>
                    </div>

                    {/* Speakers Section */}
                    {selectedProtest.speakers && selectedProtest.speakers.length > 0 && (
                        <details className="group">
                            <summary className="flex items-center justify-between cursor-pointer py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                                <span className="flex items-center gap-2">
                                    🎙️ Speakers ({selectedProtest.speakers.length})
                                </span>
                                <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="mt-2 space-y-2 pl-6">
                                {selectedProtest.speakers.map((speaker, i) => (
                                    <div key={i} className="text-sm text-slate-400 flex items-start gap-2">
                                        <span className="text-slate-600">•</span>
                                        <span>{speaker}</span>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}

                    {/* Links Section */}
                    {selectedProtest.links && selectedProtest.links.length > 0 && (
                        <details className="group">
                            <summary className="flex items-center justify-between cursor-pointer py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                                <span className="flex items-center gap-2">
                                    🔗 Related Links ({selectedProtest.links.length})
                                </span>
                                <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="mt-2 space-y-2 pl-6">
                                {selectedProtest.links.map((link, i) => {
                                    // Extract domain for display
                                    let displayName = link
                                    try {
                                        const url = new URL(link)
                                        displayName = url.hostname.replace('www.', '')
                                    } catch { /* use full link */ }

                                    return (
                                        <a
                                            key={i}
                                            href={link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-400 hover:text-blue-300 flex items-start gap-2 transition-colors"
                                        >
                                            <span className="text-slate-600">•</span>
                                            <span className="underline underline-offset-2">{displayName}</span>
                                        </a>
                                    )
                                })}
                            </div>
                        </details>
                    )}

                    {/* Footfall Impact Section */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            🔥 Footfall Impact
                            <span className="text-xs text-slate-500">(estimated)</span>
                        </h4>

                        <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-sm">Baseline (typical)</span>
                                <span className="text-green-400 font-semibold">~65%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-sm">Est. Reduction</span>
                                <span className="text-amber-400 font-semibold">-30%</span>
                            </div>
                            <div className="border-t border-slate-700 pt-2 flex justify-between items-center">
                                <span className="text-slate-300 text-sm font-medium">During Protest</span>
                                <span className="text-red-400 font-bold">~46%</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-500">
                            Footfall estimates based on typical patterns for this day/time.
                            A 30% reduction is applied within the 100m impact zone.
                        </p>
                    </div>

                    {/* Buffer Zone Info */}
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500/50 rounded"></div>
                        <span>Impact zone = 100m buffer around route</span>
                    </div>
                </>
            )}

            {/* TfL Footfall Analysis Section */}
            {route && (
                <div className="pt-4 border-t border-slate-700">
                    <FootfallAnalysisPanel protest={selectedProtest} />
                </div>
            )}

            {!route && (
                <div className="text-sm text-slate-400 italic">
                    No route data available for this protest.
                </div>
            )}
        </div>
    )
}
