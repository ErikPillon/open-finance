import React, { useState } from 'react';
import { Briefcase } from 'lucide-react';
import HoldingRow from './HoldingRow.jsx';

export default function ActiveHoldingsTable({ activeHoldings, priceError, onAddTransaction, onDeleteTransaction }) {
  const [expandedRow, setExpandedRow] = useState(null);

  const handleToggleRow = (ticker) => {
    setExpandedRow(expandedRow === ticker ? null : ticker);
  };

  return (
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
            {activeHoldings.map((h) => (
              <HoldingRow
                key={h.ticker}
                holding={h}
                isExpanded={expandedRow === h.ticker}
                onToggle={() => handleToggleRow(h.ticker)}
                priceError={priceError}
                onAddMiniTransaction={onAddTransaction}
                onDeleteTransaction={onDeleteTransaction}
              />
            ))}

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
  );
}