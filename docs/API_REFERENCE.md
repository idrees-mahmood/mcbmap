# API Reference

## Supabase RPC Functions

The following PostgreSQL functions are available via Supabase RPC.

---

### `get_all_business_nodes`

Returns all business nodes with extracted coordinates.

**Returns**: 
```typescript
{
  id: string
  name: string
  type: 'retail' | 'hospitality' | 'other'
  subtype: string
  lng: number
  lat: number
  osm_id: number
}[]
```

**Usage**:
```typescript
const { data } = await supabase.rpc('get_all_business_nodes')
```

---

### `get_footfall_points`

Returns all footfall baseline points with extracted coordinates.

**Returns**:
```typescript
{
  id: string
  location_name: string
  lng: number
  lat: number
  day_of_week: string
  hour_of_day: number
  avg_footfall_score: number
  source: string
}[]
```

**Usage**:
```typescript
const { data } = await supabase.rpc('get_footfall_points')
```

---

### `count_businesses_in_bbox`

Counts businesses within a bounding box.

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| min_lng | float | West boundary |
| max_lng | float | East boundary |
| min_lat | float | South boundary |
| max_lat | float | North boundary |

**Returns**: `integer`

**Usage**:
```typescript
const { data } = await supabase.rpc('count_businesses_in_bbox', {
  min_lng: -0.18,
  max_lng: -0.13,
  min_lat: 51.49,
  max_lat: 51.52
})
```

---

## External APIs

### OSRM (Routing)
**Endpoint**: `https://router.project-osrm.org/route/v1/walking`

**Usage in code**: See `src/lib/osrm.ts`

### Overpass API (OSM Data)
**Endpoint**: `https://overpass-api.de/api/interpreter`

**Usage in code**: See `src/lib/overpassClient.ts`

### Mapbox Geocoding
**Endpoint**: `https://api.mapbox.com/geocoding/v5/mapbox.places`

**Usage in code**: See `src/components/Admin/LocationInput.tsx`
