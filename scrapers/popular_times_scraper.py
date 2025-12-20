"""
Google Popular Times Scraper
============================
Scrapes Google Maps "Popular Times" data for key London landmarks.
This data represents historical average busyness patterns.

WARNING: This scrapes Google without official API access. 
Use responsibly and be aware this may violate Google's ToS.

Usage:
    python popular_times_scraper.py

The script targets ~50 key waypoints along typical protest routes.
"""

import os
import sys
import time
import json
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client, Client

# Try to import populartimes - it may not be available
try:
    import populartimes
    POPULARTIMES_AVAILABLE = True
except ImportError:
    POPULARTIMES_AVAILABLE = False
    print("Warning: 'populartimes' package not found. Using fallback data.")

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY', '')  # Optional - populartimes can work without it

# Key London landmarks along typical protest routes
# These are high-traffic points suitable for footfall baseline
TARGET_PLACES = [
    # Hyde Park / Park Lane corridor (common assembly point)
    {"name": "Hyde Park Corner", "lat": 51.5027, "lng": -0.1527},
    {"name": "Marble Arch", "lat": 51.5134, "lng": -0.1591},
    {"name": "Speakers Corner", "lat": 51.5114, "lng": -0.1593},
    
    # Whitehall / Westminster corridor (common march route)
    {"name": "Trafalgar Square", "lat": 51.5080, "lng": -0.1281},
    {"name": "Charing Cross Station", "lat": 51.5074, "lng": -0.1246},
    {"name": "Embankment Station", "lat": 51.5074, "lng": -0.1224},
    {"name": "Whitehall", "lat": 51.5040, "lng": -0.1266},
    {"name": "Downing Street", "lat": 51.5033, "lng": -0.1276},
    {"name": "Parliament Square", "lat": 51.5010, "lng": -0.1268},
    {"name": "Westminster Abbey", "lat": 51.4992, "lng": -0.1273},
    {"name": "Big Ben", "lat": 51.5007, "lng": -0.1246},
    
    # Victoria / Pimlico
    {"name": "Victoria Station", "lat": 51.4952, "lng": -0.1439},
    {"name": "Victoria Street", "lat": 51.4978, "lng": -0.1400},
    
    # Central shopping areas
    {"name": "Oxford Circus", "lat": 51.5152, "lng": -0.1416},
    {"name": "Piccadilly Circus", "lat": 51.5100, "lng": -0.1347},
    {"name": "Leicester Square", "lat": 51.5102, "lng": -0.1308},
    {"name": "Covent Garden", "lat": 51.5117, "lng": -0.1240},
    
    # Holborn / City fringes
    {"name": "Holborn Station", "lat": 51.5175, "lng": -0.1200},
    {"name": "Chancery Lane", "lat": 51.5183, "lng": -0.1112},
    {"name": "Fleet Street", "lat": 51.5140, "lng": -0.1078},
    {"name": "St Paul's Cathedral", "lat": 51.5138, "lng": -0.0984},
    
    # South Bank
    {"name": "Waterloo Station", "lat": 51.5031, "lng": -0.1132},
    {"name": "South Bank Centre", "lat": 51.5068, "lng": -0.1163},
    {"name": "London Eye", "lat": 51.5033, "lng": -0.1196},
    {"name": "Westminster Bridge", "lat": 51.5009, "lng": -0.1220},
    {"name": "Lambeth Bridge", "lat": 51.4948, "lng": -0.1230},
    {"name": "Vauxhall Bridge", "lat": 51.4866, "lng": -0.1264},
    
    # Additional protest-relevant locations
    {"name": "Euston Station", "lat": 51.5282, "lng": -0.1337},
    {"name": "Kings Cross", "lat": 51.5309, "lng": -0.1233},
    {"name": "Russell Square", "lat": 51.5227, "lng": -0.1252},
    {"name": "Bloomsbury", "lat": 51.5198, "lng": -0.1270},
]

# Day name mapping
DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


