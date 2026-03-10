#!/usr/bin/env python3
"""
SweepBot Terms of Service Monitor
Tracks daily changes to platform ToS and alerts users to important modifications.
Historical ToS data cannot be reconstructed - start collecting NOW.
"""

import os
import time
import requests
import hashlib
from datetime import datetime, timezone
from supabase import create_client, Client
from bs4 import BeautifulSoup
from difflib import unified_diff
from typing import Dict, List, Optional
import logging
import json

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

# Platform ToS URLs
PLATFORMS = [
    {
        'slug': 'chumba-casino',
        'name': 'Chumba Casino',
        'tos_url': 'https://chumbacasino.com/terms-and-conditions',
        'content_selector': '.terms-content'
    },
    {
        'slug': 'stake-us',
        'name': 'Stake.us',
        'tos_url': 'https://stake.us/terms-of-service',
        'content_selector': '.legal-content'
    },
    {
        'slug': 'pulsz',
        'name': 'Pulsz',
        'tos_url': 'https://www.pulsz.com/terms-conditions',
        'content_selector': '.terms-text'
    },
    {
        'slug': 'luckylandslots',
        'name': 'LuckyLand Slots',
        'tos_url': 'https://luckylandslots.com/terms',
        'content_selector': '.page-content'
    },
    {
        'slug': 'wow-vegas',
        'name': 'WOW Vegas',
        'tos_url': 'https://wowvegas.com/terms-and-conditions',
        'content_selector': 'main'
    }
]

# Keywords that indicate important changes
IMPORTANT_KEYWORDS = [
    'withdrawal', 'redeem', 'redemption', 'payout', 'cashout',
    'wagering', 'playthrough', 'requirement', 'bonus',
    'verification', 'kyc', 'identity', 'age',
    'terminate', 'suspend', 'close account', 'ban',
    'liability', 'dispute', 'arbitration',
    'geographic', 'jurisdiction', 'state', 'legal',
    'sweep', 'promotional', 'coins'
]


def fetch_tos_content(platform: Dict) -> Optional[str]:
    """
    Fetch and extract ToS text from a platform.
    """
    try:
        logger.info(f"Fetching ToS from {platform['name']}...")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(platform['tos_url'], headers=headers, timeout=15)
        
        if response.status_code != 200:
            logger.warning(f"✗ {platform['name']} returned status {response.status_code}")
            return None
        
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Try to find content by selector
        content_elem = soup.select_one(platform.get('content_selector', 'body'))
        
        if content_elem:
            # Extract text, normalize whitespace
            text = content_elem.get_text(separator='\n', strip=True)
            logger.info(f"✓ Fetched {len(text)} characters from {platform['name']}")
            return text
        else:
            logger.warning(f"✗ Could not find content selector for {platform['name']}")
            return None
    
    except requests.exceptions.Timeout:
        logger.error(f"✗ Timeout fetching {platform['name']}")
        return None
    
    except Exception as e:
        logger.error(f"✗ Error fetching {platform['name']}: {e}")
        return None


def compute_hash(content: str) -> str:
    """
    Compute SHA-256 hash of content for change detection.
    """
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def get_latest_tos_snapshot(platform_id: str) -> Optional[Dict]:
    """
    Get the most recent ToS snapshot for a platform.
    """
    try:
        result = supabase.table('tos_snapshots')\
            .select('*')\
            .eq('platform_id', platform_id)\
            .order('captured_at', desc=True)\
            .limit(1)\
            .execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]
        return None
    
    except Exception as e:
        logger.error(f"Error fetching latest ToS snapshot: {e}")
        return None


def detect_changes(old_content: str, new_content: str) -> Dict:
    """
    Compare two versions of ToS and extract meaningful changes.
    """
    old_lines = old_content.split('\n')
    new_lines = new_content.split('\n')
    
    # Generate unified diff
    diff = list(unified_diff(old_lines, new_lines, lineterm=''))
    
    # Count additions and removals
    additions = [line for line in diff if line.startswith('+') and not line.startswith('+++')]
    removals = [line for line in diff if line.startswith('-') and not line.startswith('---')]
    
    # Check for important keyword changes
    important_changes = []
    for keyword in IMPORTANT_KEYWORDS:
        keyword_lower = keyword.lower()
        
        # Check if keyword appears in additions or removals
        keyword_in_additions = any(keyword_lower in line.lower() for line in additions)
        keyword_in_removals = any(keyword_lower in line.lower() for line in removals)
        
        if keyword_in_additions or keyword_in_removals:
            important_changes.append(keyword)
    
    return {
        'has_changes': len(diff) > 0,
        'total_diff_lines': len(diff),
        'additions_count': len(additions),
        'removals_count': len(removals),
        'important_keywords': important_changes,
        'diff_summary': '\n'.join(diff[:100])  # First 100 lines of diff
    }


def save_tos_snapshot(platform_id: str, content: str, content_hash: str, change_detected: bool, change_summary: Optional[Dict]) -> bool:
    """
    Save ToS snapshot to database.
    """
    try:
        record = {
            'platform_id': platform_id,
            'content': content,
            'content_hash': content_hash,
            'content_length': len(content),
            'change_detected': change_detected,
            'captured_at': datetime.now(timezone.utc).isoformat()
        }
        
        if change_summary:
            record['change_summary'] = json.dumps(change_summary)
        
        supabase.table('tos_snapshots').insert(record).execute()
        logger.info(f"💾 Saved ToS snapshot ({len(content)} chars, change={change_detected})")
        return True
    
    except Exception as e:
        logger.error(f"✗ Error saving snapshot: {e}")
        return False


