"""
OSM POI Scraper
===============
Downloads ALL points of interest from OpenStreetMap for Central London
using a "catch-all" approach, then filters and classifies them.

Usage:
    python osm_scraper.py

Requirements:
    pip install osmnx supabase python-dotenv
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

import osmnx as ox
from supabase import create_client, Client

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

# Central/West London bounding box (Earl's Court to Shoreditch, Regent's Park to Pimlico)
# [North, South, East, West]
BBOX = {
    'north': 51.55,   # Regent's Park / Camden
    'south': 51.47,   # Pimlico / Vauxhall
    'east': -0.05,    # Shoreditch / City
    'west': -0.22     # Earl's Court / South Kensington
}

# Broad "Catch-All" Tags
# Setting values to True fetches everything with that key
TAGS = {
    'shop': True,       # All shops
    'amenity': True,    # All amenities (cafes, banks, but also benches)
    'office': True,     # All offices
    'leisure': True,    # Gyms, sports centres
    'tourism': True,    # Hotels, museums
    'craft': True,      # Workshops, breweries
    'historic': True,   # Monuments, memorials, landmarks
}

# Filter out street furniture and non-business items
BLACKLIST = {
    'bench', 'waste_basket', 'bicycle_parking', 'telephone',
    'post_box', 'recycling', 'drinking_water', 'toilets',
    'vending_machine', 'atm', 'parking', 'parking_space',
    'motorcycle_parking', 'loading_dock', 'grit_bin',
    'hunting_stand', 'feeding_place', 'watering_place'
}


def get_supabase_client() -> Client:
    """Create and return Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Supabase credentials not found.")
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your environment or .env file")
        sys.exit(1)
    
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def determine_type(row):
    """Classify the POI based on its tags."""
    # Check for Shop (Retail)
    if 'shop' in row.index and isinstance(row['shop'], str):
        return 'retail', row['shop']
    
    # Check for Office (Commercial)
    if 'office' in row.index and isinstance(row['office'], str):
        return 'commercial', row['office']
    
    # Check for Amenity (Hospitality, Commercial, or Other)
    if 'amenity' in row.index and isinstance(row['amenity'], str):
        subtype = row['amenity']
        if subtype in BLACKLIST:
            return None, None  # Skip blacklisted items
        
        # Hospitality amenities
        if subtype in ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court', 'biergarten', 'nightclub']:
            return 'hospitality', subtype
        
        # Commercial amenities (services)
        if subtype in ['bank', 'bureau_de_change', 'post_office', 'clinic', 'dentist', 
                       'pharmacy', 'doctors', 'hospital', 'veterinary']:
            return 'commercial', subtype
        
        # Everything else is 'other'
        return 'other', f"amenity:{subtype}"
    
    # Check for Tourism (Hotels are hospitality, rest are other)
    if 'tourism' in row.index and isinstance(row['tourism'], str):
        subtype = row['tourism']
        if subtype in ['hotel', 'hostel', 'guest_house', 'motel', 'apartment']:
            return 'hospitality', subtype
        return 'other', f"tourism:{subtype}"
    
    # Check for Historic (all are other)
    if 'historic' in row.index and isinstance(row['historic'], str):
        return 'other', f"historic:{row['historic']}"
    
    # Check for Leisure (gyms/sports are commercial, rest are other)
    if 'leisure' in row.index and isinstance(row['leisure'], str):
        subtype = row['leisure']
        if subtype in BLACKLIST:
            return None, None
        if subtype in ['fitness_centre', 'gym', 'sports_centre']:
            return 'commercial', subtype
        return 'other', f"leisure:{subtype}"
    
    # Check for Craft (commercial)
    if 'craft' in row.index and isinstance(row['craft'], str):
        return 'commercial', f"craft:{row['craft']}"
    
    return 'other', 'unknown'


