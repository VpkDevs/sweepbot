#!/usr/bin/env python3
"""
SweepBot Platform Health Checker
Monitors platform uptime, API response times, and login availability.
Feeds Trust Index uptime score and provides real-time status for automation.
"""

import os
import time
import requests
from datetime import datetime, timezone
from supabase import create_client, Client
from typing import Dict, List, Optional
import logging
import statistics

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

# Check every 5 minutes
CHECK_INTERVAL_SECONDS = 300

# Platform health check configurations
PLATFORMS = [
    {
        'slug': 'chumba-casino',
        'name': 'Chumba Casino',
        'urls': {
            'homepage': 'https://chumbacasino.com',
            'login': 'https://chumbacasino.com/login',
            'api': 'https://chumbacasino.com/api/health'
        },
        'expected_status': 200,
        'timeout': 10
    },
    {
        'slug': 'stake-us',
        'name': 'Stake.us',
        'urls': {
            'homepage': 'https://stake.us',
            'login': 'https://stake.us/auth/login',
            'api': 'https://stake.us/api/v1/health'
        },
        'expected_status': 200,
        'timeout': 10
    },
    {
        'slug': 'pulsz',
        'name': 'Pulsz',
        'urls': {
            'homepage': 'https://www.pulsz.com',
            'login': 'https://www.pulsz.com/login',
            'api': 'https://www.pulsz.com/api/status'
        },
        'expected_status': 200,
        'timeout': 10
    },
    {
        'slug': 'luckylandslots',
        'name': 'LuckyLand Slots',
        'urls': {
            'homepage': 'https://luckylandslots.com',
            'login': 'https://luckylandslots.com/login'
        },
        'expected_status': 200,
        'timeout': 10
    },
    {
        'slug': 'wow-vegas',
        'name': 'WOW Vegas',
        'urls': {
            'homepage': 'https://wowvegas.com',
            'login': 'https://wowvegas.com/account/login'
        },
        'expected_status': 200,
        'timeout': 10
    }
]


def check_url(url: str, timeout: int = 10, expected_status: int = 200) -> Dict:
    """
    Perform health check on a single URL.
    Returns status, response time, and any errors.
    """
    start_time = time.time()
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        
        is_healthy = response.status_code == expected_status
        
        return {
            'url': url,
            'status': 'healthy' if is_healthy else 'degraded',
            'status_code': response.status_code,
            'response_time_ms': elapsed_ms,
            'error': None if is_healthy else f"Expected {expected_status}, got {response.status_code}"
        }
    
    except requests.exceptions.Timeout:
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return {
            'url': url,
            'status': 'down',
            'status_code': None,
            'response_time_ms': elapsed_ms,
            'error': 'Timeout'
        }
    
    except requests.exceptions.ConnectionError as e:
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return {
            'url': url,
            'status': 'down',
            'status_code': None,
            'response_time_ms': elapsed_ms,
            'error': f'Connection error: {str(e)[:100]}'
        }
    
    except Exception as e:
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return {
            'url': url,
            'status': 'error',
            'status_code': None,
            'response_time_ms': elapsed_ms,
            'error': str(e)[:200]
        }


def check_platform_health(platform: Dict) -> Dict:
    """
    Check all configured URLs for a platform.
    """
    logger.info(f"Checking {platform['name']}...")
    
    results = {}
    
    for endpoint, url in platform['urls'].items():
        result = check_url(url, platform.get('timeout', 10), platform.get('expected_status', 200))
        results[endpoint] = result
        
        status_emoji = '✓' if result['status'] == 'healthy' else '✗'
        logger.info(f"  {status_emoji} {endpoint}: {result['status']} ({result['response_time_ms']}ms)")
    
    # Calculate overall platform status
    statuses = [r['status'] for r in results.values()]
    
    if all(s == 'healthy' for s in statuses):
        overall_status = 'healthy'
    elif any(s == 'down' for s in statuses):
        overall_status = 'down'
    elif any(s == 'degraded' for s in statuses):
        overall_status = 'degraded'
    else:
        overall_status = 'error'
    
    # Calculate average response time (only for successful checks)
    response_times = [r['response_time_ms'] for r in results.values() if r['response_time_ms'] and r['status'] in ['healthy', 'degraded']]
    avg_response_time = round(statistics.mean(response_times), 2) if response_times else None
    
    return {
        'platform_slug': platform['slug'],
        'platform_name': platform['name'],
        'overall_status': overall_status,
        'avg_response_time_ms': avg_response_time,
        'endpoint_results': results,
        'checked_at': datetime.now(timezone.utc).isoformat()
    }


def save_health_check(platform_id: str, health_data: Dict) -> bool:
    """
    Save health check result to database.
    """
    try:
        record = {
            'platform_id': platform_id,
            'status': health_data['overall_status'],
            'avg_response_time_ms': health_data['avg_response_time_ms'],
            'endpoint_results': health_data['endpoint_results'],
            'checked_at': health_data['checked_at']
        }
        
        supabase.table('platform_health_checks').insert(record).execute()
        return True
    
    except Exception as e:
        logger.error(f"✗ Error saving health check: {e}")
        return False


