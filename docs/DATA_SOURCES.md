# Data Sources & Scraping Guide

## Overview

The Protest Impact Tracker requires two types of geospatial data:
1. **Business POIs** - Retail and hospitality locations from OpenStreetMap
2. **Footfall Baseline** - Pedestrian traffic patterns for impact analysis

---

## 1. Business Data (OpenStreetMap)

### Automated Scraper
```bash
cd scrapers
python3 osm_scraper.py
```

### Coverage Area
Current bounding box: West/Central London
- **West**: -0.22 (Earl's Court)
- **East**: -0.05 (Shoreditch)
- **North**: 51.55 (Regent's Park)
- **South**: 51.47 (Pimlico)

### Tags Scraped
| Type | OSM Tags |
|------|----------|
| Retail | shop=* (supermarket, clothes, convenience, etc.) |
| Hospitality | amenity=restaurant, cafe, pub, bar, fast_food |

### Dynamic Fetching
When a protest route is outside the scraped area, the frontend automatically:
1. Queries Overpass API for the route's bounding box
2. Inserts new businesses into Supabase
3. Counts businesses within the buffer

---

## 2. Footfall Data

### Sample Data Generator
```bash
python3 gla_footfall_parser.py
python3 popular_times_scraper.py
```

Generates ~10,000 records covering:
- 32 high streets (GLA parser)
- 31 protest-route waypoints (Popular Times)
- All 7 days of week × 24 hours

### Real GLA Data (Recommended)

**Source**: [London Datastore - High Streets Footfall Data](https://data.london.gov.uk/dataset/high-streets-footfall-data)

**Usage**:
```bash
# Download CSV from London Datastore
python3 gla_footfall_parser.py path/to/footfall_data.csv
```

**Expected CSV columns**:
- Location/High Street name
- Date/Time
- Footfall count

---

## 3. Database Population Checklist

### Initial Setup
- [ ] Run SQL migrations in Supabase (001, 002, 003)
- [ ] Add RLS policies (anonymous insert.sql)
- [ ] Run `osm_scraper.py` for business data
- [ ] Run footfall scrapers for baseline data

### Verification
```sql
-- Check business count
SELECT type, COUNT(*) FROM business_nodes GROUP BY type;

-- Check footfall records
SELECT source, COUNT(*) FROM footfall_baseline GROUP BY source;
```

---

## 4. API Rate Limits

| Service | Limit | Notes |
|---------|-------|-------|
| Overpass API | ~10K elements/query | Automatic batching in client |
| Mapbox Geocoding | 100K/month (free tier) | Address search |
| OSRM | Unlimited (demo server) | Consider self-hosting for production |
