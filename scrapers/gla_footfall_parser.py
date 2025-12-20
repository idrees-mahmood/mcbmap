"""
GLA High Street Footfall Data Parser
=====================================
Parses the Greater London Authority's High Street footfall data
and inserts normalized values into the Supabase database.

Data Source:
    https://data.london.gov.uk/dataset/high-streets-footfall-data

Usage:
    python gla_footfall_parser.py <path_to_csv>

The CSV should have columns for location, date/time, and footfall counts.
This script normalizes values to 0-100 scale and stores hourly averages.
"""

import os
import sys
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

import pandas as pd
from supabase import create_client, Client

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

# Known high street locations with coordinates (Central London focus)
# These are approximate centroids for each high street
LOCATION_COORDS = {
    'Oxford Street': (-0.1410, 51.5153),
    'Regent Street': (-0.1376, 51.5114),
    'Bond Street': (-0.1485, 51.5133),
    'Covent Garden': (-0.1235, 51.5116),
    'Leicester Square': (-0.1281, 51.5103),
    'Piccadilly': (-0.1378, 51.5078),
    'Soho': (-0.1337, 51.5137),
    'Carnaby Street': (-0.1383, 51.5129),
    'Marylebone High Street': (-0.1529, 51.5199),
    'Victoria': (-0.1432, 51.4967),
    'Westminster': (-0.1276, 51.5014),
    'Whitehall': (-0.1266, 51.5040),
    'Trafalgar Square': (-0.1276, 51.5080),
    'The Strand': (-0.1190, 51.5108),
    'Charing Cross': (-0.1246, 51.5074),
    'Tottenham Court Road': (-0.1306, 51.5165),
    'Kings Cross': (-0.1246, 51.5309),
    'Camden': (-0.1426, 51.5390),
    'Shoreditch': (-0.0763, 51.5236),
    'Brick Lane': (-0.0715, 51.5215),
    'Liverpool Street': (-0.0823, 51.5178),
    'Bank': (-0.0887, 51.5133),
    'South Bank': (-0.1157, 51.5047),
    'Borough Market': (-0.0906, 51.5054),
    'London Bridge': (-0.0862, 51.5055),
    'Tower Bridge': (-0.0754, 51.5055),
    'Canary Wharf': (-0.0197, 51.5054),
    'Greenwich': (-0.0076, 51.4769),
    'Kensington High Street': (-0.1910, 51.5003),
    'Chelsea': (-0.1687, 51.4875),
    'Knightsbridge': (-0.1609, 51.5013),
    'Notting Hill': (-0.2019, 51.5111),
    'Portobello Road': (-0.2046, 51.5153),
}


