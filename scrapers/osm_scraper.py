"""
OSM Business Node Scraper
=========================
Downloads retail and hospitality points of interest from OpenStreetMap
for Central London and inserts them into the Supabase database.

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

# OSM tags for retail and hospitality
TAGS = {
    'retail': {
        'shop': True,  # All shop types
    },
    'hospitality': {
        'amenity': ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court', 'biergarten'],
    }
}


def get_supabase_client() -> Client:
    """Create and return Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Supabase credentials not found.")
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your environment or .env file")
        sys.exit(1)
    
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_osm_pois(tags: dict, poi_type: str) -> list:
    """
    Fetch POIs from OpenStreetMap using osmnx.
    
    Args:
        tags: OSM tags to search for
        poi_type: 'retail' or 'hospitality'
    
    Returns:
        List of POI dictionaries
    """
    print(f"Fetching {poi_type} POIs from OpenStreetMap...")
    
    try:
        # Create place polygon from bounding box
        gdf = ox.features_from_bbox(
            bbox=(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north']),
            tags=tags
        )
        
        print(f"  Found {len(gdf)} {poi_type} nodes")
        
        pois = []
        for idx, row in gdf.iterrows():
            # Get the centroid for polygons, or point geometry
            if row.geometry.geom_type == 'Point':
                lon, lat = row.geometry.x, row.geometry.y
            else:
                centroid = row.geometry.centroid
                lon, lat = centroid.x, centroid.y
            
            # Extract OSM ID
            osm_id = None
            if isinstance(idx, tuple):
                osm_id = idx[1]  # (element_type, id)
            elif hasattr(idx, '__iter__'):
                osm_id = idx
            
            # Get name and subtype
            name = row.get('name', None)
            subtype = None
            
            if poi_type == 'retail' and 'shop' in row.index:
                subtype = row.get('shop', None)
            elif poi_type == 'hospitality' and 'amenity' in row.index:
                subtype = row.get('amenity', None)
            
            pois.append({
                'name': name if isinstance(name, str) else None,
                'type': poi_type,
                'subtype': subtype if isinstance(subtype, str) else None,
                'location': f"POINT({lon} {lat})",
                'osm_id': int(osm_id) if osm_id else None
            })
        
        return pois
        
    except Exception as e:
        print(f"  Error fetching {poi_type} POIs: {e}")
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
    print("OSM Business Node Scraper for Protest Impact Tracker")
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
    
    # Fetch retail POIs
    retail_pois = fetch_osm_pois(TAGS['retail'], 'retail')
    
    # Fetch hospitality POIs
    hospitality_pois = fetch_osm_pois(TAGS['hospitality'], 'hospitality')
    
    # Combine and insert
    all_pois = retail_pois + hospitality_pois
    print()
    print(f"Total POIs found: {len(all_pois)}")
    print()
    
    if all_pois:
        insert_pois_to_supabase(client, all_pois)
    
    print()
    print("Done!")


if __name__ == '__main__':
    main()