def get_supabase_client() -> Client:
    """Create and return Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Supabase credentials not found.")
        sys.exit(1)
    
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_popular_times(place_name: str, lat: float, lng: float) -> dict | None:
    """
    Fetch Popular Times data for a location.
    
    Returns dict with hourly data for each day, or None if unavailable.
    """
    if not POPULARTIMES_AVAILABLE or not GOOGLE_API_KEY:
        return None
    
    try:
        # Try to find the place and get popular times
        # This uses Google Places API under the hood
        results = populartimes.get(GOOGLE_API_KEY, ['establishment'], (lat, lng), (lat, lng), radius=100)
        
        for place in results:
            if place.get('populartimes'):
                return place['populartimes']
        
        return None
    except Exception as e:
        print(f"  Error fetching {place_name}: {e}")
        return None


def generate_estimated_popular_times(place_name: str, lat: float, lng: float) -> list:
    """
    Generate estimated popular times based on location type and position.
    
    This provides realistic estimates when scraping isn't available.
    """
    # Determine location type based on name/position
    is_station = 'station' in place_name.lower()
    is_shopping = any(x in place_name.lower() for x in ['circus', 'square', 'street', 'garden'])
    is_landmark = any(x in place_name.lower() for x in ['cathedral', 'abbey', 'eye', 'bridge', 'ben'])
    is_transit = is_station or 'bridge' in place_name.lower()
    
    records = []
    
    for day_idx, day in enumerate(DAYS):
        is_weekend = day in ['Saturday', 'Sunday']
        
        for hour in range(24):
            # Base pattern
            if 0 <= hour < 6:
                base = 5 + hour
            elif 6 <= hour < 9:
                base = 20 + (hour - 6) * 15  # Morning ramp up
            elif 9 <= hour < 12:
                base = 60 + (hour - 9) * 10  # Morning peak
            elif 12 <= hour < 14:
                base = 85  # Lunch peak
            elif 14 <= hour < 17:
                base = 75 - (hour - 14) * 5  # Afternoon decline
            elif 17 <= hour < 20:
                base = 65 + (hour - 17) * 5  # Evening peak
            elif 20 <= hour < 23:
                base = 60 - (hour - 20) * 15  # Evening decline
            else:
                base = 15
            
            # Adjust for location type
            if is_station:
                # Stations have strong commuter peaks on weekdays
                if not is_weekend and (7 <= hour <= 9 or 17 <= hour <= 19):
                    base = min(100, base + 25)
                elif is_weekend:
                    base = int(base * 0.7)
            
            if is_shopping:
                # Shopping areas busy on weekends
                if is_weekend and 10 <= hour <= 18:
                    base = min(100, base + 20)
            
            if is_landmark:
                # Landmarks steady during tourist hours
                if 10 <= hour <= 17:
                    base = max(base, 50)
            
            if is_transit:
                # Transit areas have commuter patterns
                if not is_weekend and (8 <= hour <= 9 or 17 <= hour <= 18):
                    base = min(100, base + 15)
            
            # Weekend adjustments
            if is_weekend:
                if day == 'Saturday':
                    base = int(base * 1.1)  # Saturday slightly busier
                else:
                    base = int(base * 0.85)  # Sunday quieter
            
            # Ensure 0-100 range
            score = max(0, min(100, int(base)))
            
            records.append({
                'location_name': place_name,
                'location_point': f"POINT({lng} {lat})",
                'day_of_week': day,
                'hour_of_day': hour,
                'avg_footfall_score': score,
                'raw_footfall_value': score * 100,
                'source': 'GOOGLE_POPULAR_TIMES_ESTIMATE',
                'source_date': '2024-01-01'
            })
    
    return records


def scrape_all_places() -> list:
    """Scrape or estimate popular times for all target places."""
    all_records = []
    
    print(f"Processing {len(TARGET_PLACES)} locations...")
    print()
    
    for i, place in enumerate(TARGET_PLACES):
        name = place['name']
        lat = place['lat']
        lng = place['lng']
        
        print(f"  [{i+1}/{len(TARGET_PLACES)}] {name}")
        
        # Try to fetch real data first
        popular_times = fetch_popular_times(name, lat, lng)
        
        if popular_times:
            # Parse the populartimes format
            for day_data in popular_times:
                day_idx = day_data.get('day', 0)
                day_name = DAYS[day_idx]
                
                for hour, popularity in enumerate(day_data.get('data', [])):
                    all_records.append({
                        'location_name': name,
                        'location_point': f"POINT({lng} {lat})",
                        'day_of_week': day_name,
                        'hour_of_day': hour,
                        'avg_footfall_score': popularity,
                        'raw_footfall_value': popularity * 100,
                        'source': 'GOOGLE_POPULAR_TIMES',
                        'source_date': '2024-01-01'
                    })
            
            print(f"      ✓ Real data fetched")
        else:
            # Use estimated data
            records = generate_estimated_popular_times(name, lat, lng)
            all_records.extend(records)
            print(f"      ~ Estimated data generated")
        
        # Rate limiting
        time.sleep(0.1)
    
    return all_records


def insert_records(client: Client, records: list):
    """Insert records into Supabase."""
    print()
    print(f"Inserting {len(records)} records into Supabase...")
    
    batch_size = 100
    inserted = 0
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        
        try:
            client.table('footfall_baseline').upsert(
                batch,
                on_conflict='location_name,day_of_week,hour_of_day,source'
            ).execute()
            inserted += len(batch)
        except Exception as e:
            print(f"  Error: {e}")
    
    print(f"  Inserted/updated: {inserted} records")


def main():
    """Main entry point."""
    print("=" * 60)
    print("Google Popular Times Scraper")
    print("=" * 60)
    print()
    
    if not POPULARTIMES_AVAILABLE:
        print("Note: populartimes package not available.")
        print("Will generate estimated data based on location patterns.")
        print()
    
    if not GOOGLE_API_KEY:
        print("Note: GOOGLE_API_KEY not set.")
        print("Will generate estimated data based on location patterns.")
        print()
    
    client = get_supabase_client()
    print("Connected to Supabase")
    print()
    
    records = scrape_all_places()
    
    print()
    print(f"Total records: {len(records)}")
    
    insert_records(client, records)
    
    print()
    print("Done!")


if __name__ == '__main__':
    main()
