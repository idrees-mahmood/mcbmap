import { useState, useMemo } from 'react'
import type { ProtestWithRoute } from '../../lib/database.types'
import { formatDistance, formatDuration } from '../../lib/osrm'

type SortOption = 'newest' | 'oldest' | 'a-z' | 'z-a'

interface ProtestListProps {
    protests: ProtestWithRoute[]
    selectedId: string | null
    onSelect: (id: string | null) => void
    onDelete: (id: string) => void
}

export function ProtestList({ protests, selectedId, onSelect, onDelete }: ProtestListProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<SortOption>('newest')

    // Filter and sort protests
    const filteredProtests = useMemo(() => {
        let result = [...protests]

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            result = result.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.notes?.toLowerCase().includes(query)
            )
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
                case 'oldest':
                    return new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
                case 'a-z':
                    return a.name.localeCompare(b.name)
                case 'z-a':
                    return b.name.localeCompare(a.name)
                default:
                    return 0
            }
        })

        return result
    }, [protests, searchQuery, sortBy])

    if (protests.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-4">📍</p>
                <p>No protests added yet.</p>
                <p className="text-sm mt-2">Click "Add Protest" to get started.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Search & Sort Controls */}
            <div className="space-y-3">
                {/* Search Input */}
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                    <input
                        type="text"
                        placeholder="Search protests..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Sort:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="flex-1 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 transition-colors cursor-pointer"
                    >
                        <option value="newest">📅 Newest First</option>
                        <option value="oldest">📅 Oldest First</option>
                        <option value="a-z">🔤 A → Z</option>
                        <option value="z-a">🔤 Z → A</option>
                    </select>
                </div>

                {/* Results Count */}
                {searchQuery && (
                    <p className="text-xs text-slate-500">
                        {filteredProtests.length} of {protests.length} protests
                    </p>
                )}
            </div>

            {/* Protest List */}
            <div className="space-y-3">
                {filteredProtests.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <p>No protests match "{searchQuery}"</p>
                    </div>
                ) : (
                    filteredProtests.map((protest) => (
                        <div
                            key={protest.id}
                            onClick={() => onSelect(selectedId === protest.id ? null : protest.id)}
                            className={`p-4 rounded-xl cursor-pointer transition-all border ${selectedId === protest.id
                                ? 'bg-purple-500/20 border-purple-500'
                                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-white truncate">{protest.name}</h3>
                                        {protest.isStored && (
                                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                                                STORED
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-400 mt-1">
                                        {new Date(protest.event_date).toLocaleDateString('en-GB', {
                                            weekday: 'short',
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </p>

                                    {protest.route && (
                                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                            <span>📏 {formatDistance(protest.route.distance_meters)}</span>
                                            <span>⏱️ {formatDuration(protest.route.duration_seconds)}</span>
                                        </div>
                                    )}

                                    {/* Quick stats preview */}
                                    {protest.speakers && protest.speakers.length > 0 && (
                                        <div className="mt-2 text-xs text-slate-500">
                                            🎙️ {protest.speakers.length} speaker{protest.speakers.length > 1 ? 's' : ''}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (confirm(`Delete "${protest.name}"?`)) {
                                            onDelete(protest.id)
                                        }
                                    }}
                                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                    title="Delete protest"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
