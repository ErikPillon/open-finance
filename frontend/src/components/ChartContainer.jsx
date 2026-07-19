import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { AreaChart, TrendingUp, HelpCircle } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import './ChartContainer.css';

// Register Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * ChartContainer Component
 * Aligns flat database data by timestamp and renders multiple datasets using React-Chartjs-2.
 */
export default function ChartContainer({
  rawData,
  selectedTickers,
  resolution,
  loading,
  tickerColors
}) {
  // 1. Process and align data chronologically
  const chartData = useMemo(() => {
    if (!rawData || rawData.length === 0) return null;

    // Get all unique timestamps, sorted chronologically
    const uniqueTimestamps = Array.from(new Set(rawData.map((d) => d.timestamp)))
      .sort((a, b) => new Date(a) - new Date(b));

    // Form X-axis labels beautifully
    const labels = uniqueTimestamps.map((ts) => {
      const date = new Date(ts);
      if (resolution === '1h') {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
          date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    });

    // Create datasets for each selected ticker
    const datasets = selectedTickers.map((ticker) => {
      const color = tickerColors[ticker] || '#10b981';
      
      // Align prices to the unique timestamps array
      const dataPoints = uniqueTimestamps.map((ts) => {
        const record = rawData.find((d) => d.timestamp === ts && d.ticker === ticker);
        return record ? record.close : null;
      });

      return {
        label: `${ticker} Close`,
        data: dataPoints,
        borderColor: color,
        borderWidth: 2,
        pointRadius: selectedTickers.length > 2 ? 0 : 1.5,
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        pointBorderColor: '#070a13',
        pointBorderWidth: 1.5,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          
          // Create subtle glowing gradient under the line
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, `${color}25`);
          gradient.addColorStop(1, `${color}00`);
          return gradient;
        },
        fill: true,
        tension: 0.08,
        spanGaps: true // smoothly bridge missing values
      };
    });

    return { labels, datasets };
  }, [rawData, selectedTickers, resolution, tickerColors]);

  // 2. ChartJS Configurations
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: selectedTickers.length > 1,
        position: 'top',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          color: '#94a3b8',
          font: {
            family: 'Inter, system-ui',
            size: 11,
            weight: 500
          },
          padding: 15
        }
      },
      tooltip: {
        backgroundColor: '#0e1424',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        titleFont: {
          family: 'JetBrains Mono, monospace',
          size: 11,
          weight: 600
        },
        bodyFont: {
          family: 'Inter, system-ui',
          size: 12
        },
        callbacks: {
          label: (context) => {
            const label = context.dataset.label.split(' ')[0] || '';
            const value = context.parsed.y;
            return ` ${label}: $${value !== null ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.03)',
          drawTicks: false
        },
        ticks: {
          color: '#64748b',
          font: {
            family: 'JetBrains Mono, monospace',
            size: 9
          },
          maxTicksLimit: 10,
          padding: 8
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.03)',
          drawTicks: false
        },
        ticks: {
          color: '#64748b',
          font: {
            family: 'JetBrains Mono, monospace',
            size: 10
          },
          padding: 8,
          callback: (value) => `$${value}`
        }
      }
    }
  }), [selectedTickers]);

  return (
    <main className="chart-panel panel glass">
      <div className="panel-header">
        <h2 className="panel-title">
          <AreaChart size={18} className="title-icon-primary" />
          <span>Interactive Timeseries Terminal</span>
        </h2>
        {selectedTickers.length > 1 && (
          <div className="multi-badge badge badge-info">
            Overlay Mode
          </div>
        )}
      </div>

      <div className="chart-viewport">
        {loading ? (
          <div className="chart-overlay-state">
            <div className="chart-loading-indicator">
              <div className="loader-ring" />
              <p className="state-text">Streaming telemetry from QuestDB...</p>
            </div>
          </div>
        ) : null}

        {!loading && selectedTickers.length === 0 ? (
          <div className="chart-overlay-state">
            <TrendingUp size={36} className="state-icon-muted" />
            <p className="state-title">No Node Selected</p>
            <p className="state-subtitle">Activate one or more assets in the sidebar to trace curves.</p>
          </div>
        ) : null}

        {!loading && selectedTickers.length > 0 && (!rawData || rawData.length === 0) ? (
          <div className="chart-overlay-state">
            <HelpCircle size={36} className="state-icon-warn" />
            <p className="state-title">No Data In Range</p>
            <p className="state-subtitle">Backfilling in progress or API database is empty for selected assets.</p>
          </div>
        ) : null}

        {chartData && selectedTickers.length > 0 && rawData && rawData.length > 0 && (
          <div className="chart-wrapper">
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
      </div>
    </main>
  );
}