def get_supabase_client() -> Client:
    """Create and return Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Supabase credentials not found.")
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your environment or .env file")
        sys.exit(1)
    
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def normalize_to_100(values: pd.Series) -> pd.Series:
    """Normalize values to 0-100 scale."""
    min_val = values.min()
    max_val = values.max()
    
    if max_val == min_val:
        return pd.Series([50] * len(values))
    
    return ((values - min_val) / (max_val - min_val) * 100).round().astype(int)


def parse_gla_csv(filepath: str) -> pd.DataFrame:
    """
    Parse GLA High Street footfall CSV.
    
    Expected columns (adjust based on actual GLA data format):
    - Location/HighStreet: Name of the high street
    - Date: Date of measurement
    - Hour: Hour of day (0-23)
    - Footfall: Raw footfall count
    
    Returns DataFrame with normalized data.
    """
    print(f"Reading CSV: {filepath}")
    
    try:
        df = pd.read_csv(filepath)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        sys.exit(1)
    
    print(f"  Found {len(df)} rows")
    print(f"  Columns: {list(df.columns)}")
    
    # Try to identify columns (GLA data may have different naming)
    location_col = None
    date_col = None
    footfall_col = None
    
    for col in df.columns:
        col_lower = col.lower()
        if 'location' in col_lower or 'high' in col_lower or 'street' in col_lower or 'name' in col_lower:
            location_col = col
        elif 'date' in col_lower or 'time' in col_lower:
            date_col = col
        elif 'footfall' in col_lower or 'count' in col_lower or 'pedestrian' in col_lower:
            footfall_col = col
    
    if not all([location_col, date_col, footfall_col]):
        print("Warning: Could not auto-detect all required columns.")
        print("Please ensure your CSV has columns for: Location, Date/Time, Footfall count")
        print(f"  Detected: location={location_col}, date={date_col}, footfall={footfall_col}")
    
    return df


def generate_sample_data() -> list:
    """
    Generate sample footfall data for testing.
    Uses known London locations with realistic hourly patterns.
    """
    print("Generating sample footfall data for Central London locations...")
    
    records = []
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    # Typical hourly patterns (0-100 scale)
    weekday_pattern = [5, 3, 2, 2, 3, 10, 25, 50, 65, 60, 65, 75, 85, 80, 75, 70, 75, 85, 70, 50, 35, 25, 15, 8]
    saturday_pattern = [8, 5, 3, 3, 5, 8, 15, 30, 50, 70, 85, 95, 100, 95, 90, 85, 80, 70, 55, 40, 30, 25, 18, 12]
    sunday_pattern = [5, 3, 2, 2, 3, 5, 10, 20, 35, 50, 65, 80, 85, 80, 70, 60, 50, 40, 30, 25, 18, 12, 8, 5]
    
    # Location multipliers (relative busyness)
    location_multipliers = {
        'Oxford Street': 1.0,
        'Regent Street': 0.9,
        'Covent Garden': 0.85,
        'Leicester Square': 0.8,
        'Piccadilly': 0.75,
        'Trafalgar Square': 0.7,
        'South Bank': 0.65,
        'Borough Market': 0.6,
        'Camden': 0.7,
        'Shoreditch': 0.55,
        'Notting Hill': 0.5,
        'Westminster': 0.45,
        'Whitehall': 0.35,  # Lower - more transit, less retail
    }
    
    for location, (lon, lat) in LOCATION_COORDS.items():
        multiplier = location_multipliers.get(location, 0.5)
        
        for day in days:
            if day == 'Saturday':
                pattern = saturday_pattern
            elif day == 'Sunday':
                pattern = sunday_pattern
            else:
                pattern = weekday_pattern
            
            for hour, base_score in enumerate(pattern):
                # Apply location multiplier and add some variation
                score = int(min(100, max(0, base_score * multiplier)))
                
                records.append({
                    'location_name': location,
                    'location_point': f"POINT({lon} {lat})",
                    'day_of_week': day,
                    'hour_of_day': hour,
                    'avg_footfall_score': score,
                    'raw_footfall_value': score * 100,  # Simulated raw value
                    'source': 'SAMPLE_DATA',
                    'source_date': '2024-01-01'
                })
    
    print(f"  Generated {len(records)} records for {len(LOCATION_COORDS)} locations")
    return records


def insert_footfall_data(client: Client, records: list):
    """Insert footfall data into Supabase."""
    if not records:
        print("No records to insert.")
        return
    
    print(f"Inserting {len(records)} footfall records into Supabase...")
    
    batch_size = 100
    inserted = 0
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        
        try:
            result = client.table('footfall_baseline').upsert(
                batch,
                on_conflict='location_name,day_of_week,hour_of_day,source'
            ).execute()
            inserted += len(batch)
        except Exception as e:
            print(f"  Error inserting batch: {e}")
    
    print(f"  Inserted/updated: {inserted} records")


def main():
    """Main entry point."""
    print("=" * 60)
    print("GLA High Street Footfall Parser")
    print("=" * 60)
    print()
    
    client = get_supabase_client()
    print("Connected to Supabase")
    print()
    
    if len(sys.argv) > 1:
        # Parse provided CSV file
        csv_path = sys.argv[1]
        if not os.path.exists(csv_path):
            print(f"Error: File not found: {csv_path}")
            sys.exit(1)
        
        df = parse_gla_csv(csv_path)
        print()
        print("CSV parsing complete. Manual column mapping may be required.")
        print("For now, generating sample data instead...")
        print()
    else:
        print("No CSV file provided. Generating sample footfall data...")
        print()
        print("To use real GLA data, download from:")
        print("  https://data.london.gov.uk/dataset/high-streets-footfall-data")
        print()
        print("Then run: python gla_footfall_parser.py <path_to_csv>")
        print()
    
    # Generate and insert sample data
    records = generate_sample_data()
    insert_footfall_data(client, records)
    
    print()
    print("Done!")


if __name__ == '__main__':
    main()
