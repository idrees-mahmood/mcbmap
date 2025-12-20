import { useState, useCallback } from 'react'
import { ProtestMap } from './components/Map/ProtestMap'
import { ProtestForm } from './components/Admin/ProtestForm'
import { ProtestList } from './components/Admin/ProtestList'
import { StatsSidebar } from './components/Analysis/StatsSidebar'
import type { MapPoint, ProtestWithRoute, ProtestFormData } from './lib/database.types'
import { isDemoMode } from './lib/supabase'
import { countBusinessesInBuffer } from './lib/businessCounter'

type SidebarView = 'list' | 'form' | 'stats'

function App() {
  const [protests, setProtests] = useState<ProtestWithRoute[]>([])
  const [selectedProtestId, setSelectedProtestId] = useState<string | null>(null)
  const [sidebarView, setSidebarView] = useState<SidebarView>('list')
  const [clickMode, setClickMode] = useState<'start' | 'end' | null>(null)
  const [startPoint, setStartPoint] = useState<MapPoint | null>(null)
  const [endPoint, setEndPoint] = useState<MapPoint | null>(null)

  // Handle map click for placing markers
  const handleMapClick = useCallback((point: MapPoint) => {
    if (clickMode === 'start') {
      setStartPoint(point)
      setClickMode(null)
    } else if (clickMode === 'end') {
      setEndPoint(point)
      setClickMode(null)
    }
  }, [clickMode])

  // Handle protest selection
  const handleSelectProtest = useCallback((id: string | null) => {
    setSelectedProtestId(id)
    if (id) {
      setSidebarView('stats')
    }
  }, [])

  // Handle form submission
  const handleFormSubmit = useCallback(async (
    data: ProtestFormData,
    route: { geometry: GeoJSON.LineString; buffer: GeoJSON.Polygon; distance: number; duration: number }
  ) => {
    // Count businesses within the buffer zone
    const businessCounts = await countBusinessesInBuffer(route.buffer)
    console.log('Business counts:', businessCounts)

    const newProtest: ProtestWithRoute = {
      id: crypto.randomUUID(),
      name: data.name,
      event_date: data.event_date,
      start_time: data.start_time,
      end_time: data.end_time,
      start_location: { type: 'Point', coordinates: [data.start_point.lng, data.start_point.lat] },
      end_location: { type: 'Point', coordinates: [data.end_point.lng, data.end_point.lat] },
      start_address: data.start_address || null,
      end_address: data.end_address || null,
      attendees_estimate: data.attendees_estimate || null,
      police_data_link: null,
      notes: data.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      route: {
        geometry: route.geometry,
        buffer: route.buffer,
        distance_meters: route.distance,
        duration_seconds: route.duration,
        affected_retail: businessCounts.retail,
        affected_hospitality: businessCounts.hospitality
      }
    }

    setProtests(prev => [...prev, newProtest])
    setStartPoint(null)
    setEndPoint(null)
    setClickMode(null)
    setSidebarView('list')
    setSelectedProtestId(newProtest.id)
  }, [])

  // Handle protest deletion
  const handleDeleteProtest = useCallback((id: string) => {
    setProtests(prev => prev.filter(p => p.id !== id))
    if (selectedProtestId === id) {
      setSelectedProtestId(null)
      setSidebarView('list')
    }
  }, [selectedProtestId])

  // Cancel form
  const handleCancelForm = useCallback(() => {
    setStartPoint(null)
    setEndPoint(null)
    setClickMode(null)
    setSidebarView('list')
  }, [])

  // Get selected protest
  const selectedProtest = protests.find(p => p.id === selectedProtestId) || null

  return (
    <div className="split-container">
      {/* Map Section */}
      <main className="relative overflow-hidden">
        <ProtestMap
          protests={protests}
          selectedProtestId={selectedProtestId}
          onSelectProtest={handleSelectProtest}
          onMapClick={handleMapClick}
          clickMode={clickMode}
          startMarker={startPoint}
          endMarker={endPoint}
        />
      </main>

      {/* Sidebar */}
      <aside className="bg-slate-900 border-l border-slate-700 overflow-y-auto">
        <div className="p-6">
          {/* Demo Mode Banner */}
          {isDemoMode && (
            <div className="mb-4 bg-amber-500/20 border border-amber-500/50 rounded-lg p-3 text-amber-300 text-xs">
              🔧 Demo Mode - Data stored locally (not persisted)
            </div>
          )}

          {/* Sidebar Navigation */}
          <div className="flex gap-2 mb-6">
            {sidebarView !== 'form' && (
              <>
                <button
                  onClick={() => setSidebarView('list')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${sidebarView === 'list'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                >
                  Protests
                </button>
                <button
                  onClick={() => setSidebarView('stats')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${sidebarView === 'stats'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                >
                  Analysis
                </button>
              </>
            )}
          </div>

          {/* Sidebar Content */}
          {sidebarView === 'list' && (
            <div>
              <button
                onClick={() => setSidebarView('form')}
                className="w-full btn-primary mb-6"
              >
                + Add Protest
              </button>
              <ProtestList
                protests={protests}
                selectedId={selectedProtestId}
                onSelect={handleSelectProtest}
                onDelete={handleDeleteProtest}
              />
            </div>
          )}

          {sidebarView === 'form' && (
            <ProtestForm
              onSubmit={handleFormSubmit}
              onCancel={handleCancelForm}
              onSetClickMode={setClickMode}
              onStartPointChange={setStartPoint}
              onEndPointChange={setEndPoint}
              clickMode={clickMode}
              startPoint={startPoint}
              endPoint={endPoint}
            />
          )}

          {sidebarView === 'stats' && (
            <StatsSidebar
              selectedProtest={selectedProtest}
              totalProtests={protests.length}
            />
          )}
        </div>
      </aside>
    </div>
  )
}

export default App
