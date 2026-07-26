#!/usr/bin/env python3
import os
import requests
from rich.console import Console
from rich.table import Table
import datetime
from dateutil import parser
from dateutil.tz import tzutc

QUESTDB_HOST = os.getenv("QUESTDB_HOST", "localhost")
QUESTDB_REST_PORT = 9000

console = Console()

def query_questdb(query):
    url = f"http://{QUESTDB_HOST}:{QUESTDB_REST_PORT}/exec"
    try:
        response = requests.get(url, params={'query': query})
        response.raise_for_status()
        data = response.json()
        if 'error' in data:
            console.print(f"[red]QuestDB Error: {data['error']}[/red]")
            return []
        return data.get('dataset', [])
    except Exception as e:
        console.print(f"[red]Error querying QuestDB: {e}[/red]")
        return []

def main():
    table = Table(title="LiteFi Data Ingestion Status", show_header=True, header_style="bold magenta")
    
    table.add_column("Ticker", style="cyan", no_wrap=True)
    table.add_column("Latest Data Timestamp", justify="center")
    table.add_column("Total Rows", justify="right", style="green")
    table.add_column("Last 1h", justify="right")
    table.add_column("Last 8h", justify="right")
    table.add_column("Last 24h", justify="right")
    table.add_column("Last 2d", justify="right")
    table.add_column("Last 7d", justify="right")

    # Aggregate counts of data points occurring within these time windows from 'now()'
    query = """
    SELECT 
        ticker, 
        max(timestamp), 
        count(),
        sum(cast(timestamp >= dateadd('h', -1, now()) as int)),
        sum(cast(timestamp >= dateadd('h', -8, now()) as int)),
        sum(cast(timestamp >= dateadd('h', -24, now()) as int)),
        sum(cast(timestamp >= dateadd('d', -2, now()) as int)),
        sum(cast(timestamp >= dateadd('d', -7, now()) as int))
    FROM equity_prices
    ORDER BY 2 DESC
    """
    
    dataset = query_questdb(query)
    
    now_utc = datetime.datetime.now(tzutc())
    
    for row in dataset:
        ticker = str(row[0])
        latest_ts_str = str(row[1]) if row[1] else ""
        
        # Color code the timestamp if it's stale
        if latest_ts_str:
            ts = parser.isoparse(latest_ts_str)
            age = now_utc - ts
            display_ts = latest_ts_str[:19].replace("T", " ")
            if age.days > 2:
                display_ts = f"[red]{display_ts}[/red]"
            elif age.days > 0:
                display_ts = f"[yellow]{display_ts}[/yellow]"
            else:
                display_ts = f"[green]{display_ts}[/green]"
        else:
            display_ts = "[red]N/A[/red]"

        total = f"{row[2]:,}" if row[2] is not None else "0"
        h1 = str(row[3] or 0)
        h8 = str(row[4] or 0)
        h24 = str(row[5] or 0)
        d2 = str(row[6] or 0)
        d7 = str(row[7] or 0)
        
        table.add_row(ticker, display_ts, total, h1, h8, h24, d2, d7)

    console.print(table)
    
    # FRED Macro Indicators Table
    macro_table = Table(title="FRED Macro Indicators Status", show_header=True, header_style="bold blue")
    
    macro_table.add_column("Indicator", style="cyan", no_wrap=True)
    macro_table.add_column("Latest Data Timestamp", justify="center")
    macro_table.add_column("Total Rows", justify="right", style="green")
    macro_table.add_column("Last 7d", justify="right")
    macro_table.add_column("Last 30d", justify="right")
    macro_table.add_column("Last 90d", justify="right")
    macro_table.add_column("Last 365d", justify="right")
    macro_table.add_column("Last 5y", justify="right")

    macro_query = """
    SELECT 
        indicator, 
        max(timestamp), 
        count(),
        sum(cast(timestamp >= dateadd('d', -7, now()) as int)),
        sum(cast(timestamp >= dateadd('d', -30, now()) as int)),
        sum(cast(timestamp >= dateadd('d', -90, now()) as int)),
        sum(cast(timestamp >= dateadd('d', -365, now()) as int)),
        sum(cast(timestamp >= dateadd('y', -5, now()) as int))
    FROM macro_indicators
    ORDER BY 2 DESC
    """
    
    macro_dataset = query_questdb(macro_query)
    
    for row in macro_dataset:
        indicator = str(row[0])
        latest_ts_str = str(row[1]) if row[1] else ""
        
        # Color code the timestamp if it's stale
        if latest_ts_str:
            ts = parser.isoparse(latest_ts_str)
            age = now_utc - ts
            display_ts = latest_ts_str[:10] # Just the date is fine for macro
            # Macro data can be delayed by a month or more
            if age.days > 60:
                display_ts = f"[red]{display_ts}[/red]"
            elif age.days > 30:
                display_ts = f"[yellow]{display_ts}[/yellow]"
            else:
                display_ts = f"[green]{display_ts}[/green]"
        else:
            display_ts = "[red]N/A[/red]"

        total = f"{row[2]:,}" if row[2] is not None else "0"
        d7 = str(row[3] or 0)
        d30 = str(row[4] or 0)
        d90 = str(row[5] or 0)
        d365 = str(row[6] or 0)
        y5 = str(row[7] or 0)
        
        macro_table.add_row(indicator, display_ts, total, d7, d30, d90, d365, y5)

    console.print("\n")
    console.print(macro_table)
    
    console.print("\n[dim]Note: 'Last X' counts rely on the absolute timestamps of the market data. Values of 0 are expected during weekends or after market close.[/dim]")

if __name__ == "__main__":
    main()