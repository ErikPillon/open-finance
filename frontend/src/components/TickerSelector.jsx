import React from 'react';
import { Layers, Check } from 'lucide-react';
import './TickerSelector.css';

/**
 * TickerSelector Component
 * Allows user to view all tracked tickers and select multiple tickers for chart comparison.
 */
export default function TickerSelector({
  tickers,
  selectedTickers,
  onToggleTicker,
  loading,
  tickerColors
}) {
  return (
    <div className="ticker-selector-panel panel glass">
      <div className="panel-header">
        <h2 className="panel-title">
          <Layers size={16} className="title-icon" />
          <span>Tracked Assets</span>
        </h2>
        <span className="ticker-count-badge">
          {selectedTickers.length} active
        </span>
      </div>

      <p className="panel-desc">
        Select one or more assets below to dynamically overlay and analyze their historical curves.
      </p>

      {loading && tickers.length === 0 ? (
        <div className="selector-loading-skeleton">
          <div className="skeleton-item" />
          <div className="skeleton-item" />
          <div className="skeleton-item" />
        </div>
      ) : (
        <div className="ticker-list">
          {tickers.map((ticker) => {
            const isSelected = selectedTickers.includes(ticker);
            const color = tickerColors[ticker] || '#10b981';
            
            return (
              <button
                key={ticker}
                onClick={() => onToggleTicker(ticker)}
                className={`ticker-item-btn ${isSelected ? 'selected' : ''}`}
                style={{
                  '--ticker-accent-color': color,
                  '--ticker-bg-color': isSelected ? `${color}12` : 'transparent',
                  '--ticker-border-color': isSelected ? `${color}40` : 'var(--border-color)'
                }}
              >
                <div className="ticker-item-left">
                  <div className="ticker-color-dot" style={{ backgroundColor: color }} />
                  <span className="ticker-symbol">{ticker}</span>
                </div>
                <div className="ticker-item-right">
                  {isSelected && <Check size={14} className="check-icon" style={{ color: color }} />}
                </div>
              </button>
            );
          })}
          
          {tickers.length === 0 && (
            <div className="empty-tickers-message">
              No assets tracked yet. Add one below to get started!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
