import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header.jsx';
import TickerSelector from './components/TickerSelector.jsx';
import TickerTracker from './components/TickerTracker.jsx';
import ChartContainer from './components/ChartContainer.jsx';
import StatsGrid from './components/StatsGrid.jsx';

const API_BASE = 'http://localhost:8000/api';

// Fresh, high-contrast, premium color palette for tickers
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
  const [tickers, setTickers] = useState([]);
  const [selectedTickers, setSelectedTickers] = useState([]);
  const [resolution, setResolution] = useState('1d');
  const [rawData, setRawData] = useState([]);
  const [tickersLoading, setTickersLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);

  // Dynamically assign colors to tickers from preset palette for visual consistency
  const tickerColors = useMemo(() => {
    const mapping = {};
    tickers.forEach((ticker, idx) => {
      mapping[ticker] = PRESET_COLORS[idx % PRESET_COLORS.length];
    });
    return mapping;
  }, [tickers]);

  // Fetch the tracked registry of tickers
  const fetchTickers = useCallback(async (selectNewTicker = null) => {
    setTickersLoading(true);
    try {
      const response = await fetch(`${API_BASE}/tickers`);
      if (response.ok) {
        const data = await response.json();
        setTickers(data);
        setIsApiConnected(true);

        // Auto-selection heuristic
        if (data.length > 0) {
          if (selectNewTicker && data.includes(selectNewTicker)) {
            // If we just added a new ticker, add/select it
            setSelectedTickers((prev) => {
              if (prev.includes(selectNewTicker)) return prev;
              return [...prev, selectNewTicker];
            });
          } else if (selectedTickers.length === 0) {
            // Default select the first ticker on boot
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

  // Fetch telemetry historical price data for active assets
  const fetchTelemetryData = useCallback(async () => {
    if (selectedTickers.length === 0) {
      setRawData([]);
      return;
    }

    setDataLoading(true);
    const tickersParam = selectedTickers.join(',');
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
  }, [selectedTickers, resolution]);

  // Handle ticker list selections
  const handleToggleTicker = useCallback((ticker) => {
    setSelectedTickers((prev) => {
      if (prev.includes(ticker)) {
        // Allow deselecting, but keep at least 1 or allow empty for clean state
        return prev.filter((t) => t !== ticker);
      } else {
        return [...prev, ticker];
      }
    });
  }, []);

  // Handle successful ingestion from the Ingestion tracker component
  const handleTrackSuccess = useCallback(async (newTicker) => {
    await fetchTickers(newTicker);
  }, [fetchTickers]);

  // --- LIFECYCLE ---
  // Initial bootstrap
  useEffect(() => {
    fetchTickers();
  }, []);

  // Sync historical chart data when selected nodes or resolution changes
  useEffect(() => {
    fetchTelemetryData();
  }, [selectedTickers, resolution, fetchTelemetryData]);

  // Light automated polling to update the "Live Node" dashboard every 30 seconds
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

      <div className="dashboard-grid">
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
            rawData={rawData}
            selectedTickers={selectedTickers}
            resolution={resolution}
            loading={dataLoading}
            tickerColors={tickerColors}
          />
          
          <StatsGrid
            rawData={rawData}
            selectedTickers={selectedTickers}
            tickerColors={tickerColors}
          />
        </section>
      </div>
    </div>
  );
}
