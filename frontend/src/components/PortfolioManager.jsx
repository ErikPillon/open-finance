import React, { useState, useMemo, useEffect } from 'react';
import { Briefcase, Plus, Trash2, Calendar, DollarSign, RefreshCw, ShoppingCart, TrendingUp } from 'lucide-react';
import './PortfolioManager.css';

/**
 * PortfolioManager Component
 * Allows users to log Buy/Sell transactions, persists them in LocalStorage,
 * and dynamically calculates cost basis, holdings, current value, and profit/loss.
 */
export default function PortfolioManager({ trackedTickers, telemetryData, apiBase, onTrackNewTicker }) {
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('litefi_portfolio_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  // Form State
  const [ticker, setTicker] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('BUY'); // BUY or SELL
  const [formError, setFormError] = useState('');

  // Persist transactions
  useEffect(() => {
    localStorage.setItem('litefi_portfolio_transactions', JSON.stringify(transactions));
  }, [transactions]);

  // Extract latest prices from telemetry data
  const latestPrices = useMemo(() => {
    const prices = {};
    if (!telemetryData || telemetryData.length === 0) return prices;

    // Group by ticker and find the latest timestamped record
    const grouped = {};
    telemetryData.forEach(item => {
      if (!grouped[item.ticker]) {
        grouped[item.ticker] = [];
      }
      grouped[item.ticker].push(item);
    });

    Object.keys(grouped).forEach(symbol => {
      const sorted = grouped[symbol].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      prices[symbol] = sorted[0].close;
    });

    return prices;
  }, [telemetryData]);

  // Dynamically calculate Holdings
  const holdings = useMemo(() => {
    const map = {};

    // Sort chronologically to properly account for buys and sells
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTx.forEach((tx) => {
      const sym = tx.ticker.toUpperCase();
      if (!map[sym]) {
        map[sym] = {
          ticker: sym,
          shares: 0,
          totalCost: 0, // Total buy cost remaining
          realizedPnL: 0,
          buyTransactions: []
        };
      }

      const holding = map[sym];
      const qty = parseFloat(tx.quantity);
      const prc = parseFloat(tx.price);

      if (tx.type === 'BUY') {
        holding.shares += qty;
        holding.totalCost += qty * prc;
        holding.buyTransactions.push({ qty, prc });
      } else {
        // Sell transaction
        holding.shares -= qty;
        // Adjust cost basis and realize gain/loss
        const avgBuyPrice = holding.shares + qty > 0 ? (holding.totalCost / (holding.shares + qty)) : 0;
        holding.totalCost -= qty * avgBuyPrice;
        holding.realizedPnL += qty * (prc - avgBuyPrice);
      }
    });

    // Clean up empty/dust holdings and attach real-time market stats
    return Object.values(map)
      .map((holding) => {
        if (holding.shares <= 0) return null;

        const currentPrice = latestPrices[holding.ticker] || null;
        const avgPrice = holding.shares > 0 ? (holding.totalCost / holding.shares) : 0;
        const currentValue = currentPrice ? holding.shares * currentPrice : holding.totalCost;
        const totalCostBasis = holding.shares * avgPrice;
        const pnl = currentPrice ? currentValue - totalCostBasis : 0;
        const pnlPercent = totalCostBasis > 0 ? (pnl / totalCostBasis) * 100 : 0;

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
  }, [transactions, latestPrices]);

  // Global Portfolio Performance Stats
  const portfolioSummary = useMemo(() => {
    let totalCostBasis = 0;
    let totalCurrentValue = 0;

    holdings.forEach((h) => {
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

  // Form submission handler
  const handleAddTransaction = (e) => {
    e.preventDefault();
    setFormError('');

    const formattedTicker = ticker.trim().toUpperCase();
    const parsedQty = parseFloat(quantity);
    const parsedPrice = parseFloat(price);

    if (!formattedTicker) {
      setFormError('Please provide a ticker.');
      return;
    }
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setFormError('Quantity must be a positive number.');
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setFormError('Price must be a positive number.');
      return;
    }
    if (!date) {
      setFormError('Please select a transaction date.');
      return;
    }

    // Check for short selling bounds (cannot sell more than holding shares)
    if (type === 'SELL') {
      const existingHolding = holdings.find(h => h.ticker === formattedTicker);
      const currentShares = existingHolding ? existingHolding.shares : 0;
      if (parsedQty > currentShares) {
        setFormError(`Insufficient shares. You only own ${currentShares} of ${formattedTicker}.`);
        return;
      }
    }

    const newTx = {
      id: Date.now().toString(),
      ticker: formattedTicker,
      date,
      quantity: parsedQty,
      price: parsedPrice,
      type
    };

    setTransactions((prev) => [newTx, ...prev]);
    
    // Auto trigger ingestion if the ticker is brand new to the system
    if (!trackedTickers.includes(formattedTicker)) {
      onTrackNewTicker(formattedTicker);
    }

    // Reset inputs
    setTicker('');
    setQuantity('');
    setPrice('');
    setType('BUY');
  };

  // Delete transaction
  const handleDeleteTransaction = (id) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  return (
    <div className="portfolio-manager-container animate-fade-in">
      {/* 1. Portfolio Performance Panel */}
      <div className="portfolio-summary-row">
        <div className="summary-card glass">
          <span className="summary-card-label">Net Portfolio Value</span>
          <h2 className="summary-card-val font-mono">
            ${portfolioSummary.totalCurrentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span className="summary-card-desc">Real-time asset balance</span>
        </div>

        <div className="summary-card glass">
          <span className="summary-card-label">Total Cost Basis</span>
          <h2 className="summary-card-val font-mono">
            ${portfolioSummary.totalCostBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span className="summary-card-desc">Aggregate invested capital</span>
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

      <div className="portfolio-main-grid">
        {/* 2. Interactive Google Finance Transaction Entry Form */}
        <div className="portfolio-form-panel panel glass">
          <div className="panel-header">
            <h3 className="panel-title">
              <Plus size={16} className="title-icon-primary" />
              <span>Log Transaction</span>
            </h3>
          </div>
          <p className="panel-desc">
            Manually append buys and sells. Custom tickers are auto-ingested into the QuestDB background backfiller.
          </p>

          <form onSubmit={handleAddTransaction} className="portfolio-form">
            <div className="form-row-type">
              <button
                type="button"
                className={`type-btn btn-buy ${type === 'BUY' ? 'active' : ''}`}
                onClick={() => setType('BUY')}
              >
                Buy (Long)
              </button>
              <button
                type="button"
                className={`type-btn btn-sell ${type === 'SELL' ? 'active' : ''}`}
                onClick={() => setType('SELL')}
              >
                Sell (Short)
              </button>
            </div>

            <div className="form-group">
              <label>Asset Ticker</label>
              <input
                type="text"
                placeholder="e.g. AAPL, TSLA"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="form-input"
                list="tracked-symbols"
                required
              />
              <datalist id="tracked-symbols">
                {trackedTickers.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>

            <div className="form-grid-two">
              <div className="form-group">
                <label>Shares (Quantity)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label>Price ($ USD)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Transaction Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="form-input"
                required
              />
            </div>

            {formError && <div className="form-error-alert">{formError}</div>}

            <button type="submit" className="form-submit-btn">
              Add to Portfolio
            </button>
          </form>
        </div>

        {/* 3. holdings Table */}
        <div className="holdings-panel panel glass">
          <div className="panel-header">
            <h3 className="panel-title">
              <Briefcase size={16} className="title-icon-primary" />
              <span>Current Holdings</span>
            </h3>
          </div>

          <div className="table-viewport">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="align-right">Qty Owned</th>
                  <th className="align-right">Avg Buy Price</th>
                  <th className="align-right">Last Price</th>
                  <th className="align-right">Market Value</th>
                  <th className="align-right text-right-pnl">Total Returns</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const isPos = h.pnl >= 0;
                  return (
                    <tr key={h.ticker} className="table-row">
                      <td>
                        <div className="table-ticker-cell">
                          <span className="ticker-color-box" style={{ backgroundColor: h.color }} />
                          <span className="ticker-label font-mono">{h.ticker}</span>
                        </div>
                      </td>
                      <td className="align-right font-mono">{h.shares.toLocaleString()}</td>
                      <td className="align-right font-mono">${h.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="align-right font-mono text-muted">
                        {h.currentPrice ? `$${h.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Syncing...'}
                      </td>
                      <td className="align-right font-mono">${h.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className={`align-right font-mono ${isPos ? 'positive' : 'negative'}`}>
                        <div className="table-pnl-cell">
                          <span>{isPos ? '+' : ''}${h.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="table-pnl-pct">({h.pnlPercent.toFixed(2)}%)</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {holdings.length === 0 && (
                  <tr>
                    <td colSpan="6" className="table-empty-row">
                      No active assets. Log a buy transaction on the left to initialize holdings.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Ledger logs (Google Finance Style) */}
      <div className="ledger-panel panel glass">
        <div className="panel-header">
          <h3 className="panel-title">
            <Calendar size={16} className="title-icon-primary" />
            <span>Transaction Registry Logs</span>
          </h3>
          <span className="ticker-count-badge font-mono">{transactions.length} records</span>
        </div>

        <div className="table-viewport">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th>Action</th>
                <th className="align-right">Quantity</th>
                <th className="align-right">Execution Price</th>
                <th className="align-right">Total Net Cash</th>
                <th className="align-center">Discard</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const total = parseFloat(tx.quantity) * parseFloat(tx.price);
                return (
                  <tr key={tx.id} className="ledger-row">
                    <td className="font-mono text-muted">{tx.date}</td>
                    <td className="font-mono font-bold">{tx.ticker}</td>
                    <td>
                      <span className={`ledger-type-badge ${tx.type === 'BUY' ? 'type-buy' : 'type-sell'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="align-right font-mono">{tx.quantity}</td>
                    <td className="align-right font-mono">${parseFloat(tx.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="align-right font-mono">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="align-center">
                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        className="ledger-delete-btn"
                        title="Delete record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {transactions.length === 0 && (
                <tr>
                  <td colSpan="7" className="table-empty-row">
                    The transaction registry ledger is currently empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
