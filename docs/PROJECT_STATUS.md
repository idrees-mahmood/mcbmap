# Protest Impact Tracker - Project Documentation

## Project Overview

The **Protest Impact Tracker (PIT)** is a web application that visualizes and quantifies the economic impact of protests on businesses in Central London. It calculates walking routes, identifies affected businesses within a buffer zone, and provides footfall impact analysis.

---

## Current Status: v0.3 (December 2024)

| Feature | Status | Notes |
|---------|--------|-------|
| Route Mapping | ✅ Complete | OSRM walking routes with 50m buffer |
| Business Detection | ✅ Complete | Dynamic Overpass API + Supabase |
| Location Input | ✅ Complete | 3 methods: click, manual, search |
| Footfall Heatmap | ✅ Complete | Smooth gradient layer (sample data) |
| Footfall Impact Stats | ✅ Complete | Static 30% reduction estimate |
| Dynamic Impact Calculation | 🔄 In Progress | Per-protest day/time calculation |
| Real Footfall Data | ❌ Not Started | Awaiting GLA CSV data |

---

## Implemented Features

### 1. Route Mapping & Visualization
- **OSRM Integration**: Calculates realistic walking paths between start/end points
- **Buffer Zone**: 50m buffer around route showing the "impact area"
- **Map Visualization**: Interactive Mapbox GL JS dark theme map
- **Route Styling**: Pink route line, red/orange buffer overlay

### 2. Location Input (3 Methods)
| Method | Description |
|--------|-------------|
| **Map Click** | Click directly on map to set start/end points |
| **Manual Input** | Enter latitude/longitude coordinates |
| **Address Search** | Autocomplete powered by Mapbox Geocoding API |

### 3. Business Detection
- **Dynamic Fetching**: Uses Overpass API to fetch businesses from OSM when area not in database
- **Auto-population**: Inserts dynamically fetched businesses into Supabase for future use
- **Classification**: Categorizes as `retail`, `hospitality`, or `other`
- **Console Logging**: Shows matched business names (🛒 Retail, 🍽️ Hospitality)
- **Client-side Counting**: Uses Turf.js for polygon intersection

### 4. Footfall Analysis
- **Heatmap Layer**: Smooth gradient visualization (Blue→Green→Yellow→Red)
- **Baseline Data**: ~10,000 sample records for 60+ London locations
- **Impact Stats**: Shows baseline, reduction percentage, and impacted score
- **Fixed Reduction Model**: 30% reduction applied within buffer zone

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Map** | Mapbox GL JS |
| **Geo Processing** | Turf.js (client), PostGIS (server) |
| **Backend** | Supabase (PostgreSQL + PostGIS) |
| **Routing** | OSRM (Open Source Routing Machine) |
| **Business Data** | OpenStreetMap via Overpass API |
| **Styling** | Custom CSS with glassmorphism |

---

## Project Structure

```
mcbmap/
├── src/
│   ├── components/
│   │   ├── Admin/
│   │   │   ├── ProtestForm.tsx        # Protest input form
│   │   │   └── LocationInput.tsx      # 3-way location picker
│   │   ├── Analysis/
│   │   │   └── StatsSidebar.tsx       # Stats & impact display
│   │   └── Map/
│   │       └── ProtestMap.tsx         # Mapbox map component
│   ├── lib/
│   │   ├── businessCounter.ts         # Business detection logic
│   │   ├── footfallService.ts         # Footfall data & heatmap
│   │   ├── overpassClient.ts          # Dynamic OSM fetching
│   │   ├── osrm.ts                    # Route calculation
│   │   ├── supabase.ts                # Database client
│   │   └── database.types.ts          # TypeScript types
│   └── App.tsx                        # Main application
├── scrapers/
│   ├── osm_scraper.py                 # OSM business scraper
│   ├── gla_footfall_parser.py         # GLA footfall data parser
│   └── popular_times_scraper.py       # Popular times estimator
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql     # Core tables
│       ├── 002_buffer_trigger.sql     # Buffer geometry trigger
│       └── 003_spatial_functions.sql  # PostGIS RPC functions
└── docs/
    └── PROJECT_STATUS.md              # This file
```

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `protests` | Protest events with date, time, locations |
| `routes` | Calculated route geometry and buffer |
| `business_nodes` | Retail/hospitality POIs from OSM |
| `footfall_baseline` | Hourly footfall scores by location |

### Key RPC Functions

| Function | Purpose |
|----------|---------|
| `get_all_business_nodes` | Extract coordinates from business_nodes |
| `get_footfall_points` | Extract coordinates from footfall_baseline |
| `count_businesses_in_bbox` | Count businesses in bounding box |

---

## Running the Application

### Prerequisites
- Node.js 18+
- Python 3.8+ (for scrapers)
- Supabase project with PostGIS enabled

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

### Commands
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run scrapers (optional)
cd scrapers
pip install -r requirements.txt
python3 osm_scraper.py
python3 gla_footfall_parser.py
python3 popular_times_scraper.py
```

---

## What's Next

### Priority 1: Dynamic Footfall Calculation
- Calculate actual baseline based on protest date/time
- Fetch footfall data for specific day-of-week and hour
- Display real values instead of static 65%/30%/46%

### Priority 2: Heatmap Toggle
- Add UI toggle: "Baseline" vs "During Protest"
- Show side-by-side or switchable heatmap views
- Highlight reduction areas

### Priority 3: Real GLA Data
- Obtain footfall CSV from [London Datastore](https://data.london.gov.uk/dataset/high-streets-footfall-data)
- Run parser: `python3 gla_footfall_parser.py <file.csv>`
- Replace sample data with official statistics

### Priority 4: Enhanced Analysis
- Time-series impact visualization
- Business revenue impact estimation
- Comparison across multiple protests   

---

## Data Sources

### Currently Used
| Source | Data Type | Status |
|--------|-----------|--------|
| OpenStreetMap (Overpass) | Business POIs | ✅ Active |
| Sample Data Generator | Footfall patterns | ✅ Active |

### Recommended for Production
| Source | Data Type | Access |
|--------|-----------|--------|
| [GLA High Street Data](https://data.london.gov.uk/dataset/high-streets-footfall-data) | Footfall counts | Free CSV |
| [TfL Open Data](https://tfl.gov.uk/info-for/open-data-users/) | Pedestrian data | FOI/API |
| [BT Location Insights](https://business.bt.com/insights/) | MSOA footfall | Paid |

---

## Contributing

1. Feature branches from `main`
2. Run `npm run build` to verify no TypeScript errors
3. Test with actual protest routes before merging
4. Update this documentation for significant changes
