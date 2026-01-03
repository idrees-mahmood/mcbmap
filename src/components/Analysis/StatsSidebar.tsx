import { useState } from 'react'
import type { ProtestWithRoute } from '../../lib/database.types'
import { formatDistance } from '../../lib/osrm'
import { FootfallAnalysisPanel } from './FootfallAnalysisPanel'
import { BusinessListPanel } from './BusinessListPanel'
import { AnalysisPromptPanel } from './AnalysisPromptPanel'
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

    // State for business status summary and loaded businesses
    const [statusSummary, setStatusSummary] = useState<BusinessStatusSummary | null>(null)
    const [loadedBusinesses, setLoadedBusinesses] = useState<BusinessWithStatus[]>([])

    // Callback when businesses are loaded
    const handleBusinessesLoaded = (businesses: BusinessWithStatus[]) => {
        const summary = calculateStatusSummary(businesses)
        setStatusSummary(summary)
        setLoadedBusinesses(businesses)
        if (onBusinessesLoaded) {
            onBusinessesLoaded(businesses)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <h3 className="text-lg font-semibold text-white">📊 Impact Analysis</h3>

            {/* Protest Info Card */}
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
                {route && (
                    <p className="text-sm text-cyan-400 mt-1">
                        Route: {formatDistance(route.distance_meters)}
                    </p>
                )}
            </div>

            {route && (
                <>
                    {/* 1. SPEAKERS */}
                    {selectedProtest.speakers && selectedProtest.speakers.length > 0 && (
                        <details className="group" open>
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

                    {/* 2. RELATED LINKS */}
                    {selectedProtest.links && selectedProtest.links.length > 0 && (
                        <details className="group" open>
                            <summary className="flex items-center justify-between cursor-pointer py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                                <span className="flex items-center gap-2">
                                    🔗 Related Links ({selectedProtest.links.length})
                                </span>
                                <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="mt-2 space-y-2 pl-6">
                                {selectedProtest.links.map((link, i) => {
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

                    {/* 3. ANALYSIS SUMMARY */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-purple-300 mb-2">💡 Analysis Summary</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            {statusSummary ? (
                                <>
                                    This protest route passes within 100m of <strong className="text-white">{statusSummary.total.toLocaleString()}</strong> points of interest.
                                    Of these, <strong className="text-emerald-400">{statusSummary.actuallyAffected}</strong> would be open during the protest
                                    while <strong className="text-red-400">{statusSummary.wouldBeClosed}</strong> would already be closed.
                                </>
                            ) : (
                                'Loading business data...'
                            )}
                        </p>
                    </div>

                    {/* 4. LLM ANALYSIS PROMPT */}
                    {loadedBusinesses.length > 0 && (
                        <AnalysisPromptPanel
                            protest={selectedProtest}
                            businesses={loadedBusinesses}
                        />
                    )}

                    {/* 5. DETECTED BUSINESSES */}
                    <BusinessListPanel protest={selectedProtest} onBusinessesLoaded={handleBusinessesLoaded} />

                    {/* 6. OPENING HOURS ANALYSIS */}
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

                    {/* 7. TfL FOOTFALL ANALYSIS */}
                    <div className="pt-4 border-t border-slate-700">
                        <FootfallAnalysisPanel protest={selectedProtest} />
                    </div>

                    {/* Buffer Zone Info */}
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500/50 rounded"></div>
                        <span>Impact zone = 100m buffer around route</span>
                    </div>
                </>
            )}

            {!route && (
                <div className="text-sm text-slate-400 italic">
                    No route data available for this protest.
                </div>
            )}
        </div>
    )
}
