import React from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import PortfolioSummary from './portfolio/PortfolioSummary';
import TransactionForm from './portfolio/TransactionForm';
import ActiveHoldingsTable from './portfolio/ActiveHoldingsTable';
import ClosedPositionsTable from './portfolio/ClosedPositionsTable';
import './PortfolioManager.css';

export default function PortfolioManager({ trackedTickers, telemetryData, apiBase, onTrackNewTicker }) {
  const {
    activeHoldings,
    closedHoldings,
    portfolioSummary,
    priceError,
    handleAddTransaction,
    handleDeleteTransaction
  } = usePortfolio(apiBase, onTrackNewTicker, trackedTickers);

  return (
    <div className="portfolio-manager-container animate-fade-in">
      {priceError && (
        <div className="form-error-alert" style={{ marginBottom: '1rem' }}>
          {priceError}
        </div>
      )}
      
      <PortfolioSummary summary={portfolioSummary} />

      <div className="portfolio-main-stack">
        <TransactionForm 
          holdings={[...activeHoldings, ...closedHoldings]} 
          onAddTransaction={handleAddTransaction} 
        />

        <ActiveHoldingsTable 
          activeHoldings={activeHoldings}
          priceError={priceError}
          onAddTransaction={handleAddTransaction}
          onDeleteTransaction={handleDeleteTransaction}
        />

        <ClosedPositionsTable 
          closedHoldings={closedHoldings} 
        />
      </div>
    </div>
  );
}