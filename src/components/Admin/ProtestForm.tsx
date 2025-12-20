import { useState } from 'react'
import type { MapPoint, ProtestFormData } from '../../lib/database.types'
import { calculateWalkingRoute, createRouteBuffer, formatDistance, formatDuration } from '../../lib/osrm'

interface ProtestFormProps {
    onSubmit: (data: ProtestFormData, route: { geometry: GeoJSON.LineString; buffer: GeoJSON.Polygon; distance: number; duration: number }) => void
    onCancel: () => void
    onSetClickMode: (mode: 'start' | 'end' | null) => void
    clickMode: 'start' | 'end' | null
    startPoint: MapPoint | null
    endPoint: MapPoint | null
}

export function ProtestForm({
    onSubmit,
    onCancel,
    onSetClickMode,
    clickMode,
    startPoint,
    endPoint
}: ProtestFormProps) {
    const [name, setName] = useState('')
    const [eventDate, setEventDate] = useState('')
    const [startTime, setStartTime] = useState('12:00')
    const [endTime, setEndTime] = useState('16:00')
    const [attendees, setAttendees] = useState('')
    const [notes, setNotes] = useState('')
    const [isCalculating, setIsCalculating] = useState(false)
    const [routePreview, setRoutePreview] = useState<{ distance: number; duration: number } | null>(null)
    const [error, setError] = useState('')

    const handleCalculateRoute = async () => {
        if (!startPoint || !endPoint) {
            setError('Please set both start and end points on the map')
            return
        }

        setIsCalculating(true)
        setError('')

        try {
            const route = await calculateWalkingRoute(startPoint, endPoint)
            setRoutePreview({ distance: route.distance, duration: route.duration })
        } catch (err) {
            setError('Failed to calculate route. Please try again.')
            console.error(err)
        } finally {
            setIsCalculating(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim() || !eventDate || !startPoint || !endPoint) {
            setError('Please fill in all required fields and set map points')
            return
        }

        setIsCalculating(true)
        setError('')

        try {
            const route = await calculateWalkingRoute(startPoint, endPoint)
            const buffer = createRouteBuffer(route.geometry, 50)

            onSubmit(
                {
                    name: name.trim(),
                    event_date: eventDate,
                    start_time: startTime,
                    end_time: endTime,
                    start_point: startPoint,
                    end_point: endPoint,
                    attendees_estimate: attendees ? parseInt(attendees, 10) : undefined,
                    notes: notes.trim() || undefined
                },
                {
                    geometry: route.geometry,
                    buffer,
                    distance: route.distance,
                    duration: route.duration
                }
            )
        } catch (err) {
            setError('Failed to create protest route. Please try again.')
            console.error(err)
        } finally {
            setIsCalculating(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Add New Protest</h2>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-slate-400 hover:text-white transition-colors"
                >
                    ✕
                </button>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
                    {error}
                </div>
            )}

            {/* Protest Name */}
            <div>
                <label className="input-label">Protest Name *</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Palestine Solidarity March"
                    className="input-field"
                    required
                />
            </div>

            {/* Date and Times */}
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="input-label">Event Date *</label>
                    <input
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="input-field"
                        required
                    />
                </div>
                <div>
                    <label className="input-label">Start Time</label>
                    <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="input-field"
                    />
                </div>
                <div>
                    <label className="input-label">End Time</label>
                    <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="input-field"
                    />
                </div>
            </div>

            {/* Route Points */}
            <div className="space-y-3">
                <label className="input-label">Route Points *</label>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => onSetClickMode(clickMode === 'start' ? null : 'start')}
                        className={`flex-1 py-3 rounded-lg border font-medium transition-all ${clickMode === 'start'
                                ? 'bg-green-500/20 border-green-500 text-green-400'
                                : startPoint
                                    ? 'bg-green-500/10 border-green-500/50 text-green-400'
                                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-green-500'
                            }`}
                    >
                        {startPoint ? '✓ Start Set' : '📍 Set Start'}
                    </button>

                    <button
                        type="button"
                        onClick={() => onSetClickMode(clickMode === 'end' ? null : 'end')}
                        className={`flex-1 py-3 rounded-lg border font-medium transition-all ${clickMode === 'end'
                                ? 'bg-red-500/20 border-red-500 text-red-400'
                                : endPoint
                                    ? 'bg-red-500/10 border-red-500/50 text-red-400'
                                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-red-500'
                            }`}
                    >
                        {endPoint ? '✓ End Set' : '🏁 Set End'}
                    </button>
                </div>

                {startPoint && endPoint && (
                    <button
                        type="button"
                        onClick={handleCalculateRoute}
                        disabled={isCalculating}
                        className="w-full btn-secondary mt-2"
                    >
                        {isCalculating ? 'Calculating...' : '🔄 Preview Route'}
                    </button>
                )}

                {routePreview && (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 flex justify-between">
                        <span className="text-purple-300 text-sm">
                            📏 {formatDistance(routePreview.distance)}
                        </span>
                        <span className="text-purple-300 text-sm">
                            ⏱️ {formatDuration(routePreview.duration)}
                        </span>
                    </div>
                )}
            </div>

            {/* Attendees Estimate */}
            <div>
                <label className="input-label">Estimated Attendees</label>
                <input
                    type="number"
                    value={attendees}
                    onChange={(e) => setAttendees(e.target.value)}
                    placeholder="e.g., 50000"
                    className="input-field"
                    min="0"
                />
            </div>

            {/* Notes */}
            <div>
                <label className="input-label">Notes</label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional context..."
                    className="input-field min-h-[80px] resize-y"
                />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 btn-secondary"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isCalculating || !startPoint || !endPoint}
                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isCalculating ? 'Creating...' : 'Create Protest'}
                </button>
            </div>
        </form>
    )
}
