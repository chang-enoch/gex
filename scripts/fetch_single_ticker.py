import os
import sys
import math
import numpy as np
import yfinance as yf
from scipy.stats import norm, percentileofscore
from dotenv import load_dotenv
from supabase import create_client
from datetime import datetime

# Load environment
load_dotenv(dotenv_path=".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    raise ValueError("Missing Supabase credentials. Check your .env.local file.")

supabase = create_client(url, key)

# Get ticker from command line
if len(sys.argv) < 2:
    raise ValueError("No ticker provided")

ticker_sym = sys.argv[1]

def clean_nan(data):
    """Recursively converts NaN and Infinity to None for JSON compliance."""
    if isinstance(data, dict):
        return {k: clean_nan(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_nan(v) for v in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
    return data

def calculate_gamma(S, K, T, r, sigma):
    """Black-Scholes Gamma calculation."""
    if T <= 0 or sigma <= 0 or S <= 0:
        return 0
    try:
        d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
        gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
        return gamma
    except:
        return 0

def pd_isna(val):
    """Checks if a value is NaN using numpy/math."""
    return val is None or (isinstance(val, float) and math.isnan(val))

def get_historical_percentile(ticker_id, current_gex):
    """Fetches historical total_gex to calculate where today stands (0-100)."""
    try:
        res = supabase.table("summaries").select("total_gex").eq("ticker_id", ticker_id).execute()
        historical_values = [float(row['total_gex']) for row in res.data if row['total_gex'] is not None]
        
        if not historical_values:
            return 50  # Default to midpoint if first time running
        
        return int(percentileofscore(historical_values, current_gex))
    except Exception as e:
        print(f"Error calculating percentile: {e}")
        return 50

# Get ticker ID from watchlist
watchlist_res = supabase.table("watchlist").select("id").eq("ticker", ticker_sym).execute()
if not watchlist_res.data:
    print(f"Ticker {ticker_sym} not in watchlist")
    sys.exit(1)

ticker_id = watchlist_res.data[0]['id']

try:
    print(f"Processing {ticker_sym}...")
    stock_obj = yf.Ticker(ticker_sym)
    
    # Use fast_info or history to get latest price
    history = stock_obj.history(period="1d")
    if history.empty:
        print(f"Skipping {ticker_sym}: No price data found.")
        sys.exit(1)
    
    spot = history['Close'].iloc[-1]
    
    expirations = stock_obj.options[:10]  # Process next 10 expiries
    total_gex = 0
    strike_map = {}
    call_count = 0
    put_count = 0

    for date in expirations:
        # Skip expired or same-day expirations (T must be > 0)
        T = (datetime.strptime(date, "%Y-%m-%d") - datetime.now()).days / 365.0
        if T <= 0:
            continue
            
        r = 0.04  # Risk-free rate (Approx 4%)

        chain = stock_obj.option_chain(date)
        
        # Process Calls
        for _, row in chain.calls.iterrows():
            # Check for NaN IV before math
            if pd_isna(row.impliedVolatility) or row.impliedVolatility <= 0:
                continue
            
            call_count += 1
            gamma = calculate_gamma(spot, row.strike, T, r, row.impliedVolatility)
            if math.isnan(gamma) or gamma <= 0:
                continue
            # GEX = Gamma * OpenInterest * 100 * Spot^2 * 0.01
            exposure = gamma * row.openInterest * 100 * (spot**2) * 0.01
            if not math.isnan(exposure) and not math.isinf(exposure):
                total_gex += exposure
                strike_map[row.strike] = strike_map.get(row.strike, 0) + exposure

        # Process Puts
        for _, row in chain.puts.iterrows():
            if pd_isna(row.impliedVolatility) or row.impliedVolatility <= 0:
                continue
            
            put_count += 1
            gamma = calculate_gamma(spot, row.strike, T, r, row.impliedVolatility)
            if math.isnan(gamma) or gamma <= 0:
                continue
            exposure = -1 * (gamma * row.openInterest * 100 * (spot**2) * 0.01)
            if not math.isnan(exposure) and not math.isinf(exposure):
                total_gex -= exposure  # Subtracting negative put exposure
                strike_map[row.strike] = strike_map.get(row.strike, 0) + exposure

    # 4. Find Gamma Flip Price (closest to spot)
    sorted_strikes = sorted(strike_map.keys())
    flip_price = spot
    
    # Find gamma flip closest to spot price
    min_distance = float('inf')
    for i in range(len(sorted_strikes)-1):
        if strike_map[sorted_strikes[i]] < 0 and strike_map[sorted_strikes[i+1]] > 0:
            # Calculate which strike is closer to spot
            candidate = sorted_strikes[i+1] if abs(sorted_strikes[i+1] - spot) < abs(sorted_strikes[i] - spot) else sorted_strikes[i]
            distance = abs(candidate - spot)
            if distance < min_distance:
                min_distance = distance
                flip_price = candidate

    # 5. Build Data Objects
    today_str = datetime.now().date().isoformat()
    
    # Ensure total_gex is a valid number (not NaN or None)
    if math.isnan(total_gex) or total_gex is None:
        total_gex = 0.0
    
    summary = {
        "ticker_id": ticker_id,
        "total_gex": float(total_gex),
        "flip_price": float(flip_price),
        "percentile": get_historical_percentile(ticker_id, total_gex),
        "date": today_str
    }
    
    price = {
        "ticker_id": ticker_id,
        "price": float(spot),
        "date": today_str
    }
    
    strikes = [
        {
            "ticker_id": ticker_id, 
            "strike": int(s), 
            "net_gex": float(0 if (math.isnan(g) or g is None) else g), 
            "date": today_str
        } 
        for s, g in strike_map.items() 
        if spot * 0.85 <= s <= spot * 1.15  # Filter +/- 15% range
    ]

    # Save to Supabase
    try:
        # SANITIZE for JSON (Remove NaN/Inf)
        summary_clean = clean_nan(summary)
        price_clean = clean_nan(price)
        strikes_clean = clean_nan(strikes)

        # 1. Insert Summary
        supabase.table("summaries").insert(summary_clean).execute()
        
        # 2. Insert Price
        supabase.table("prices").insert(price_clean).execute()
        
        # 3. Batch Insert Strikes
        if strikes_clean:
            supabase.table("details").insert(strikes_clean).execute()
        
        print(f"✅ Data saved for {ticker_sym}")
    except Exception as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)

except Exception as e:
    print(f"Error processing {ticker_sym}: {e}")
    sys.exit(1)
