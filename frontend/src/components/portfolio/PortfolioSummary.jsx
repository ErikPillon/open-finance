import React from 'react';

export default function PortfolioSummary({ summary }) {
  return (
    <div className="portfolio-summary-row">
      <div className="summary-card glass">
        <span className="summary-card-label">Net Portfolio Value</span>
        <h2 className="summary-card-val font-mono">
          ${summary.totalCurrentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h2>
      </div>
      <div className="summary-card glass">
        <span className="summary-card-label">Total Cost Basis</span>
        <h2 className="summary-card-val font-mono">
          ${summary.totalCostBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h2>
      </div>
      <div className="summary-card glass">
        <span className="summary-card-label">Unrealized Performance</span>
        <h2 className={`summary-card-val font-mono ${summary.totalPnL >= 0 ? 'positive' : 'negative'}`}>
          {summary.totalPnL >= 0 ? '+' : ''}
          ${summary.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h2>
        <span className={`pnl-percent-badge ${summary.totalPnL >= 0 ? 'pos' : 'neg'}`}>
          {summary.totalPnLPercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}