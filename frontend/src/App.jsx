import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, Briefcase } from 'lucide-react';
import Header from './components/Header.jsx';
import TickerSelector from './components/TickerSelector.jsx';
import TickerTracker from './components/TickerTracker.jsx';
import ChartContainer from './components/ChartContainer.jsx';
import StatsGrid from './components/StatsGrid.jsx';
import PortfolioManager from './components/PortfolioManager.jsx';

const API_BASE = 'http://localhost:8000/api';

const PRESET_COLORS = [
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#eab308', // Amber
  '#a855f7', // Purple
  '#f97316', // Orange
  '#3b82f6'  // Blue
];

export default function App() {
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' or 'portfolio'
  const [tickers, setTickers] = useState([]);
  const [selectedTickers, setSelectedTickers] = useState([]);
  const [resolution, setResolution] = useState('1d');
  const [rawData, setRawData] = useState([]);
  const [tickersLoading, setTickersLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);

  // Read current portfolio symbols to ensure we always load their telemetry prices
  const portfolioSymbols = useMemo(() => {
    const saved = localStorage.getItem('litefi_portfolio_transactions');
    if (!saved) return [];
    try {
      const txs = JSON.parse(saved);
      return Array.from(new Set(txs.map(tx => tx.ticker.toUpperCase())));
    } catch {
      return [];
    }
  }, [activeTab]);

  // Combined list of tickers that we need to fetch data for
  const tickersToFetch = useMemo(() => {
    const combined = new Set([...selectedTickers, ...portfolioSymbols]);
    return Array.from(combined);
  }, [selectedTickers, portfolioSymbols]);

  // Dynamically assign colors to tickers from preset palette
  const tickerColors = useMemo(() => {
    const mapping = {};
    tickers.forEach((ticker, idx) => {
      mapping[ticker] = PRESET_COLORS[idx % PRESET_COLORS.length];
    });
    return mapping;
  }, [tickers]);

  // Fetch tracked registry of tickers
  const fetchTickers = useCallback(async (selectNewTicker = null) => {
    setTickersLoading(true);
    try {
      const response = await fetch(`${API_BASE}/tickers`);
      if (response.ok) {
        const data = await response.json();
        setTickers(data);
        setIsApiConnected(true);

        if (data.length > 0) {
          if (selectNewTicker && data.includes(selectNewTicker)) {
            setSelectedTickers((prev) => {
              if (prev.includes(selectNewTicker)) return prev;
              return [...prev, selectNewTicker];
            });
          } else if (selectedTickers.length === 0) {
            setSelectedTickers([data[0]]);
          }
        }
      } else {
        setIsApiConnected(false);
      }
    } catch (err) {
      console.error('Failed to connect to backend registry:', err);
      setIsApiConnected(false);
    } finally {
      setTickersLoading(false);
    }
  }, [selectedTickers]);

  // Fetch telemetry historical price data for active + portfolio assets
  const fetchTelemetryData = useCallback(async () => {
    if (tickersToFetch.length === 0) {
      setRawData([]);
      return;
    }

    setDataLoading(true);
    const tickersParam = tickersToFetch.join(',');
    try {
      const response = await fetch(
        `${API_BASE}/data?tickers=${tickersParam}&resolution=${resolution}&limit=120`
      );
      if (response.ok) {
        const payload = await response.json();
        setRawData(payload.data || []);
        setIsApiConnected(true);
      } else {
        console.error('Failed to retrieve telemetry data:', response.statusText);
      }
    } catch (err) {
      console.error('Network failure pulling telemetry data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [tickersToFetch, resolution]);

  // Handle ticker list selections
  const handleToggleTicker = useCallback((ticker) => {
    setSelectedTickers((prev) => {
      if (prev.includes(ticker)) {
        return prev.filter((t) => t !== ticker);
      } else {
        return [...prev, ticker];
      }
    });
  }, []);

  const handleTrackSuccess = useCallback(async (newTicker) => {
    await fetchTickers(newTicker);
  }, [fetchTickers]);

  // --- LIFECYCLE ---
  useEffect(() => {
    fetchTickers();
  }, []);

  // Sync historical chart data when selected nodes, portfolio, or resolution changes
  useEffect(() => {
    fetchTelemetryData();
  }, [selectedTickers, portfolioSymbols, resolution, fetchTelemetryData]);

  // Light background polling to update terminal data every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchTelemetryData();
    }, 30000);

    return () => clearInterval(timer);
  }, [fetchTelemetryData]);

  return (
    <div className="app-container">
      <Header
        resolution={resolution}
        setResolution={setResolution}
        onRefresh={fetchTelemetryData}
        loading={dataLoading}
        isApiConnected={isApiConnected}
      />

      {/* Tab Navigation Menu */}
      <nav className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => setActiveTab('terminal')}
        >
          <Activity size={16} />
          <span>Live Terminal</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => setActiveTab('portfolio')}
        >
          <Briefcase size={16} />
          <span>Portfolio Manager</span>
        </button>
      </nav>

      {activeTab === 'terminal' ? (
        <div className="dashboard-grid animate-fade-in">
          <aside className="sidebar flex flex-col gap-6">
            <TickerSelector
              tickers={tickers}
              selectedTickers={selectedTickers}
              onToggleTicker={handleToggleTicker}
              loading={tickersLoading}
              tickerColors={tickerColors}
            />
            <TickerTracker
              onTrackSuccess={handleTrackSuccess}
              apiBase={API_BASE}
            />
          </aside>

          <section className="main-content flex flex-col gap-6">
            <ChartContainer
              rawData={rawData.filter(d => selectedTickers.includes(d.ticker))}
              selectedTickers={selectedTickers}
              resolution={resolution}
              loading={dataLoading}
              tickerColors={tickerColors}
            />
            
            <StatsGrid
              rawData={rawData.filter(d => selectedTickers.includes(d.ticker))}
              selectedTickers={selectedTickers}
              tickerColors={tickerColors}
            />
          </section>
        </div>
      ) : (
        <PortfolioManager
          trackedTickers={tickers}
          telemetryData={rawData}
          apiBase={API_BASE}
          onTrackNewTicker={handleTrackSuccess}
        />
      )}
    </div>
  );
}
