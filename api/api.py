import os
import time
import json
import logging
import datetime
import requests
import yfinance as yf
import pandas as pd
from typing import List
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from questdb.ingress import Sender
from apscheduler.schedulers.background import BackgroundScheduler
import uvicorn

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

QUESTDB_HOST = os.getenv("QUESTDB_HOST", "localhost")
QUESTDB_ILP_PORT = 9009
QUESTDB_REST_PORT = 9000
TICKERS_FILE = "tickers.json"

app = FastAPI(title="LiteFi Data API", description="Microsecond time-series financial ingestion engine")

# Allow the local frontend to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE INITIALIZATION ---
def init_db_schema():
    """Automatically creates the required tables if they don't exist."""
    url = f"http://{QUESTDB_HOST}:{QUESTDB_REST_PORT}/exec"
    queries = [
        """
        CREATE TABLE IF NOT EXISTS equity_prices (
            ticker SYMBOL,
            open DOUBLE,
            high DOUBLE,
            low DOUBLE,
            close DOUBLE,
            volume LONG,
            timestamp TIMESTAMP
        ) TIMESTAMP(timestamp) PARTITION BY DAY WAL DEDUPLICATE UPSERT KEYS (ticker, timestamp);
        """
    ]
    for q in queries:
        max_retries = 15
        for attempt in range(max_retries):
            try:
                response = requests.get(url, params={'query': q}, timeout=10)
                if response.status_code == 200:
                    logger.info("Database schema validated.")
                    break
                else:
                    logger.error(f"Schema error: {response.text}")
                    break
            except requests.exceptions.RequestException as e:
                logger.warning(f"Waiting for QuestDB to start (attempt {attempt + 1}/{max_retries})...")
                time.sleep(2)
        else:
            logger.error("Failed to connect to QuestDB after multiple retries.")

# --- TICKER TRACKING ---
def load_tracked_tickers() -> List[str]:
    if not os.path.exists(TICKERS_FILE):
        default_tickers = ["SPY", "AAPL", "MSFT"]
        with open(TICKERS_FILE, 'w') as f:
            json.dump(default_tickers, f)
        return default_tickers
    with open(TICKERS_FILE, 'r') as f:
        return json.load(f)

def save_tracked_ticker(ticker: str):
    tickers = load_tracked_tickers()
    if ticker not in tickers:
        tickers.append(ticker)
        with open(TICKERS_FILE, 'w') as f:
            json.dump(tickers, f)

