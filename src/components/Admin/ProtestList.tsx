import type { ProtestWithRoute } from '../../lib/database.types'
import { formatDistance, formatDuration } from '../../lib/osrm'

interface ProtestListProps {
    protests: ProtestWithRoute[]
    selectedId: string | null
    onSelect: (id: string | null) => void
    onDelete: (id: string) => void
}

export function ProtestList({ protests, selectedId, onSelect, onDelete }: ProtestListProps) {
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
        <div className="space-y-3">
            {protests.map((protest) => (
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

                            {protest.route && (protest.route.affected_retail > 0 || protest.route.affected_hospitality > 0) && (
                                <div className="flex items-center gap-2 mt-2">
                                    {protest.route.affected_retail > 0 && (
                                        <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                                            🏪 {protest.route.affected_retail} retail
                                        </span>
                                    )}
                                    {protest.route.affected_hospitality > 0 && (
                                        <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded">
                                            🍽️ {protest.route.affected_hospitality} hospitality
                                        </span>
                                    )}
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
            ))}
        </div>
    )
}