def create_change_alert(platform_id: str, change_summary: Dict) -> bool:
    """
    Create alert for significant ToS changes.
    """
    try:
        # Only alert if there are important keyword changes
        if not change_summary.get('important_keywords'):
            return False
        
        alert = {
            'platform_id': platform_id,
            'alert_type': 'tos_change',
            'severity': 'high' if len(change_summary['important_keywords']) > 3 else 'medium',
            'title': 'Terms of Service Updated',
            'message': f"Platform ToS changed. Keywords affected: {', '.join(change_summary['important_keywords'][:5])}",
            'metadata': json.dumps(change_summary),
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        supabase.table('platform_alerts').insert(alert).execute()
        logger.info(f"🚨 Created alert for ToS change (keywords: {change_summary['important_keywords']})")
        return True
    
    except Exception as e:
        logger.error(f"✗ Error creating alert: {e}")
        return False


def monitor_platform(platform: Dict) -> Dict:
    """
    Monitor a single platform's ToS for changes.
    """
    try:
        # Get platform ID from slug
        platform_response = supabase.table('platforms')\
            .select('id')\
            .eq('slug', platform['slug'])\
            .single()\
            .execute()
        
        if not platform_response.data:
            logger.error(f"✗ Platform {platform['slug']} not found in database")
            return {'status': 'error', 'reason': 'platform_not_found'}
        
        platform_id = platform_response.data['id']
        
        # Fetch current ToS content
        current_content = fetch_tos_content(platform)
        
        if not current_content:
            return {'status': 'error', 'reason': 'fetch_failed'}
        
        current_hash = compute_hash(current_content)
        
        # Get latest snapshot
        latest_snapshot = get_latest_tos_snapshot(platform_id)
        
        if not latest_snapshot:
            # First snapshot - no comparison
            logger.info(f"📝 First snapshot for {platform['name']}")
            save_tos_snapshot(platform_id, current_content, current_hash, False, None)
            return {'status': 'first_snapshot', 'hash': current_hash}
        
        # Compare hashes
        if current_hash == latest_snapshot['content_hash']:
            logger.info(f"✓ No changes detected for {platform['name']}")
            return {'status': 'no_change', 'hash': current_hash}
        
        # CHANGE DETECTED!
        logger.warning(f"⚠️  CHANGE DETECTED for {platform['name']}")
        
        # Analyze changes
        change_summary = detect_changes(latest_snapshot['content'], current_content)
        
        logger.info(f"   Additions: {change_summary['additions_count']}")
        logger.info(f"   Removals: {change_summary['removals_count']}")
        logger.info(f"   Important keywords: {change_summary['important_keywords']}")
        
        # Save new snapshot
        save_tos_snapshot(platform_id, current_content, current_hash, True, change_summary)
        
        # Create alert if important changes detected
        if change_summary['important_keywords']:
            create_change_alert(platform_id, change_summary)
        
        return {
            'status': 'change_detected',
            'hash': current_hash,
            'summary': change_summary
        }
    
    except Exception as e:
        logger.error(f"✗ Error monitoring {platform['name']}: {e}")
        return {'status': 'error', 'reason': str(e)}


def run_daily_check():
    """
    Check all platforms once per day.
    """
    logger.info("🚀 Starting SweepBot ToS Monitor")
    logger.info(f"📊 Monitoring {len(PLATFORMS)} platforms")
    logger.info(f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = {
        'first_snapshot': 0,
        'no_change': 0,
        'change_detected': 0,
        'errors': 0
    }
    
    for platform in PLATFORMS:
        logger.info(f"\n{'='*60}")
        logger.info(f"Checking: {platform['name']}")
        logger.info(f"{'='*60}")
        
        result = monitor_platform(platform)
        status = result['status']
        
        if status in results:
            results[status] += 1
        
        # Wait 2 seconds between platforms
        time.sleep(2)
    
    # Summary
    logger.info(f"\n{'='*60}")
    logger.info("📈 Daily Check Summary:")
    logger.info(f"   First snapshots: {results['first_snapshot']}")
    logger.info(f"   No changes: {results['no_change']}")
    logger.info(f"   Changes detected: {results['change_detected']}")
    logger.info(f"   Errors: {results['errors']}")
    logger.info(f"{'='*60}")
    
    return results


def run_monitor():
    """
    Main loop - runs once per day at midnight UTC.
    """
    logger.info("🔄 ToS Monitor started (runs daily at 00:00 UTC)")
    
    while True:
        try:
            now = datetime.now(timezone.utc)
            
            # Check if it's midnight UTC (or first run)
            if now.hour == 0 or True:  # Remove "or True" after first test run
                logger.info("\n🌅 Starting daily ToS check...")
                run_daily_check()
                
                # Sleep for 1 hour to avoid re-running in same hour
                logger.info("😴 Sleeping for 1 hour...")
                time.sleep(3600)
            else:
                # Check again in 5 minutes
                time.sleep(300)
        
        except KeyboardInterrupt:
            logger.info("\n👋 Monitor stopped by user")
            break
        
        except Exception as e:
            logger.error(f"✗ Unexpected error: {e}")
            logger.info("⏳ Sleeping 10 minutes before retry...")
            time.sleep(600)


if __name__ == '__main__':
    # For testing, run once immediately
    if os.environ.get('RUN_ONCE'):
        run_daily_check()
    else:
        run_monitor()