def fetch_all_pois() -> list:
    """Fetch all POIs and classify them dynamically."""
    print(f"Fetching ALL POIs from OpenStreetMap...")
    print(f"  Bounding box: N={BBOX['north']}, S={BBOX['south']}, E={BBOX['east']}, W={BBOX['west']}")
    
    try:
        # Fetch everything in one big query
        gdf = ox.features_from_bbox(
            bbox=(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north']),
            tags=TAGS
        )
        
        print(f"  Raw nodes found: {len(gdf)}")
        
        pois = []
        skipped_blacklist = 0
        skipped_unknown = 0
        
        for idx, row in gdf.iterrows():
            # 1. Determine Type
            poi_type, subtype = determine_type(row)
            
            if poi_type is None:
                skipped_blacklist += 1
                continue  # Skip blacklisted items
            
            # 2. Extract Geometry
            if row.geometry.geom_type == 'Point':
                lon, lat = row.geometry.x, row.geometry.y
            else:
                centroid = row.geometry.centroid
                lon, lat = centroid.x, centroid.y
            
            # 3. Extract IDs and Names
            osm_id = idx[1] if isinstance(idx, tuple) else idx
            name = row.get('name', None)
            
            # 4. Extract Extra Data (Opening Hours)
            opening_hours = row.get('opening_hours', None)
            
            pois.append({
                'name': name if isinstance(name, str) else f"Unnamed {subtype}",
                'type': poi_type,
                'subtype': subtype,
                'location': f"POINT({lon} {lat})",
                'osm_id': int(osm_id) if osm_id else None,
                'opening_hours': str(opening_hours) if isinstance(opening_hours, str) else None
            })
        
        print(f"  Skipped (blacklisted): {skipped_blacklist}")
        print(f"  Valid POIs: {len(pois)}")
        
        # Count by type
        type_counts = {}
        for poi in pois:
            t = poi['type']
            type_counts[t] = type_counts.get(t, 0) + 1
        
        print(f"  Breakdown by type:")
        for t, count in sorted(type_counts.items()):
            print(f"    - {t}: {count}")
        
        return pois
        
    except Exception as e:
        print(f"  Error fetching POIs: {e}")
        import traceback
        traceback.print_exc()
        return []


def insert_pois_to_supabase(client: Client, pois: list):
    """
    Insert POIs into Supabase business_nodes table.
    Uses upsert with osm_id as the unique key to avoid duplicates.
    """
    if not pois:
        print("No POIs to insert.")
        return
    
    print(f"Inserting {len(pois)} POIs into Supabase...")
    
    # Insert in batches
    batch_size = 100
    inserted = 0
    errors = 0
    
    for i in range(0, len(pois), batch_size):
        batch = pois[i:i + batch_size]
        
        try:
            # Filter out POIs without osm_id for upsert
            valid_batch = [p for p in batch if p.get('osm_id')]
            
            if valid_batch:
                result = client.table('business_nodes').upsert(
                    valid_batch,
                    on_conflict='osm_id'
                ).execute()
                inserted += len(valid_batch)
        except Exception as e:
            print(f"  Error inserting batch: {e}")
            errors += len(batch)
    
    print(f"  Inserted/updated: {inserted}, Errors: {errors}")


def main():
    """Main entry point."""
    print("=" * 60)
    print("OSM POI Scraper for Protest Impact Tracker")
    print("=" * 60)
    print()
    print(f"Target area: Central London")
    print(f"  North: {BBOX['north']}, South: {BBOX['south']}")
    print(f"  East: {BBOX['east']}, West: {BBOX['west']}")
    print()
    
    # Initialize Supabase client
    client = get_supabase_client()
    print("Connected to Supabase")
    print()
    
    # Fetch ALL POIs in one go
    all_pois = fetch_all_pois()
    
    print()
    print(f"Total Cleaned POIs to insert: {len(all_pois)}")
    print()
    
    if all_pois:
        insert_pois_to_supabase(client, all_pois)
    
    print()
    print("Done!")


if __name__ == '__main__':
    main()
