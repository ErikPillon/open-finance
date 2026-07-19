# LiteFi Dashboard (React + Vite)

A modern, highly-polished, and modular financial terminal front-end built using React, Chart.js, and Lucide Icons. It connects directly with the Python/FastAPI timeseries engine served on `localhost:8000`.

## ✨ Features

- **Dynamic Multi-Asset Selection & Overlays**: Unlike the previous single-select dashboard, you can click on multiple assets in the tracked registry to dynamically overlay and compare their curves on the same chart.
- **Custom Aesthetic Palette**: Selected assets automatically receive visual styling highlights, custom neon glowing chart lines, and individual performance card states matching their chart trace colors.
- **Real-Time Node Ingestion Tracker**: Integrated an intuitive search/input box to let you ingest, validate, and backfill any Yahoo Finance asset (e.g. `TSLA`, `NVDA`, `ETH-USD`) in the background directly from the dashboard.
- **Dynamic Metrics Grid**: Auto-computes analytics—including current closing price, period percentage changes, high/low limits—calculated dynamically from the database timeseries payload.
- **Auto-Telemetry Polling**: Keeps the dashboard alive by executing subtle, lightweight background polling every 30 seconds to fetch fresh stock updates.
- **Vanilla CSS styling**: Elegant, modular responsive stylesheets avoid bulky Tailwind configurations for maximum maintainability.

## 🚀 Quick Start

Ensure you have [Node.js](https://nodejs.org) (v18+) installed.

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
Launch the hot-reloading development server on [http://localhost:3000](http://localhost:3000):
```bash
npm run dev
```

### 3. Build & Preview for Production
To bundle highly optimized static assets into the `dist/` directory:
```bash
npm run build
npm run preview
```

---

*Part of the Open Finance suite.*
