import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Briefcase, Compass } from 'lucide-react';
import './Home.css';

export default function Home() {
  return (
    <div className="home-container animate-fade-in">
      <div className="home-header">
        <h1 className="home-title">Welcome to LiteFi</h1>
        <p className="home-subtitle">Select a module to begin analyzing your financial data.</p>
      </div>
      
      <div className="home-grid">
        <Link to="/terminal" className="home-card glass panel">
          <div className="home-card-icon-wrapper">
            <Activity size={32} className="home-card-icon text-blue-500" />
          </div>
          <h2 className="home-card-title">Live Terminal</h2>
          <p className="home-card-desc">
            Monitor real-time prices, view historical charts, and track specific assets using the interactive telemetry dashboard.
          </p>
        </Link>

        <Link to="/portfolio" className="home-card glass panel">
          <div className="home-card-icon-wrapper">
            <Briefcase size={32} className="home-card-icon text-emerald-500" />
          </div>
          <h2 className="home-card-title">Portfolio Manager</h2>
          <p className="home-card-desc">
            Log your buy and sell transactions, calculate realized gains/losses, and track your active and closed positions.
          </p>
        </Link>

        <Link to="/sentiment" className="home-card glass panel">
          <div className="home-card-icon-wrapper">
            <Compass size={32} className="home-card-icon text-amber-500" />
          </div>
          <h2 className="home-card-title">Fear & Greed Index</h2>
          <p className="home-card-desc">
            Analyze market sentiment using a composite score based on momentum, volatility, safe haven demand, and junk bond spreads.
          </p>
        </Link>
      </div>
    </div>
  );
}
