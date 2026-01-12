import os
import math
import numpy as np
import yfinance as yf
from scipy.stats import norm, percentileofscore
from dotenv import load_dotenv
from supabase import create_client
from datetime import datetime

# 1. SETUP & CONNECTION
# Looks for .env.local in the root directory
load_dotenv(dotenv_path=".env.local")

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    raise ValueError("Missing Supabase credentials. Check your .env.local file.")

supabase = create_client(url, key)

# 2. HELPER FUNCTIONS
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

# 3. MAIN ENGINE
def process_entire_watchlist():
    # Fetch tickers from your 'watchlist' table
    watchlist_res = supabase.table("watchlist").select("id, ticker").execute()
    tickers = watchlist_res.data
    all_results = []

    for item in tickers:
        ticker_sym = item['ticker']
        ticker_id = item['id']
        
        try:
            print(f"Processing {ticker_sym}...")
            stock_obj = yf.Ticker(ticker_sym)
            
            # Use fast_info or history to get latest price
            history = stock_obj.history(period="1d")
            if history.empty:
                print(f"Skipping {ticker_sym}: No price data found.")
                continue
            spot = history['Close'].iloc[-1]
            
            expirations = stock_obj.options[:10] # Process next 10 expiries
            total_gex = 0
            strike_map = {}

            for date in expirations:
                # Skip expired or same-day expirations (T must be > 0)
                T = (datetime.strptime(date, "%Y-%m-%d") - datetime.now()).days / 365.0
                if T <= 0:
                    continue
                    
                r = 0.04 # Risk-free rate (Approx 4%)

                chain = stock_obj.option_chain(date)

                # Process Calls
                for _, row in chain.calls.iterrows():
                    # Check for NaN IV before math
                    if pd_isna(row.impliedVolatility) or row.impliedVolatility <= 0:
                        continue
                    
                    call_count += 1
                    gamma = calculate_gamma(spot, row.strike, T, r, row.impliedVolatility)
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
                    exposure = -1 * (gamma * row.openInterest * 100 * (spot**2) * 0.01)
                    if not math.isnan(exposure) and not math.isinf(exposure):
                        total_gex -= exposure # Subtracting negative put exposure
                        strike_map[row.strike] = strike_map.get(row.strike, 0) + exposure

            # 4. Find Gamma Flip Price (closest to spot)
            sorted_strikes = sorted(strike_map.keys())
            flip_price = spot
            
            # Debug: print gamma around current price
            relevant_strikes = [s for s in sorted_strikes if spot * 0.95 <= s <= spot * 1.05]
            print(f"  Strikes around spot ({spot:.2f}):")
            for s in relevant_strikes[-5:]:
                print(f"    Strike {s}: GEX = {strike_map[s]:.2f}")
            
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
            
            all_results.append({
                "summary": {
                    "ticker_id": ticker_id,
                    "total_gex": float(total_gex),
                    "flip_price": float(flip_price),
                    "percentile": get_historical_percentile(ticker_id, total_gex),
                    "date": today_str
                },
                "price": {
                    "ticker_id": ticker_id,
                    "price": float(spot),
                    "date": today_str
                },
                "strikes": []
            })
            
            # Build and deduplicate strikes
            strikes_raw = [
                {
                    "ticker_id": ticker_id, 
                    "strike": int(s), 
                    "net_gex": float(0 if (math.isnan(g) or g is None) else g), 
                    "date": today_str
                } 
                for s, g in strike_map.items() 
                if spot * 0.85 <= s <= spot * 1.15 # Filter +/- 15% range
            ]
            
            # Deduplicate by summing net_gex for same strike
            strikes_dict = {}
            for strike_record in strikes_raw:
                strike_key = strike_record["strike"]
                if strike_key not in strikes_dict:
                    strikes_dict[strike_key] = strike_record
                else:
                    strikes_dict[strike_key]["net_gex"] += strike_record["net_gex"]
            
            all_results[-1]["strikes"] = list(strikes_dict.values())

        except Exception as e:
            print(f"Error processing {ticker_sym}: {e}")

    return all_results

def pd_isna(val):
    """Checks if a value is NaN using numpy/math."""
    return val is None or (isinstance(val, float) and math.isnan(val))

def save_to_supabase(all_ticker_data):
    """Cleans and pushes data to Supabase."""
    for data in all_ticker_data:
        try:
            # SANITIZE for JSON (Remove NaN/Inf)
            summary_clean = clean_nan(data["summary"])
            price_clean = clean_nan(data["price"])
            strikes_clean = clean_nan(data["strikes"])
            
            ticker_id = data["summary"]["ticker_id"]
            today_str = data["summary"]["date"]

            # Delete existing data for today to allow updates
            try:
                supabase.table("summaries").delete().eq("ticker_id", ticker_id).eq("date", today_str).execute()
            except:
                pass
            try:
                supabase.table("prices").delete().eq("ticker_id", ticker_id).eq("date", today_str).execute()
            except:
                pass
            try:
                supabase.table("details").delete().eq("ticker_id", ticker_id).eq("date", today_str).execute()
            except:
                pass

            # 1. Insert Summary (with upsert)
            supabase.table("summaries").upsert(summary_clean, ignore_duplicates=False).execute()
            
            # 2. Insert Price (with upsert)
            supabase.table("prices").upsert(price_clean, ignore_duplicates=False).execute()
            
            # 3. Batch Insert Strikes (with upsert)
            if strikes_clean:
                # Supabase handles list of dicts as bulk upsert
                supabase.table("details").upsert(strikes_clean, ignore_duplicates=False).execute()
            
            print(f"✅ Data saved for ticker_id: {data['summary']['ticker_id']}")
        except Exception as e:
            print(f"❌ Database error: {e}")

# 4. EXECUTION
if __name__ == "__main__":
    results = process_entire_watchlist()
    if results:
        save_to_supabase(results)
    else:
        print("No results to save.")