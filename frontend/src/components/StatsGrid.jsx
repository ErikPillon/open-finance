import React, { useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, ChevronRight } from 'lucide-react';
import './StatsGrid.css';

/**
 * StatsGrid Component
 * Dynamically computes analytics (current price, % change, window max/min) from raw timeseries data.
 */
export default function StatsGrid({ rawData, selectedTickers, tickerColors }) {
  const stats = useMemo(() => {
    if (!rawData || rawData.length === 0 || selectedTickers.length === 0) return [];

    return selectedTickers.map((ticker) => {
      const tickerData = rawData
        .filter((d) => d.ticker === ticker)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (tickerData.length === 0) return null;

      const firstRecord = tickerData[0];
      const latestRecord = tickerData[tickerData.length - 1];

      const firstClose = firstRecord.close;
      const currentClose = latestRecord.close;
      const priceChange = currentClose - firstClose;
      const percentChange = firstClose ? (priceChange / firstClose) * 100 : 0;

      const closes = tickerData.map((d) => d.close);
      const maxClose = Math.max(...closes);
      const minClose = Math.min(...closes);

      return {
        ticker,
        currentClose,
        percentChange,
        priceChange,
        maxClose,
        minClose,
        color: tickerColors[ticker] || '#10b981'
      };
    }).filter(Boolean);
  }, [rawData, selectedTickers, tickerColors]);

  if (stats.length === 0) return null;

  return (
    <div className="stats-grid animate-fade-in">
      {stats.map((stat) => {
        const isPositive = stat.percentChange >= 0;
        
        return (
          <div
            key={stat.ticker}
            className="stat-card glass"
            style={{
              '--card-accent': stat.color,
              '--card-accent-glow': `${stat.color}15`,
              '--card-border-highlight': `${stat.color}35`
            }}
          >
            <div className="stat-card-header">
              <div className="stat-brand">
                <div className="stat-dot" style={{ backgroundColor: stat.color }} />
                <span className="stat-ticker">{stat.ticker}</span>
              </div>
              <div className={`stat-trend ${isPositive ? 'positive' : 'negative'}`}>
                {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span>{stat.percentChange.toFixed(2)}%</span>
              </div>
            </div>

            <div className="stat-main">
              <span className="stat-label">Current Close</span>
              <h3 className="stat-value">
                ${stat.currentClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>

            <div className="stat-details">
              <div className="detail-item">
                <span className="detail-label">Period Max</span>
                <span className="detail-value font-mono">
                  ${stat.maxClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="detail-divider" />
              <div className="detail-item">
                <span className="detail-label">Period Min</span>
                <span className="detail-value font-mono">
                  ${stat.minClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