def detect_outage(platform_id: str, current_status: str) -> bool:
    """
    Check if this is a new outage (status changed from healthy to down).
    """
    try:
        # Get last 5 checks
        recent_checks = supabase.table('platform_health_checks')\
            .select('status')\
            .eq('platform_id', platform_id)\
            .order('checked_at', desc=True)\
            .limit(5)\
            .execute()
        
        if not recent_checks.data or len(recent_checks.data) < 2:
            return False
        
        # If current is down and previous was healthy, it's a new outage
        previous_status = recent_checks.data[0]['status']
        
        return current_status == 'down' and previous_status in ['healthy', 'degraded']
    
    except Exception as e:
        logger.error(f"Error checking outage: {e}")
        return False


def create_outage_alert(platform_id: str, health_data: Dict) -> bool:
    """
    Create alert for platform outage.
    """
    try:
        failed_endpoints = [
            name for name, result in health_data['endpoint_results'].items()
            if result['status'] == 'down'
        ]
        
        alert = {
            'platform_id': platform_id,
            'alert_type': 'platform_outage',
            'severity': 'critical',
            'title': f"{health_data['platform_name']} is Down",
            'message': f"Platform is currently unreachable. Failed endpoints: {', '.join(failed_endpoints)}",
            'metadata': {
                'endpoint_results': health_data['endpoint_results']
            },
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        supabase.table('platform_alerts').insert(alert).execute()
        logger.warning(f"🚨 Created outage alert for {health_data['platform_name']}")
        return True
    
    except Exception as e:
        logger.error(f"✗ Error creating alert: {e}")
        return False


def check_all_platforms() -> Dict:
    """
    Run health checks for all configured platforms.
    """
    start_time = time.time()
    
    results = {
        'healthy': 0,
        'degraded': 0,
        'down': 0,
        'error': 0
    }
    
    for platform in PLATFORMS:
        try:
            # Get platform ID
            platform_response = supabase.table('platforms')\
                .select('id')\
                .eq('slug', platform['slug'])\
                .single()\
                .execute()
            
            if not platform_response.data:
                logger.error(f"✗ Platform {platform['slug']} not found in database")
                continue
            
            platform_id = platform_response.data['id']
            
            # Perform health check
            health_data = check_platform_health(platform)
            
            # Update results counter
            status = health_data['overall_status']
            if status in results:
                results[status] += 1
            
            # Save to database
            save_health_check(platform_id, health_data)
            
            # Check for new outage
            if status == 'down':
                if detect_outage(platform_id, status):
                    create_outage_alert(platform_id, health_data)
        
        except Exception as e:
            logger.error(f"✗ Error checking {platform['slug']}: {e}")
            results['error'] += 1
        
        # Small delay between checks
        time.sleep(1)
    
    elapsed = round(time.time() - start_time, 2)
    
    return {
        **results,
        'total_platforms': len(PLATFORMS),
        'elapsed_seconds': elapsed
    }


def calculate_uptime_percentage(platform_id: str, hours: int = 24) -> float:
    """
    Calculate uptime percentage for the last N hours.
    """
    try:
        from_time = datetime.now(timezone.utc).timestamp() - (hours * 3600)
        
        checks = supabase.table('platform_health_checks')\
            .select('status')\
            .eq('platform_id', platform_id)\
            .gte('checked_at', datetime.fromtimestamp(from_time, tz=timezone.utc).isoformat())\
            .execute()
        
        if not checks.data:
            return 100.0
        
        healthy_count = sum(1 for c in checks.data if c['status'] in ['healthy', 'degraded'])
        total_count = len(checks.data)
        
        return round((healthy_count / total_count) * 100, 2)
    
    except Exception as e:
        logger.error(f"Error calculating uptime: {e}")
        return 0.0


def run_health_monitor():
    """
    Main monitoring loop - runs every 5 minutes.
    """
    logger.info("🚀 Starting SweepBot Platform Health Monitor")
    logger.info(f"📊 Monitoring {len(PLATFORMS)} platforms")
    logger.info(f"⏰ Check interval: {CHECK_INTERVAL_SECONDS} seconds")
    
    iteration = 0
    
    while True:
        try:
            iteration += 1
            logger.info(f"\n{'='*60}")
            logger.info(f"Health Check #{iteration} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"{'='*60}")
            
            results = check_all_platforms()
            
            logger.info(f"\n📈 Check #{iteration} Summary:")
            logger.info(f"   Healthy: {results['healthy']}")
            logger.info(f"   Degraded: {results['degraded']}")
            logger.info(f"   Down: {results['down']}")
            logger.info(f"   Errors: {results['error']}")
            logger.info(f"   Time elapsed: {results['elapsed_seconds']}s")
            
            # Sleep until next check
            sleep_time = max(0, CHECK_INTERVAL_SECONDS - results['elapsed_seconds'])
            if sleep_time > 0:
                logger.info(f"😴 Sleeping for {sleep_time:.0f} seconds...")
                time.sleep(sleep_time)
        
        except KeyboardInterrupt:
            logger.info("\n👋 Monitor stopped by user")
            break
        
        except Exception as e:
            logger.error(f"✗ Unexpected error in monitoring loop: {e}")
            logger.info("⏳ Waiting 60 seconds before retry...")
            time.sleep(60)


if __name__ == '__main__':
    run_health_monitor()
