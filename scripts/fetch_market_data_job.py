#!/usr/bin/env python3
"""
Fetch and Upload Market Data Wrapper

This script runs the market data fetch at scheduled times (market close).
It includes error handling, logging, and health checks.
"""

import os
import sys
import logging
from datetime import datetime
from pathlib import Path

# Setup logging
log_dir = Path(__file__).parent.parent / "logs"
log_dir.mkdir(exist_ok=True)

log_file = log_dir / f"fetch_market_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def check_market_hours():
    """Check if market is currently open or if it's after-hours"""
    from datetime import datetime, time
    
    now = datetime.now()
    market_close = time(16, 0)  # 4 PM ET
    current_time = now.time()
    
    # Check if it's a weekday
    if now.weekday() >= 5:  # Saturday=5, Sunday=6
        logger.warning("Market closed: Today is a weekend")
        return False
    
    # Check if it's after market close (4 PM ET)
    if current_time < market_close:
        logger.warning(f"Market still open: Current time {current_time.strftime('%H:%M:%S')}, waiting for {market_close.strftime('%H:%M:%S')}")
        return False
    
    logger.info("Market has closed for the day")
    return True

def run_fetch_data():
    """Run the fetch_data.py script"""
    try:
        logger.info("=" * 60)
        logger.info("Starting market data fetch...")
        logger.info("=" * 60)
        
        # Import and run the fetch script
        script_path = Path(__file__).parent / "fetch_data.py"
        
        # Add scripts directory to path
        sys.path.insert(0, str(Path(__file__).parent))
        
        # Execute the script
        exec(open(script_path).read(), {"__name__": "__main__"})
        
        logger.info("=" * 60)
        logger.info("Market data fetch completed successfully")
        logger.info("=" * 60)
        return True
        
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"Error during fetch: {str(e)}")
        logger.error("=" * 60)
        logger.exception("Full traceback:")
        return False

def main():
    """Main entry point"""
    logger.info("Market Data Fetch Job Started")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    
    # Check environment
    if not os.getenv("NEXT_PUBLIC_SUPABASE_URL"):
        logger.error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable")
        sys.exit(1)
    
    if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        logger.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
        sys.exit(1)
    
    logger.info("Environment variables loaded successfully")
    
    # Run the fetch
    success = run_fetch_data()
    
    if not success:
        logger.error("Job failed")
        sys.exit(1)
    
    logger.info("Job completed successfully")
    sys.exit(0)

if __name__ == "__main__":
    main()
