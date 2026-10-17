<div align="center">

# ⚡ CronsCollision

**Cron Overlap &amp; Server Load Visualizer**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Made with React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646cff.svg)](https://vitejs.dev)
[![Tests](https://img.shields.io/badge/Tests-Vitest-6e9f18.svg)](https://vitest.dev)

*Visualize multi-job crontab overlaps across a 24-hour timeline, detect server load spikes, and auto-rebalance colliding schedules — all 100% in your browser.*

</div>

---

## 🧩 The Problem It Solves

If you manage infrastructure, you've probably lived through **The Midnight Stampede**: six cron jobs all scheduled at `0 0 * * *` (midnight) or `0 * * * *` (top-of-hour) fire simultaneously, hammering CPU, disk I/O, and database connections at once. The result? Silent performance degradation, race conditions, and out-of-memory kills — all from scheduling choices that looked fine in isolation.

**CronsCollision** makes these collisions visible on a minute-by-minute 1440-minute heatmap, then deterministically rewrites your crontab to stagger jobs into open windows — without changing how often any job runs.

---

## ✨ Key Features

### 📊 Interactive 1440-Minute Collision Heatmap
A pixel-by-pixel visual load chart spanning the entire 24-hour day. Each minute is color-coded by concurrent job count:
- **Dark slate** — 0 jobs idle
- **Emerald** — 1 job (healthy)
- **Sky blue** — 2 jobs (minor overlap)
- **Amber** — 3 jobs (warning)
- **Pulsing crimson** — 4+ jobs (severe collision zone)

Toggle between **Full 24h View**, **Collisions Only**, or **Zoom to Hour**. Hover or click any minute to inspect exactly which jobs are executing — including jobs still running from earlier start times due to their duration.

### ⏱️ Duration-Aware Overlap Math
Every job carries an estimated duration (1–60 minutes). A job starting at `23:55` with a 10-minute run correctly wraps past midnight, keeping minutes `00:00–00:04` marked as active. Duration is set via inline `# duration:5m` comments or interactive sliders.

### 🎯 Deterministic Auto-Jitter / Balance Engine
Clicking **⚡ Auto-Balance Collisions** runs a deterministic optimization that shifts colliding jobs' minute and hour offsets to minimize peak concurrent load — while **strictly preserving each job's frequency**. An hourly job stays hourly; a daily job stays daily. Only the offset changes. A before/after diff modal shows the exact peak load reduction and side-by-side expression changes.

### 📝 Live Crontab Editor with Real-Time Validation
A syntax-friendly multi-line editor where you can paste raw crontab files. Malformed lines produce inline error badges with helpful messages — no crashes. The heatmap updates live as you type.

### 🏊 Job Swimlanes & Duration Sliders
Each parsed job gets a miniature 24-hour swimlane strip showing fire times and collision highlights in red. Drag the duration slider (1–60 min) and watch the heatmap and swimlanes expand in real time.

### 📤 Multi-Format Export
Export your schedule in three formats:
- **Standard Linux Crontab** — ready to paste into `crontab -e`
- **GitHub Actions YAML** — auto-converted to `on: schedule: - cron: '...'` workflow syntax
- **JSON Collision Audit Report** — structured summary for CI/CD pipelines

### 🔗 Zero-Backend URL Sharing
Click **Share Schedule Link** to encode your entire crontab into the URL hash. Anyone opening that link sees the exact same schedule and heatmap — no server, no database, no API keys.

---

## 🧠 How the Auto-Balance Algorithm Works

The optimizer uses a **greedy coordinate-descent** strategy with a quadratic collision penalty:

1. **Clone** all jobs into a working set.
2. **For each job**, attempt every valid offset shift within its frequency class:
   - **Hourly jobs** (`* * * * *` with a single minute): try all 60 minute offsets.
   - **Daily jobs** (single hour + single minute): try all 1440 hour×minute combinations.
   - **Stepped jobs** (`*/N`): try all `N` base offsets within the step period.
3. **Score each candidate** using `Σ(load²)` over the job's active minutes — squaring the load heavily penalizes minutes where many jobs overlap.
4. **Commit the lowest-scoring offset** for that job, then move to the next.
5. **Rebuild cron expressions** from the shifted minute/hour arrays.

**Frequency preservation guarantee**: the algorithm only changes *when* a job runs, never *how often*. The minute and hour arrays keep the same length and step pattern — only the base offset shifts — so `dailyRuns` is identical before and after. This is verified by unit tests.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or your preferred package manager

### Installation

```bash
git clone https://github.com/yourusername/cronscollision.git
cd cronscollision
npm install
npm run dev
```

The app runs on `http://localhost:5173`.

### Running Tests

```bash
npm test
```

The Vitest suite covers:
- Standard 5-part cron parsing (wildcards, steps, ranges, lists)
- Macro expansion (`@hourly`, `@daily`, `@midnight`, `@weekly`)
- Midnight wrap-around duration math
- Collision detection accuracy
- Auto-Balance frequency preservation

### Build for Production

```bash
npm run build
npm run preview
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5.5 |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| Tests | Vitest |
| Backend | **None** — 100% client-side |

The cron engine (`src/utils/cronEngine.ts`) is a zero-dependency TypeScript module: no cron library, no scheduling framework, no external API. Everything runs in the browser.

---

## 📦 Built-in Preset Scenarios

| Preset | Description |
|--------|-------------|
| **The Midnight Stampede** | 10 DevOps jobs where 6 collide at midnight or top-of-hour, creating severe red spikes |
| **Microservice Chaos** | High-frequency `*/5`, `*/10`, `*/15` jobs with 3–6m durations creating periodic overlaps |
| **Well-Balanced Production** | Staggered schedules showing a healthy green/blue load distribution |

---

## 📄 License

[MIT](LICENSE) — free to use, modify, and distribute.

---

<div align="center">

*Built for DevOps engineers who are tired of midnight surprises.*

</div>
