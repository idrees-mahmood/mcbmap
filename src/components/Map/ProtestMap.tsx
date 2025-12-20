import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { MapPoint, ProtestWithRoute } from '../../lib/database.types'

// Get token from environment
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

interface ProtestMapProps {
    protests: ProtestWithRoute[]
    selectedProtestId: string | null
    onSelectProtest: (id: string | null) => void
    onMapClick?: (point: MapPoint) => void
    clickMode?: 'start' | 'end' | null
    startMarker?: MapPoint | null
    endMarker?: MapPoint | null
}

export function ProtestMap({
    protests,
    selectedProtestId,
    onSelectProtest,
    onMapClick,
    clickMode,
    startMarker,
    endMarker
}: ProtestMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<mapboxgl.Map | null>(null)
    const startMarkerRef = useRef<mapboxgl.Marker | null>(null)
    const endMarkerRef = useRef<mapboxgl.Marker | null>(null)
    const [mapLoaded, setMapLoaded] = useState(false)

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current || map.current) return

        if (!MAPBOX_TOKEN) {
            console.error('Mapbox token not found. Add VITE_MAPBOX_ACCESS_TOKEN to .env')
            return
        }

        mapboxgl.accessToken = MAPBOX_TOKEN

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-0.1276, 51.5074], // London
            zoom: 12,
            pitch: 0,
            bearing: 0
        })

        // Add navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
        map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-right')

        map.current.on('load', () => {
            setMapLoaded(true)

            // Add source for protest routes
            map.current!.addSource('protest-routes', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            })

            // Add source for protest buffers
            map.current!.addSource('protest-buffers', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            })

            // Add source for footfall heatmap
            map.current!.addSource('footfall-heatmap', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            })

            // Buffer layer (impact zone)
            map.current!.addLayer({
                id: 'protest-buffer-layer',
                type: 'fill',
                source: 'protest-buffers',
                paint: {
                    'fill-color': [
                        'case',
                        ['==', ['get', 'id'], selectedProtestId || ''],
                        '#ef4444',
                        '#f97316'
                    ],
                    'fill-opacity': 0.3
                }
            })

            // Buffer outline
            map.current!.addLayer({
                id: 'protest-buffer-outline',
                type: 'line',
                source: 'protest-buffers',
                paint: {
                    'line-color': '#ef4444',
                    'line-width': 2,
                    'line-opacity': 0.8
                }
            })

            // Route line layer
            map.current!.addLayer({
                id: 'protest-route-layer',
                type: 'line',
                source: 'protest-routes',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': [
                        'case',
                        ['==', ['get', 'id'], selectedProtestId || ''],
                        '#f43f5e',
                        '#ec4899'
                    ],
                    'line-width': 4,
                    'line-opacity': 0.9
                }
            })

            // Footfall heatmap layer
            map.current!.addLayer({
                id: 'footfall-heat',
                type: 'heatmap',
                source: 'footfall-heatmap',
                paint: {
                    'heatmap-weight': ['get', 'score'],
                    'heatmap-intensity': 0.6,
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0, 'rgba(0, 0, 255, 0)',
                        0.2, 'rgba(0, 255, 255, 0.5)',
                        0.4, 'rgba(0, 255, 0, 0.6)',
                        0.6, 'rgba(255, 255, 0, 0.7)',
                        0.8, 'rgba(255, 128, 0, 0.8)',
                        1, 'rgba(255, 0, 0, 0.9)'
                    ],
                    'heatmap-radius': 30,
                    'heatmap-opacity': 0.7
                }
            })

            // Click handler for route layer
            map.current!.on('click', 'protest-route-layer', (e) => {
                if (e.features && e.features[0]) {
                    const protestId = e.features[0].properties?.id
                    if (protestId) {
                        onSelectProtest(protestId)
                    }
                }
            })

            // Change cursor on hover
            map.current!.on('mouseenter', 'protest-route-layer', () => {
                if (map.current) map.current.getCanvas().style.cursor = 'pointer'
            })

            map.current!.on('mouseleave', 'protest-route-layer', () => {
                if (map.current) map.current.getCanvas().style.cursor = ''
            })
        })

        // Map click for placing markers
        map.current.on('click', (e) => {
            if (clickMode && onMapClick) {
                onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat })
            }
        })

        return () => {
            if (map.current) {
                map.current.remove()
                map.current = null
            }
        }
    }, [])

    // Update cursor based on click mode
    useEffect(() => {
        if (!map.current) return
        map.current.getCanvas().style.cursor = clickMode ? 'crosshair' : ''
    }, [clickMode])

    // Update protest routes on map
    useEffect(() => {
        if (!mapLoaded || !map.current) return

        const routeFeatures: GeoJSON.Feature[] = []
        const bufferFeatures: GeoJSON.Feature[] = []

        protests.forEach(protest => {
            if (protest.route?.geometry) {
                routeFeatures.push({
                    type: 'Feature',
                    properties: { id: protest.id, name: protest.name },
                    geometry: protest.route.geometry
                })
            }
            if (protest.route?.buffer) {
                bufferFeatures.push({
                    type: 'Feature',
                    properties: { id: protest.id, name: protest.name },
                    geometry: protest.route.buffer
                })
            }
        })

        const routeSource = map.current.getSource('protest-routes') as mapboxgl.GeoJSONSource
        const bufferSource = map.current.getSource('protest-buffers') as mapboxgl.GeoJSONSource

        if (routeSource) {
            routeSource.setData({ type: 'FeatureCollection', features: routeFeatures })
        }
        if (bufferSource) {
            bufferSource.setData({ type: 'FeatureCollection', features: bufferFeatures })
        }
    }, [protests, mapLoaded])

    // Update selected protest styling
    useEffect(() => {
        if (!mapLoaded || !map.current) return

        map.current.setPaintProperty('protest-route-layer', 'line-color', [
            'case',
            ['==', ['get', 'id'], selectedProtestId || ''],
            '#f43f5e',
            '#ec4899'
        ])

        map.current.setPaintProperty('protest-buffer-layer', 'fill-color', [
            'case',
            ['==', ['get', 'id'], selectedProtestId || ''],
            '#ef4444',
            '#f97316'
        ])

        // Fly to selected protest
        if (selectedProtestId) {
            const protest = protests.find(p => p.id === selectedProtestId)
            if (protest?.route?.geometry) {
                const coords = protest.route.geometry.coordinates as [number, number][]
                const bounds = coords.reduce(
                    (bounds, coord) => bounds.extend(coord as mapboxgl.LngLatLike),
                    new mapboxgl.LngLatBounds(coords[0], coords[0])
                )
                map.current.fitBounds(bounds, { padding: 100 })
            }
        }
    }, [selectedProtestId, protests, mapLoaded])

    // Handle start marker
    useEffect(() => {
        if (!map.current) return

        if (startMarkerRef.current) {
            startMarkerRef.current.remove()
            startMarkerRef.current = null
        }

        if (startMarker) {
            const el = document.createElement('div')
            el.className = 'protest-marker'
            el.style.backgroundColor = '#22c55e' // Green for start

            startMarkerRef.current = new mapboxgl.Marker(el)
                .setLngLat([startMarker.lng, startMarker.lat])
                .addTo(map.current)
        }
    }, [startMarker])

    // Handle end marker
    useEffect(() => {
        if (!map.current) return

        if (endMarkerRef.current) {
            endMarkerRef.current.remove()
            endMarkerRef.current = null
        }

        if (endMarker) {
            const el = document.createElement('div')
            el.className = 'protest-marker'
            el.style.backgroundColor = '#ef4444' // Red for end

            endMarkerRef.current = new mapboxgl.Marker(el)
                .setLngLat([endMarker.lng, endMarker.lat])
                .addTo(map.current)
        }
    }, [endMarker])

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainer} className="map-container" />

            {/* Map controls overlay */}
            <div className="absolute top-4 left-4 glass-panel px-4 py-2">
                <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                    Protest Impact Tracker
                </h1>
            </div>

            {/* Click mode indicator */}
            {clickMode && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 glass-panel px-6 py-3">
                    <p className="text-sm font-medium text-amber-400">
                        🎯 Click on the map to set {clickMode === 'start' ? 'START' : 'END'} point
                    </p>
                </div>
            )}

            {/* Loading indicator */}
            {!mapLoaded && (
                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-400">Loading map...</p>
                    </div>
                </div>
            )}

            {!MAPBOX_TOKEN && (
                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                    <div className="glass-panel p-8 max-w-md text-center">
                        <h2 className="text-xl font-bold text-red-400 mb-4">⚠️ Mapbox Token Required</h2>
                        <p className="text-slate-300 mb-4">
                            Add your Mapbox access token to the <code className="bg-slate-800 px-2 py-1 rounded">.env</code> file:
                        </p>
                        <pre className="bg-slate-800 p-4 rounded text-left text-sm text-slate-300 overflow-x-auto">
                            VITE_MAPBOX_ACCESS_TOKEN=pk.your_token_here
                        </pre>
                    </div>
                </div>
            )}
        </div>
    )
}
