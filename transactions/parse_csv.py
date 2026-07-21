import csv
import json
import yfinance as yf
from datetime import datetime
import uuid

def parse_transactions(csv_path):
    transactions = []
    state_bonds = []
    failed_imports = set()
    
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['category'] != 'TRADING' or row['type'] not in ['BUY', 'SELL']:
                continue
                
            # Filter for State Bonds (using asset_class BOND)
            if row['asset_class'] == 'BOND':
                state_bonds.append(row)
                continue
                
            symbol = row['symbol']
            
            # Check yfinance
            try:
                ticker_data = yf.Ticker(symbol)
                hist = ticker_data.history(period='1d')
                if hist.empty:
                    failed_imports.add(symbol)
                    continue
            except Exception as e:
                failed_imports.add(symbol)
                continue
                
            transactions.append({
                'id': row['transaction_id'] or str(uuid.uuid4()),
                'ticker': symbol,
                'name': row['name'],
                'date': row['date'],
                'quantity': float(row['shares']) if row['shares'] else 0.0,
                'price': float(row['price']) if row['price'] else 0.0,
                'type': row['type']
            })
            
    # Save parsed equity/funds transactions
    with open('parsed_transactions.json', 'w') as f:
        json.dump(transactions, f, indent=2)
        
    # Save state bonds separately
    with open('state_bonds.json', 'w') as f:
        json.dump(state_bonds, f, indent=2)
        
    # Write failed imports
    with open('failed_imports.txt', 'w') as f:
        for imp in failed_imports:
            f.write(imp + '\n')
            
    print(f"Successfully parsed {len(transactions)} transactions.")
    print(f"Saved {len(state_bonds)} state bonds separately.")
    if failed_imports:
        print(f"Failed to import {len(failed_imports)} tickers. They have been saved to failed_imports.txt:")
        for imp in failed_imports:
            print(f"- {imp}")
    else:
        print("No failed imports.")

if __name__ == '__main__':
    parse_transactions('Transaction export.csv')