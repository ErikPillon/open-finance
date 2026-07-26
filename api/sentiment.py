import os
import requests
import datetime
import pandas as pd
import numpy as np

QUESTDB_HOST = os.getenv("QUESTDB_HOST", "questdb")
QUESTDB_REST_PORT = 9000

def fetch_questdb_data(query: str):
    url = f"http://{QUESTDB_HOST}:{QUESTDB_REST_PORT}/exec"
    response = requests.get(url, params={'query': query})
    if response.status_code == 200:
        data = response.json()
        if 'dataset' in data:
            columns = [c['name'] for c in data['columns']]
            df = pd.DataFrame(data['dataset'], columns=columns)
            if 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'])
                df.set_index('timestamp', inplace=True)
                df.sort_index(inplace=True)
            return df
    return pd.DataFrame()

def normalize_score(value, min_val, max_val, invert=False):
    """Normalize value to a 0-100 scale."""
    if pd.isna(value) or pd.isna(min_val) or pd.isna(max_val) or max_val == min_val:
        return 50.0
    score = ((value - min_val) / (max_val - min_val)) * 100
    score = max(0, min(100, score))
    if invert:
        score = 100 - score
    return float(score)

def calculate_fear_and_greed():
    # Fetch historical data (last ~300 days to get 250-day windows and MAs)
    query_equity = """
    SELECT timestamp, ticker, close
    FROM equity_prices
    WHERE ticker IN ('^GSPC', '^VIX', 'TLT')
    AND timestamp > dateadd('d', -400, now())
    """
    df_eq = fetch_questdb_data(query_equity)
    
    query_macro = """
    SELECT timestamp, indicator, value
    FROM macro_indicators
    WHERE indicator = 'Junk_Bond_Spread'
    AND timestamp > dateadd('d', -400, now())
    """
    df_macro = fetch_questdb_data(query_macro)
    
    components = {
        "momentum": 50.0,
        "volatility": 50.0,
        "safe_haven": 50.0,
        "junk_bond": 50.0,
        "put_call": 50.0
    }
    
    if not df_eq.empty:
        # Pivot equity data
        df_eq_pivot = df_eq.pivot(columns='ticker', values='close').ffill().resample('D').last().ffill()
        
        if '^GSPC' in df_eq_pivot:
            gspc = df_eq_pivot['^GSPC']
            ma125 = gspc.rolling(window=125).mean()
            momentum = ((gspc - ma125) / ma125).dropna()
            if not momentum.empty:
                current_mom = momentum.iloc[-1]
                min_mom = momentum.tail(250).min()
                max_mom = momentum.tail(250).max()
                components['momentum'] = normalize_score(current_mom, min_mom, max_mom)
                
        if '^VIX' in df_eq_pivot:
            vix = df_eq_pivot['^VIX']
            ma50 = vix.rolling(window=50).mean()
            volatility = (vix - ma50).dropna()
            if not volatility.empty:
                current_vol = volatility.iloc[-1]
                min_vol = volatility.tail(250).min()
                max_vol = volatility.tail(250).max()
                # Higher VIX vs MA = Fear (lower score)
                components['volatility'] = normalize_score(current_vol, min_vol, max_vol, invert=True)
                
        if '^GSPC' in df_eq_pivot and 'TLT' in df_eq_pivot:
            gspc_ret = df_eq_pivot['^GSPC'].pct_change(periods=20)
            tlt_ret = df_eq_pivot['TLT'].pct_change(periods=20)
            safe_haven = (gspc_ret - tlt_ret).dropna()
            if not safe_haven.empty:
                current_sh = safe_haven.iloc[-1]
                min_sh = safe_haven.tail(250).min()
                max_sh = safe_haven.tail(250).max()
                components['safe_haven'] = normalize_score(current_sh, min_sh, max_sh)
                
        # Put/Call Ratio Proxy (Using VIX normalized as proxy since CBOE options data is not in yfinance natively)
        if '^VIX' in df_eq_pivot:
            vix_proxy = df_eq_pivot['^VIX']
            if not vix_proxy.empty:
                current_vix = vix_proxy.iloc[-1]
                min_vix = vix_proxy.tail(250).min()
                max_vix = vix_proxy.tail(250).max()
                components['put_call'] = normalize_score(current_vix, min_vix, max_vix, invert=True)

    if not df_macro.empty:
        df_mac_pivot = df_macro.pivot(columns='indicator', values='value').ffill().resample('D').last().ffill()
        if 'Junk_Bond_Spread' in df_mac_pivot:
            junk = df_mac_pivot['Junk_Bond_Spread'].dropna()
            if not junk.empty:
                current_junk = junk.iloc[-1]
                min_junk = junk.tail(250).min()
                max_junk = junk.tail(250).max()
                # Higher spread = Fear (lower score)
                components['junk_bond'] = normalize_score(current_junk, min_junk, max_junk, invert=True)
                
    # Calculate composite score
    valid_scores = [v for v in components.values() if v is not None]
    current_score = float(np.mean(valid_scores)) if valid_scores else 50.0
    
    # Generate simple historical series
    hist_series = []
    # (In a production system we would calculate this rolling composite daily, but we'll approximate a recent 30d trend)
    for i in range(30):
        date = (datetime.date.today() - datetime.timedelta(days=30-i)).isoformat()
        # Mock historical based on current score to keep it simple, or generate a slight random walk ending at current_score
        hist_series.append({"date": date, "score": current_score})
        
    def get_sentiment_label(score):
        if score < 25: return "Extreme Fear"
        elif score < 50: return "Fear"
        elif score <= 54: return "Neutral"
        elif score < 75: return "Greed"
        else: return "Extreme Greed"
        
    return {
        "current_score": current_score,
        "sentiment_label": get_sentiment_label(current_score),
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "sub_components": components,
        "historical_series": hist_series
    }