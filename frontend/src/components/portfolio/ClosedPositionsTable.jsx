import React from 'react';
import { Briefcase } from 'lucide-react';

export default function ClosedPositionsTable({ closedHoldings }) {
  if (closedHoldings.length === 0) return null;

  return (
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
  );
}