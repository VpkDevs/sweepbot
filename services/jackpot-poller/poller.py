#!/usr/bin/env python3
"""
SweepBot Jackpot Poller
Collects progressive jackpot values every 60 seconds across 20+ platforms.
This data becomes irreplaceable - every day of collection is a permanent advantage.
"""

import os
import time
import requests
import json
from datetime import datetime, timezone
from supabase import create_client, Client
from typing import Dict, List, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Platform configurations
PLATFORMS = [
    {
        'slug': 'chumba-casino',
        'name': 'Chumba Casino',
        'jackpot_url': 'https://chumbacasino.com/api/games/jackpots',
        'parser': 'generic_json',
        'requires_auth': False
    },
    {
        'slug': 'stake-us',
        'name': 'Stake.us',
        'jackpot_url': 'https://stake.us/api/progressive-jackpots',
        'parser': 'generic_json',
        'requires_auth': False
    },
    {
        'slug': 'pulsz',
        'name': 'Pulsz',
        'jackpot_url': 'https://www.pulsz.com/api/v1/jackpots',
        'parser': 'generic_json',
        'requires_auth': False
    },
    {
        'slug': 'luckylandslots',
        'name': 'LuckyLand Slots',
        'jackpot_url': 'https://luckylandslots.com/api/jackpots',
        'parser': 'generic_json',
        'requires_auth': False
    },
    {
        'slug': 'wow-vegas',
        'name': 'WOW Vegas',
        'jackpot_url': 'https://wowvegas.com/api/games/jackpots',
        'parser': 'generic_json',
        'requires_auth': False
    }
]


def parse_generic_json(data: Dict, platform_slug: str) -> List[Dict]:
    """
    Parse generic JSON response for jackpot data.
    Adapt this based on actual API responses from platforms.
    """
    jackpots = []
    
    try:
        # Try common JSON structures
        jackpot_list = data.get('jackpots', data.get('data', data.get('games', [])))
        
        if isinstance(jackpot_list, list):
            for item in jackpot_list:
                jackpot = {
                    'platform_slug': platform_slug,
                    'game_name': item.get('name', item.get('gameName', item.get('title', 'Unknown'))),
                    'value': float(item.get('amount', item.get('value', item.get('jackpot', 0)))),
                    'currency': item.get('currency', 'SC'),  # Sweeps Coins default
                    'game_id': item.get('id', item.get('gameId', None)),
                    'jackpot_type': item.get('type', 'progressive'),
                    'captured_at': datetime.now(timezone.utc).isoformat()
                }
                
                # Only add if value > 0
                if jackpot['value'] > 0:
                    jackpots.append(jackpot)
    
    except Exception as e:
        logger.error(f"Error parsing jackpot data for {platform_slug}: {e}")
    
    return jackpots


def fetch_platform_jackpots(platform: Dict) -> List[Dict]:
    """
    Fetch jackpot data from a single platform.
    """
    try:
        logger.info(f"Fetching jackpots from {platform['name']}...")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
        }
        
        response = requests.get(
            platform['jackpot_url'],
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            jackpots = parse_generic_json(data, platform['slug'])
            logger.info(f"✓ Found {len(jackpots)} jackpots from {platform['name']}")
            return jackpots
        else:
            logger.warning(f"✗ {platform['name']} returned status {response.status_code}")
            return []
    
    except requests.exceptions.Timeout:
        logger.error(f"✗ Timeout fetching from {platform['name']}")
        return []
    
    except requests.exceptions.RequestException as e:
        logger.error(f"✗ Request error for {platform['name']}: {e}")
        return []
    
    except Exception as e:
        logger.error(f"✗ Unexpected error for {platform['name']}: {e}")
        return []


def save_jackpot_snapshots(jackpots: List[Dict]) -> int:
    """
    Save jackpot snapshots to Supabase.
    Returns the number of successfully saved snapshots.
    """
    if not jackpots:
        return 0
    
    try:
        # First, get platform IDs from slugs
        platform_slugs = list(set([j['platform_slug'] for j in jackpots]))
        
        platforms_response = supabase.table('platforms')\
            .select('id, slug')\
            .in_('slug', platform_slugs)\
            .execute()
        
        platform_map = {p['slug']: p['id'] for p in platforms_response.data}
        
        # Prepare records for insertion
        records = []
        for jackpot in jackpots:
            platform_id = platform_map.get(jackpot['platform_slug'])
            if not platform_id:
                logger.warning(f"Platform {jackpot['platform_slug']} not found in DB, skipping")
                continue
            
            records.append({
                'platform_id': platform_id,
                'game_name': jackpot['game_name'],
                'value': jackpot['value'],
                'currency': jackpot['currency'],
                'game_id': jackpot.get('game_id'),
                'jackpot_type': jackpot.get('jackpot_type', 'progressive'),
                'captured_at': jackpot['captured_at']
            })
        
        if records:
            result = supabase.table('jackpot_snapshots').insert(records).execute()
            logger.info(f"💾 Saved {len(records)} jackpot snapshots to database")
            return len(records)
        
        return 0
    
    except Exception as e:
        logger.error(f"✗ Error saving to database: {e}")
        return 0


def poll_all_platforms() -> Dict:
    """
    Poll all configured platforms and save results.
    Returns summary statistics.
    """
    start_time = time.time()
    all_jackpots = []
    
    for platform in PLATFORMS:
        jackpots = fetch_platform_jackpots(platform)
        all_jackpots.extend(jackpots)
        
        # Small delay between platforms to be respectful
        time.sleep(1)
    
    saved_count = save_jackpot_snapshots(all_jackpots)
    elapsed = time.time() - start_time
    
    return {
        'total_fetched': len(all_jackpots),
        'total_saved': saved_count,
        'platforms_checked': len(PLATFORMS),
        'elapsed_seconds': round(elapsed, 2)
    }


def run_poller():
    """
    Main polling loop - runs every 60 seconds indefinitely.
    """
    logger.info("🚀 Starting SweepBot Jackpot Poller")
    logger.info(f"📊 Monitoring {len(PLATFORMS)} platforms")
    logger.info(f"⏰ Polling interval: 60 seconds")
    
    iteration = 0
    
    while True:
        try:
            iteration += 1
            logger.info(f"\n{'='*60}")
            logger.info(f"Polling iteration #{iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"{'='*60}")
            
            stats = poll_all_platforms()
            
            logger.info(f"\n📈 Iteration #{iteration} Summary:")
            logger.info(f"   Jackpots fetched: {stats['total_fetched']}")
            logger.info(f"   Jackpots saved: {stats['total_saved']}")
            logger.info(f"   Platforms checked: {stats['platforms_checked']}")
            logger.info(f"   Time elapsed: {stats['elapsed_seconds']}s")
            
            # Sleep until next iteration (60 seconds total)
            sleep_time = max(0, 60 - stats['elapsed_seconds'])
            if sleep_time > 0:
                logger.info(f"😴 Sleeping for {sleep_time:.1f} seconds...")
                time.sleep(sleep_time)
        
        except KeyboardInterrupt:
            logger.info("\n👋 Poller stopped by user")
            break
        
        except Exception as e:
            logger.error(f"✗ Unexpected error in polling loop: {e}")
            logger.info("⏳ Waiting 60 seconds before retry...")
            time.sleep(60)


if __name__ == '__main__':
    run_poller()
