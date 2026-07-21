import React, { useState, useMemo, useEffect } from 'react';
import { Briefcase, Plus, Trash2, Calendar, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import initialTransactions from '../parsed_transactions.json';
import './PortfolioManager.css';

export default function PortfolioManager({ trackedTickers, telemetryData, apiBase, onTrackNewTicker }) {
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('litefi_portfolio_transactions');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) {
        // Map names from initial JSON to fix previously cached transactions missing the name
        const nameMap = {};
        (initialTransactions || []).forEach(t => {
          if (t.name && t.name !== t.ticker) {
            nameMap[t.ticker.toUpperCase()] = t.name;
          }
        });
        
        return parsed.map(tx => ({
          ...tx,
          name: tx.name && tx.name !== tx.ticker ? tx.name : (nameMap[tx.ticker.toUpperCase()] || tx.ticker)
        }));
      }
    }
    return initialTransactions || [];
  });

  // UI State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  // Main Form State
  const [ticker, setTicker] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('BUY'); // BUY or SELL
  const [formError, setFormError] = useState('');

  // Mini Form State (per expanded row)
  const [miniDate, setMiniDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [miniQty, setMiniQty] = useState('');
  const [miniPrice, setMiniPrice] = useState('');
  const [miniType, setMiniType] = useState('BUY');
  const [miniFormError, setMiniFormError] = useState('');

  // Persist transactions
  useEffect(() => {
    localStorage.setItem('litefi_portfolio_transactions', JSON.stringify(transactions));
  }, [transactions]);

  // Live Prices State
  const [livePrices, setLivePrices] = useState({});
  const [priceError, setPriceError] = useState('');

  const uniqueTickers = useMemo(() => {
    return Array.from(new Set(transactions.map(tx => tx.ticker.toUpperCase())));
  }, [transactions]);

  useEffect(() => {
    if (uniqueTickers.length === 0) return;
    let isMounted = true;
    const fetchPrices = async () => {
      try {
        setPriceError('');
        const res = await fetch(`${apiBase}/latest_prices?tickers=${uniqueTickers.join(',')}`);
        if (!res.ok) {
           throw new Error('Failed to fetch from API');
        }
        const data = await res.json();
        if (isMounted) setLivePrices(data);
      } catch (err) {
        console.error(err);
        if (isMounted) setPriceError('Unable to sync live market prices.');
      }
    };
    fetchPrices();
    
    const interval = setInterval(fetchPrices, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [uniqueTickers, apiBase]);

  // Dynamically calculate Holdings
  const holdings = useMemo(() => {
    const map = {};

    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTx.forEach((tx) => {
      const sym = tx.ticker.toUpperCase();
      if (!map[sym]) {
        map[sym] = {
          ticker: sym,
          name: tx.name || sym,
          shares: 0,
          totalCost: 0,
          realizedPnL: 0,
          history: [] // store all txs for this asset
        };
      }

      const holding = map[sym];
      const qty = parseFloat(tx.quantity);
      const prc = parseFloat(tx.price);

      // Save name if not present and available in tx
      if (tx.name && holding.name === sym) {
         holding.name = tx.name;
      }

      holding.history.push(tx);

      if (tx.type === 'BUY') {
        holding.shares += qty;
        holding.totalCost += qty * prc;
      } else {
        holding.shares -= qty;
        const avgBuyPrice = holding.shares + qty > 0 ? (holding.totalCost / (holding.shares + qty)) : 0;
        holding.totalCost -= qty * avgBuyPrice;
        holding.realizedPnL += qty * (prc - avgBuyPrice);
      }
    });

    return Object.values(map)
      .map((holding) => {
        if (holding.shares <= 0.00001 && holding.history.length === 0) return null;

        const currentPrice = livePrices[holding.ticker] || null;
        const avgPrice = holding.shares > 0.00001 ? (holding.totalCost / holding.shares) : 0;
        const currentValue = (holding.shares > 0.00001 && currentPrice) ? holding.shares * currentPrice : holding.totalCost;
        const totalCostBasis = holding.shares > 0.00001 ? holding.shares * avgPrice : 0;
        const pnl = currentPrice ? currentValue - totalCostBasis : 0;
        const pnlPercent = totalCostBasis > 0 ? (pnl / totalCostBasis) * 100 : 0;

        // Clean up floating point precision on shares
        holding.shares = Math.abs(holding.shares) < 0.00001 ? 0 : holding.shares;

        return {
          ...holding,
          avgPrice,
          currentPrice,
          currentValue,
          totalCostBasis,
          pnl,
          pnlPercent
        };
      })
      .filter(Boolean);
  }, [transactions, livePrices]);

  const activeHoldings = useMemo(() => holdings.filter(h => h.shares > 0), [holdings]);
  const closedHoldings = useMemo(() => holdings.filter(h => h.shares <= 0), [holdings]);

  const portfolioSummary = useMemo(() => {
    let totalCostBasis = 0;
    let totalCurrentValue = 0;

    activeHoldings.forEach((h) => {
      totalCostBasis += h.totalCostBasis;
      totalCurrentValue += h.currentValue;
    });

    const totalPnL = totalCurrentValue - totalCostBasis;
    const totalPnLPercent = totalCostBasis > 0 ? (totalPnL / totalCostBasis) * 100 : 0;

    return {
      totalCostBasis,
      totalCurrentValue,
      totalPnL,
      totalPnLPercent
    };
  }, [holdings]);

  // Main Form handler
  const handleAddTransaction = (e) => {
    e.preventDefault();
    setFormError('');

    const formattedTicker = ticker.trim().toUpperCase();
    const parsedQty = parseFloat(quantity);
    const parsedPrice = parseFloat(price);

    if (!formattedTicker) return setFormError('Please provide a ticker.');
    if (isNaN(parsedQty) || parsedQty <= 0) return setFormError('Quantity must be a positive number.');
    if (isNaN(parsedPrice) || parsedPrice <= 0) return setFormError('Price must be a positive number.');
    if (!date) return setFormError('Please select a transaction date.');

    if (type === 'SELL') {
      const existingHolding = holdings.find(h => h.ticker === formattedTicker);
      const currentShares = existingHolding ? existingHolding.shares : 0;
      if (parsedQty > currentShares) return setFormError(`Insufficient shares. You only own ${currentShares} of ${formattedTicker}.`);
    }

    const newTx = {
      id: Date.now().toString(),
      ticker: formattedTicker,
      name: formattedTicker, // Main form doesn't know the exact name initially unless fetched
      date,
      quantity: parsedQty,
      price: parsedPrice,
      type
    };

    setTransactions((prev) => [newTx, ...prev]);
    if (!trackedTickers.includes(formattedTicker)) {
      onTrackNewTicker(formattedTicker);
    }

    setTicker(''); setQuantity(''); setPrice(''); setType('BUY'); setIsFormOpen(false);
  };

  // Mini Form handler for expanded rows
  const handleAddMiniTransaction = (e, targetTicker, targetName) => {
    e.preventDefault();
    setMiniFormError('');

    const parsedQty = parseFloat(miniQty);
    const parsedPrice = parseFloat(miniPrice);

    if (isNaN(parsedQty) || parsedQty <= 0) return setMiniFormError('Quantity must be a positive number.');
    if (isNaN(parsedPrice) || parsedPrice <= 0) return setMiniFormError('Price must be a positive number.');
    if (!miniDate) return setMiniFormError('Please select a transaction date.');

    if (miniType === 'SELL') {
      const existingHolding = holdings.find(h => h.ticker === targetTicker);
      const currentShares = existingHolding ? existingHolding.shares : 0;
      if (parsedQty > currentShares) return setMiniFormError(`Insufficient shares.`);
    }

    const newTx = {
      id: Date.now().toString(),
      ticker: targetTicker,
      name: targetName,
      date: miniDate,
      quantity: parsedQty,
      price: parsedPrice,
      type: miniType
    };

    setTransactions((prev) => [newTx, ...prev]);
    setMiniQty(''); setMiniPrice(''); setMiniType('BUY');
  };

  const handleDeleteTransaction = (id) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  const toggleRow = (targetTicker) => {
    if (expandedRow === targetTicker) {
      setExpandedRow(null);
    } else {
      setExpandedRow(targetTicker);
      setMiniFormError('');
      setMiniQty('');
      setMiniPrice('');
      setMiniType('BUY');
    }
  };

  return (
    <div className="portfolio-manager-container animate-fade-in">
      {priceError && (
        <div className="form-error-alert" style={{ marginBottom: '1rem' }}>
          {priceError}
        </div>
      )}
      <div className="portfolio-summary-row">
        <div className="summary-card glass">
          <span className="summary-card-label">Net Portfolio Value</span>
          <h2 className="summary-card-val font-mono">
            ${portfolioSummary.totalCurrentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
        </div>
        <div className="summary-card glass">
          <span className="summary-card-label">Total Cost Basis</span>
          <h2 className="summary-card-val font-mono">
            ${portfolioSummary.totalCostBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
        </div>
        <div className="summary-card glass">
          <span className="summary-card-label">Unrealized Performance</span>
          <h2 className={`summary-card-val font-mono ${portfolioSummary.totalPnL >= 0 ? 'positive' : 'negative'}`}>
            {portfolioSummary.totalPnL >= 0 ? '+' : ''}
            ${portfolioSummary.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span className={`pnl-percent-badge ${portfolioSummary.totalPnL >= 0 ? 'pos' : 'neg'}`}>
            {portfolioSummary.totalPnLPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="portfolio-main-stack">
        
        {/* Disappearing Transaction Form */}
        <div className="portfolio-form-panel panel glass">
          <div 
            className="panel-header expandable-header" 
            onClick={() => setIsFormOpen(!isFormOpen)}
          >
            <h3 className="panel-title">
              <Plus size={16} className="title-icon-primary" />
              <span>Log New Generic Asset</span>
            </h3>
            <button className="expand-btn">
              {isFormOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
          
          {isFormOpen && (
            <div className="form-collapsible-content">
              <p className="panel-desc mt-2">
                Manually append buys and sells for new assets not yet in your holdings.
              </p>
              <form onSubmit={handleAddTransaction} className="portfolio-form">
                <div className="form-row-type">
                  <button type="button" className={`type-btn btn-buy ${type === 'BUY' ? 'active' : ''}`} onClick={() => setType('BUY')}>Buy (Long)</button>
                  <button type="button" className={`type-btn btn-sell ${type === 'SELL' ? 'active' : ''}`} onClick={() => setType('SELL')}>Sell (Short)</button>
                </div>
                <div className="form-group">
                  <label>Asset Ticker / ISIN</label>
                  <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value)} className="form-input" required />
                </div>
                <div className="form-grid-two">
                  <div className="form-group">
                    <label>Shares (Quantity)</label>
                    <input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label>Price ($ USD)</label>
                    <input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} className="form-input" required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Transaction Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" required />
                </div>
                {formError && <div className="form-error-alert">{formError}</div>}
                <button type="submit" className="form-submit-btn">Add to Portfolio</button>
              </form>
            </div>
          )}
        </div>

        {/* Holdings Table */}
        <div className="holdings-panel panel glass">
          <div className="panel-header">
            <h3 className="panel-title">
              <Briefcase size={16} className="title-icon-primary" />
              <span>Current Holdings & Ledger</span>
            </h3>
          </div>

          <div className="table-viewport">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>Symbol</th>
                  <th>Asset Name</th>
                  <th className="align-right">Qty Owned</th>
                  <th className="align-right">Avg Price</th>
                  <th className="align-right">Last Price</th>
                  <th className="align-right text-right-pnl">Total Returns</th>
                </tr>
              </thead>
              <tbody>
                {activeHoldings.map((h) => {
                  const isPos = h.pnl >= 0;
                  const isExpanded = expandedRow === h.ticker;
                  
                  return (
                    <React.Fragment key={h.ticker}>
                      <tr className={`table-row grouped-row ${isExpanded ? 'expanded' : ''}`} onClick={() => toggleRow(h.ticker)}>
                        <td className="w-10 chevron-cell">
                          {isExpanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                        </td>
                        <td>
                          <div className="table-ticker-cell">
                            <span className="ticker-label font-mono">{h.ticker}</span>
                          </div>
                        </td>
                        <td className="text-muted text-sm max-w-xs truncate" title={h.name}>{h.name}</td>
                        <td className="align-right font-mono">{h.shares.toLocaleString()}</td>
                        <td className="align-right font-mono">${h.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="align-right font-mono text-muted">
                          {h.currentPrice 
                            ? `$${h.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                            : priceError ? 'Fetch Failed' : 'Syncing...'}
                        </td>
                        <td className={`align-right font-mono ${isPos ? 'positive' : 'negative'}`}>
                          <div className="table-pnl-cell">
                            <span>{isPos ? '+' : ''}${h.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="table-pnl-pct">({h.pnlPercent.toFixed(2)}%)</span>
                          </div>
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="sub-table-row">
                          <td colSpan="7" className="p-0">
                            <div className="sub-table-container">
                              <h4 className="sub-title font-mono">Ledger: {h.name}</h4>
                              <table className="mini-ledger-table">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th className="align-right">Quantity</th>
                                    <th className="align-right">Price</th>
                                    <th className="align-right">Value</th>
                                    <th></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {h.history.sort((a,b) => new Date(b.date) - new Date(a.date)).map(tx => (
                                    <tr key={tx.id}>
                                      <td className="font-mono text-muted text-xs">{tx.date}</td>
                                      <td>
                                        <span className={`ledger-type-badge ${tx.type === 'BUY' ? 'type-buy' : 'type-sell'} text-xs`}>
                                          {tx.type}
                                        </span>
                                      </td>
                                      <td className="align-right font-mono text-xs">{tx.quantity}</td>
                                      <td className="align-right font-mono text-xs">${parseFloat(tx.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                      <td className="align-right font-mono text-xs">${(tx.quantity * tx.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                      <td className="align-center">
                                        <button onClick={() => handleDeleteTransaction(tx.id)} className="ledger-delete-btn"><Trash2 size={12} /></button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              <div className="mini-transaction-form mt-4">
                                <h4 className="sub-title mb-2">Register New Transaction</h4>
                                <form onSubmit={(e) => handleAddMiniTransaction(e, h.ticker, h.name)} className="mini-form">
                                  <select value={miniType} onChange={(e) => setMiniType(e.target.value)} className="mini-input">
                                    <option value="BUY">BUY</option>
                                    <option value="SELL">SELL</option>
                                  </select>
                                  <input type="number" step="any" placeholder="Qty" value={miniQty} onChange={(e) => setMiniQty(e.target.value)} className="mini-input" required />
                                  <input type="number" step="any" placeholder="Price $" value={miniPrice} onChange={(e) => setMiniPrice(e.target.value)} className="mini-input" required />
                                  <input type="date" value={miniDate} onChange={(e) => setMiniDate(e.target.value)} className="mini-input" required />
                                  <button type="submit" className="mini-submit-btn">Add</button>
                                </form>
                                {miniFormError && <div className="form-error-alert text-xs mt-2">{miniFormError}</div>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {activeHoldings.length === 0 && (
                  <tr>
                    <td colSpan="7" className="table-empty-row">
                      No active assets. Log a buy transaction above to initialize holdings.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Closed Positions */}
        {closedHoldings.length > 0 && (
          <div className="holdings-panel panel glass" style={{ marginTop: '1.5rem' }}>
            <div className="panel-header">
              <h3 className="panel-title">
                <Briefcase size={16} className="title-icon-primary" />
                <span>Closed Positions (Past Holdings)</span>
              </h3>
            </div>
            <div className="table-viewport">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Asset Name</th>
                    <th className="align-right">Qty Owned</th>
                    <th className="align-right text-right-pnl">Realized Gain/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {closedHoldings.map((h) => {
                    const isPos = h.realizedPnL >= 0;
                    return (
                      <tr key={h.ticker} className="table-row">
                        <td>
                          <div className="table-ticker-cell">
                            <span className="ticker-label font-mono">{h.ticker}</span>
                          </div>
                        </td>
                        <td className="text-muted text-sm max-w-xs truncate" title={h.name}>{h.name}</td>
                        <td className="align-right font-mono">0</td>
                        <td className={`align-right font-mono ${isPos ? 'positive' : 'negative'}`}>
                          <div className="table-pnl-cell">
                            <span>{isPos ? '+' : ''}${h.realizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
