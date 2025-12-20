import { useState, useEffect, useRef, useCallback } from 'react'
import type { MapPoint } from '../../lib/database.types'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

interface LocationInputProps {
    label: string
    point: MapPoint | null
    onPointChange: (point: MapPoint | null) => void
    onSetClickMode: () => void
    isClickModeActive: boolean
    colorClass: 'green' | 'red'
}

interface GeocodingResult {
    id: string
    place_name: string
    center: [number, number] // [lng, lat]
}

export function LocationInput({
    label,
    point,
    onPointChange,
    onSetClickMode,
    isClickModeActive,
    colorClass
}: LocationInputProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [suggestions, setSuggestions] = useState<GeocodingResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [manualLat, setManualLat] = useState('')
    const [manualLng, setManualLng] = useState('')
    const searchTimeout = useRef<number | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Sync manual inputs when point changes from map click
    useEffect(() => {
        if (point) {
            setManualLat(point.lat.toFixed(6))
            setManualLng(point.lng.toFixed(6))
        } else {
            setManualLat('')
            setManualLng('')
        }
    }, [point])

    // Debounced search function
    const searchLocations = useCallback(async (query: string) => {
        if (!query.trim() || query.length < 2 || !MAPBOX_TOKEN) {
            setSuggestions([])
            return
        }

        setIsSearching(true)
        try {
            // Bias search towards London area
            const bbox = '-0.5,51.3,0.3,51.7' // London bounds
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
                `access_token=${MAPBOX_TOKEN}&` +
                `bbox=${bbox}&` +
                `limit=5&` +
                `types=poi,address,neighborhood,locality,place`
            )
            const data = await response.json()

            if (data.features) {
                setSuggestions(data.features.map((f: { id: string; place_name: string; center: [number, number] }) => ({
                    id: f.id,
                    place_name: f.place_name,
                    center: f.center
                })))
                setShowSuggestions(true)
            }
        } catch (error) {
            console.error('Geocoding error:', error)
            setSuggestions([])
        } finally {
            setIsSearching(false)
        }
    }, [])

    // Handle search input with debounce
    const handleSearchChange = (value: string) => {
        setSearchQuery(value)

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current)
        }

        searchTimeout.current = window.setTimeout(() => {
            searchLocations(value)
        }, 300)
    }

    // Handle suggestion selection
    const handleSelectSuggestion = (result: GeocodingResult) => {
        const [lng, lat] = result.center
        onPointChange({ lat, lng })
        setSearchQuery(result.place_name.split(',')[0]) // Show just the primary name
        setShowSuggestions(false)
        setSuggestions([])
    }

    // Handle manual coordinate input
    const handleManualLatChange = (value: string) => {
        setManualLat(value)
        const lat = parseFloat(value)
        if (!isNaN(lat) && lat >= -90 && lat <= 90 && manualLng) {
            const lng = parseFloat(manualLng)
            if (!isNaN(lng)) {
                onPointChange({ lat, lng })
            }
        }
    }

    const handleManualLngChange = (value: string) => {
        setManualLng(value)
        const lng = parseFloat(value)
        if (!isNaN(lng) && lng >= -180 && lng <= 180 && manualLat) {
            const lat = parseFloat(manualLat)
            if (!isNaN(lat)) {
                onPointChange({ lat, lng })
            }
        }
    }

    // Click outside to close suggestions
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const colorStyles = {
        green: {
            active: 'bg-green-500/20 border-green-500 text-green-400',
            set: 'bg-green-500/10 border-green-500/50 text-green-400',
            default: 'bg-slate-800 border-slate-600 text-slate-300 hover:border-green-500',
            accent: 'text-green-400',
            ring: 'focus:ring-green-500/30 focus:border-green-500'
        },
        red: {
            active: 'bg-red-500/20 border-red-500 text-red-400',
            set: 'bg-red-500/10 border-red-500/50 text-red-400',
            default: 'bg-slate-800 border-slate-600 text-slate-300 hover:border-red-500',
            accent: 'text-red-400',
            ring: 'focus:ring-red-500/30 focus:border-red-500'
        }
    }

    const styles = colorStyles[colorClass]

    return (
        <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${styles.accent}`}>{label}</span>
                {point && (
                    <span className="text-xs text-slate-400">
                        {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                    </span>
                )}
            </div>

            {/* Map Click Button */}
            <button
                type="button"
                onClick={onSetClickMode}
                className={`w-full py-2.5 rounded-lg border font-medium transition-all text-sm ${isClickModeActive
                        ? styles.active
                        : point
                            ? styles.set
                            : styles.default
                    }`}
            >
                {isClickModeActive ? '🎯 Click on map...' : point ? '✓ Point Set (click to change)' : '📍 Click on Map'}
            </button>

            {/* Location Search */}
            <div className="relative" ref={inputRef}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Search location (e.g., South Kensington)"
                    className={`input-field text-sm pr-8 ${styles.ring}`}
                />
                {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {suggestions.map((result) => (
                            <button
                                key={result.id}
                                type="button"
                                onClick={() => handleSelectSuggestion(result)}
                                className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                            >
                                <span className="font-medium">{result.place_name.split(',')[0]}</span>
                                <span className="text-slate-500 text-xs block truncate">
                                    {result.place_name.split(',').slice(1).join(',').trim()}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Manual Lat/Lng Input */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-slate-500 mb-1 block">Latitude</label>
                    <input
                        type="number"
                        step="any"
                        value={manualLat}
                        onChange={(e) => handleManualLatChange(e.target.value)}
                        placeholder="51.5074"
                        className={`input-field text-sm ${styles.ring}`}
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-500 mb-1 block">Longitude</label>
                    <input
                        type="number"
                        step="any"
                        value={manualLng}
                        onChange={(e) => handleManualLngChange(e.target.value)}
                        placeholder="-0.1276"
                        className={`input-field text-sm ${styles.ring}`}
                    />
                </div>
            </div>
        </div>
    )
}
