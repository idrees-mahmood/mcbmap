/**
 * Business List Panel
 * ===================
 * Displays the list of detected businesses in the impact zone.
 */

import { useState, useEffect } from 'react'
import type { ProtestWithRoute } from '../../lib/database.types'
import { getBusinessesInBuffer, type BusinessNode } from '../../lib/businessCounter'
import {
    computeBusinessStatuses,
    getStatusEmoji,
    type BusinessWithStatus
} from '../../lib/businessStatusHelper'

interface Props {
    protest: ProtestWithRoute
    onBusinessesLoaded?: (businesses: BusinessWithStatus[]) => void
}

export function BusinessListPanel({ protest, onBusinessesLoaded }: Props) {
    const [isLoading, setIsLoading] = useState(true)
    const [isExpanded, setIsExpanded] = useState(false)
    const [businessesWithStatus, setBusinessesWithStatus] = useState<BusinessWithStatus[]>([])
    const [businesses, setBusinesses] = useState<{
        retail: BusinessNode[];
        hospitality: BusinessNode[];
        commercial: BusinessNode[];
        other: BusinessNode[];
        total: number;
    } | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadBusinesses()
    }, [protest.id])

    async function loadBusinesses() {
        if (!protest.route?.buffer) {
            setError('No route buffer available')
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const buffer = protest.route.buffer as GeoJSON.Polygon
            const result = await getBusinessesInBuffer(buffer, { enableDynamicFetch: true })
            setBusinesses(result)
            console.log('[BusinessListPanel] Loaded businesses:', result)

            // Compute statuses for all businesses
            const allBusinesses = [
                ...result.retail,
                ...result.hospitality,
                ...result.commercial,
                ...result.other
            ]
            const withStatus = computeBusinessStatuses(
                allBusinesses,
                protest.event_date,
                protest.start_time
            )
            setBusinessesWithStatus(withStatus)

            // Notify parent component
            if (onBusinessesLoaded) {
                onBusinessesLoaded(withStatus)
            }
        } catch (err) {
            console.error('[BusinessListPanel] Error loading businesses:', err)
            setError('Failed to load business data')
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 animate-pulse">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🏪</span>
                    <span className="text-slate-400 text-sm">Loading business data...</span>
                </div>
            </div>
        )
    }

    if (error || !businesses) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-3 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400 text-sm">
                    <span>⚠️</span>
                    <span>{error || 'No business data available'}</span>
                </div>
            </div>
        )
    }

    const totalCount = businesses.total

    // Create lookup map from id to status
    const statusMap = new Map<string, BusinessWithStatus>(
        businessesWithStatus.map(b => [b.id, b])
    )

    return (
        <div className="border border-slate-700 rounded-xl overflow-hidden">
            {/* Header - Always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 flex items-center justify-between bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
                <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    📋 Detected Businesses ({totalCount})
                </span>
                <span className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="p-3 space-y-3 bg-slate-900/30 max-h-96 overflow-y-auto">
                    {totalCount === 0 ? (
                        <div className="text-center py-4 text-slate-500">
                            <p className="text-sm">No businesses detected in the 100m buffer zone.</p>
                            <p className="text-xs mt-1">This may indicate:</p>
                            <ul className="text-xs mt-2 space-y-1 text-left pl-4">
                                <li>• Database hasn't been populated yet</li>
                                <li>• RPC function not deployed to Supabase</li>
                                <li>• Route is in an area without business data</li>
                            </ul>
                        </div>
                    ) : (
                        <>
                            {/* Retail */}
                            {businesses.retail.length > 0 && (
                                <BusinessTypeSection
                                    icon="🏪"
                                    title="Retail"
                                    businesses={businesses.retail}
                                    statusMap={statusMap}
                                    bgColor="bg-blue-500/10"
                                    borderColor="border-blue-500/20"
                                />
                            )}

                            {/* Hospitality */}
                            {businesses.hospitality.length > 0 && (
                                <BusinessTypeSection
                                    icon="🍽️"
                                    title="Hospitality"
                                    businesses={businesses.hospitality}
                                    statusMap={statusMap}
                                    bgColor="bg-orange-500/10"
                                    borderColor="border-orange-500/20"
                                />
                            )}

                            {/* Commercial */}
                            {businesses.commercial.length > 0 && (
                                <BusinessTypeSection
                                    icon="🏢"
                                    title="Commercial"
                                    businesses={businesses.commercial}
                                    statusMap={statusMap}
                                    bgColor="bg-purple-500/10"
                                    borderColor="border-purple-500/20"
                                />
                            )}

                            {/* Other */}
                            {businesses.other.length > 0 && (
                                <BusinessTypeSection
                                    icon="📍"
                                    title="Other"
                                    businesses={businesses.other}
                                    statusMap={statusMap}
                                    bgColor="bg-slate-500/10"
                                    borderColor="border-slate-500/20"
                                />
                            )}
                        </>
                    )}

                    {/* Debug info */}
                    <div className="text-xs text-slate-600 pt-2 border-t border-slate-700">
                        Buffer: 100m radius around route • Data source: {totalCount > 0 ? 'Supabase + Overpass' : 'None'}
                    </div>
                </div>
            )}
        </div>
    )
}

// Sub-component for each business type section
function BusinessTypeSection({
    icon,
    title,
    businesses,
    statusMap,
    bgColor,
    borderColor
}: {
    icon: string
    title: string
    businesses: BusinessNode[]
    statusMap: Map<string, BusinessWithStatus>
    bgColor: string
    borderColor: string
}) {
    const [showAll, setShowAll] = useState(false)
    const displayCount = showAll ? businesses.length : Math.min(5, businesses.length)
    const hasMore = businesses.length > 5

    return (
        <div className={`rounded-lg ${bgColor} border ${borderColor} p-2`}>
            <div className="flex items-center gap-2 mb-2">
                <span>{icon}</span>
                <span className="text-sm font-medium text-slate-300">{title}</span>
                <span className="text-xs text-slate-500">({businesses.length})</span>
            </div>
            <div className="space-y-1">
                {businesses.slice(0, displayCount).map((b, i) => {
                    const withStatus = statusMap.get(b.id)
                    const statusEmoji = withStatus ? getStatusEmoji(withStatus.status) : '⚪'
                    return (
                        <div key={b.id || i} className="flex items-center justify-between text-xs gap-2">
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                                <span title={withStatus?.statusLabel || 'Unknown'}>{statusEmoji}</span>
                                <span className="text-slate-300 truncate">
                                    {b.name || 'Unnamed'}
                                </span>
                            </div>
                            <span className="text-slate-500 text-[10px] flex-shrink-0">
                                {b.subtype || title.toLowerCase()}
                            </span>
                        </div>
                    )
                })}
                {hasMore && !showAll && (
                    <button
                        onClick={() => setShowAll(true)}
                        className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                    >
                        + {businesses.length - 5} more...
                    </button>
                )}
                {showAll && hasMore && (
                    <button
                        onClick={() => setShowAll(false)}
                        className="text-xs text-slate-500 hover:text-slate-400 mt-1"
                    >
                        Show less
                    </button>
                )}
            </div>
        </div>
    )
}