# --- INGESTION LOGIC ---
def get_latest_timestamp_db(ticker: str) -> datetime.date:
    url = f"http://{QUESTDB_HOST}:{QUESTDB_REST_PORT}/exec"
    query = f"SELECT max(timestamp) FROM equity_prices WHERE ticker = '{ticker}'"
    try:
        response = requests.get(url, params={'query': query}, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('dataset') and len(data['dataset']) > 0 and data['dataset'][0][0]:
                latest_ts = data['dataset'][0][0]
                return datetime.datetime.fromisoformat(latest_ts[:10]).date()
    except Exception as e:
        logger.error(f"Database check failed for {ticker}: {e}")
    return datetime.date(2023, 1, 1) # Lookback limit for new tickers

def execute_historical_backfill(ticker: str):
    start_date = get_latest_timestamp_db(ticker)
    today = datetime.date.today()
    
    if (today - start_date).days <= 1:
        logger.info(f"Ticker {ticker} is up to date.")
        return

    logger.info(f"Backfilling {ticker} from {start_date} to {today}")
    try:
        data = yf.download(ticker, start=start_date.strftime("%Y-%m-%d"), end=today.strftime("%Y-%m-%d"), interval="1d", progress=False)
        if data.empty: return

        with Sender.from_conf(f"tcp::addr={QUESTDB_HOST}:{QUESTDB_ILP_PORT};") as sender:
            for timestamp, row in data.dropna().iterrows():
                sender.row(
                    'equity_prices',
                    symbols={'ticker': ticker},
                    columns={
                        'open': float(row['Open'].iloc[0] if isinstance(row['Open'], pd.Series) else row['Open']),
                        'high': float(row['High'].iloc[0] if isinstance(row['High'], pd.Series) else row['High']),
                        'low': float(row['Low'].iloc[0] if isinstance(row['Low'], pd.Series) else row['Low']),
                        'close': float(row['Close'].iloc[0] if isinstance(row['Close'], pd.Series) else row['Close']),
                        'volume': int(row['Volume'].iloc[0] if isinstance(row['Volume'], pd.Series) else row['Volume'])
                    },
                    at=timestamp.to_pydatetime()
                )
            sender.flush()
        logger.info(f"Backfill complete for {ticker}.")
    except Exception as e:
        logger.error(f"Backfill failed for {ticker}: {e}")

def scheduled_batch_ingest():
    tickers = load_tracked_tickers()
    logger.info(f"Running scheduled ingest for: {tickers}")
    try:
        data = yf.download(tickers, period="2d", interval="1h", group_by="ticker", progress=False)
        with Sender.from_conf(f"tcp::addr={QUESTDB_HOST}:{QUESTDB_ILP_PORT};") as sender:
            for ticker in tickers:
                ticker_df = data[ticker].dropna() if len(tickers) > 1 else data.dropna()
                for timestamp, row in ticker_df.iterrows():
                    sender.row(
                        'equity_prices',
                        symbols={'ticker': ticker},
                        columns={
                            'open': float(row['Open']), 'high': float(row['High']),
                            'low': float(row['Low']), 'close': float(row['Close']),
                            'volume': int(row['Volume'])
                        },
                        at=timestamp.to_pydatetime()
                    )
            sender.flush()
    except Exception as e:
        logger.error(f"Scheduled ingestion error: {e}")

# --- API ENDPOINTS ---
@app.get("/api/tickers")
def get_tickers():
    return load_tracked_tickers()

@app.get("/api/data")
def get_financial_data(background_tasks: BackgroundTasks, tickers: str = Query(...), limit: int = 100, resolution: str = "1d"):
    # Accepts comma separated tickers e.g., ?tickers=AAPL,SPY
    ticker_list = [t.strip().upper() for t in tickers.split(',')]
    
    # Auto-track and backfill requested tickers not in DB
    tracked = load_tracked_tickers()
    for t in ticker_list:
        if t not in tracked:
            try:
                # Basic validation that it's a real ticker
                if not yf.Ticker(t).history(period="1d").empty:
                    save_tracked_ticker(t)
                    background_tasks.add_task(execute_historical_backfill, t)
            except Exception as e:
                logger.warning(f"Failed to auto-track {t}: {e}")

    ticker_filter = ",".join([f"'{t}'" for t in ticker_list])
    
    sample_clause = "SAMPLE BY 1d" if resolution == "1d" else "SAMPLE BY 1h"
    query = f"""
    SELECT timestamp, ticker, last(close) as close
    FROM equity_prices 
    WHERE ticker IN ({ticker_filter}) 
    {sample_clause} ALIGN TO CALENDAR LIMIT -{limit};
    """
    
    try:
        response = requests.get(f"http://{QUESTDB_HOST}:{QUESTDB_REST_PORT}/exec", params={'query': query})
        db_result = response.json()
        if 'error' in db_result:
            raise HTTPException(status_code=400, detail=db_result['error'])
        columns = [col['name'] for col in db_result.get('columns', [])]
        records = [dict(zip(columns, row)) for row in db_result.get('dataset', [])]
        return {"data": records}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/track")
def track_new_ticker(ticker: str, background_tasks: BackgroundTasks):
    ticker_upper = ticker.upper().strip()
    
    if ticker_upper in load_tracked_tickers():
        return {"status": "already_tracked"}
    
    try:
        if yf.Ticker(ticker_upper).history(period="1d").empty:
            raise ValueError()
    except:
        raise HTTPException(status_code=404, detail="Ticker not found.")
    
    save_tracked_ticker(ticker_upper)
    background_tasks.add_task(execute_historical_backfill, ticker_upper)
    return {"status": "accepted", "message": f"Backfilling {ticker_upper} in background."}

# --- LIFECYCLE ---
@app.on_event("startup")
def startup_event():
    # 1. Init Database Schema
    init_db_schema()
    
    # 2. Trigger initial backfill for existing tickers
    for t in load_tracked_tickers():
        execute_historical_backfill(t)

    # 3. Mount Scheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(scheduled_batch_ingest, 'cron', hour='*', minute='0')
    scheduler.start()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)