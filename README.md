# ChartLab Demo: Quotex Chart Monitor & Strategy Evaluator

**ChartLab Demo** is a disciplined, lightweight web application for monitoring a Quotex demo chart through browser screen sharing and evaluating AI-generated chart assessments against actual platform outcomes.

Its primary goal is to **measure whether a chart strategy has a repeatable, verifiable statistical edge** under objective evaluation.

> [!WARNING]
> **No Guarantees / Unvalidated Strategy Notice**
> ChartLab Demo is strictly an observational and educational evaluation tool. It does **not** promise 100% accuracy, an 80% win rate, or guaranteed profitability. Binary options brokers (like Quotex) feature asymmetrical payout haircuts (typically ~80–85% on wins vs. 100% on losses), requiring a break-even win rate of ~54–56% after execution slippage. 

---

## 1. System Architecture & Features

- **Backend**: Python FastAPI serving both REST APIs and the static single-page interface.
- **Frontend**: Plain HTML5, CSS3, and JavaScript (ES6+). Zero Node.js build step, zero React, and zero external frontend servers.
- **AI Analysis**: Official OpenAI Python SDK utilizing `beta.chat.completions.parse` with strict Pydantic structured output models (`AIChartAnalysis`).
- **Database**: Local runtime SQLite database automatically initialized at `data/chartlab.sqlite3` with path resolution relative to project root.
- **Screen Sharing & Dynamic Cropping**: Browser-native `navigator.mediaDevices.getDisplayMedia()`. Interactive mouse drag-to-crop rectangle mapped accurately from CSS display dimensions to native video resolution.
- **Operational Safeguards**:
  - Requires explicit **"Start Monitoring"** before uploading any screenshot.
  - Screenshots are processed strictly in memory and never saved to disk by default.
  - Single in-flight request mutex: skips missed intervals rather than building a lagging queue.
  - Automatic pause on hidden tab (`document.visibilitychange`) with explicit manual resume requirement; never sends catch-up bursts after system sleep.
  - Immediate termination of capture intervals on "Stop Monitoring" or "End Sharing", ignoring late or superseded responses.
  - Source dimension change detection prompts crop re-confirmation.
  - Stale response detection: flags delayed responses older than `MAX_SCREENSHOT_AGE_SECONDS` (default 30s) as **STALE**, never as fresh actionable signals.
  - All user-facing times displayed in **Indian Standard Time (IST)** while storing timestamps in UTC ISO format.
  - Passive non-invasive design: never requests Quotex credentials, cookies, or private endpoints, and never executes trades.

---

## 2. Directory Structure

```
C:\Projects\quotex-monitor\
│
├── backend\
│   ├── __init__.py          # Package initialization
│   ├── settings.py          # Relative path resolution and .env configuration
│   ├── schemas.py           # Pydantic schemas for AI structured outputs and APIs
│   ├── analyzer.py          # OpenAI Vision structured output and realistic mock simulator
│   ├── database.py          # SQLite persistence for assessments and demo trades
│   ├── metrics.py           # Win-rate exclusions, 95% Wilson CI, Max DD, losing streak
│   └── main.py              # FastAPI application, static mount, and endpoints
│
├── frontend\
│   ├── index.html           # Responsive dashboard, video preview, controls, tables
│   ├── style.css            # Dark financial UI, status badges, responsive layout
│   └── app.js               # Capture loop, crop geometry mapping, IST clock, metrics
│
├── docs\
│   └── pattern-rules.md     # Reference catalog: definitions, confirmation, Quotex OTC reality
│
├── tests\
│   └── test_metrics.py      # Focused unit tests for PnL, Wilson CI, drawdown, mock separation
│
├── data\
│   └── chartlab.sqlite3     # Runtime SQLite database (auto-created)
│
├── .env.example             # Configuration template
├── .gitignore               # Excludes secrets, venv, runtime database, caches
├── requirements.txt         # Python dependencies
└── README.md                # Documentation and operation guide
```

---

## 3. Windows PowerShell Step-by-Step Commands

### Step 1: Create the Project Directory (if not already created)
```powershell
New-Item -ItemType Directory -Force -Path C:\Projects\quotex-monitor
Set-Location C:\Projects\quotex-monitor
```

### Step 2: Initialize Python Virtual Environment & Install Dependencies
Run from `C:\Projects\quotex-monitor`:
```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
notepad .env
```
Default `.env` configuration runs in **Mock Mode** (`MOCK_MODE=true`), requiring no API keys.

### Step 4: Run Automated Verification Tests
Verify payout calculation, Wilson score confidence bounds, drawdown logic, and mock isolation:
```powershell
.\.venv\Scripts\python.exe -m pytest tests\test_metrics.py -v
```

### Step 5: Start the Server (Mock Mode)
```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### Step 6: Open the Dashboard
From another PowerShell window or your browser:
```powershell
Start-Process "http://localhost:8000"
```

To stop the server at any time, press **`Ctrl + C`** in the server terminal window.

---

## 4. Switching to Real OpenAI Vision Analysis

1. Obtain an API key from [OpenAI Platform](https://platform.openai.com/api-keys).
   *(Note: OpenAI API usage is billed pay-as-you-go and is separate from ChatGPT Plus subscriptions).*
2. Edit your `.env` file:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   MOCK_MODE=false
   CAPTURE_INTERVAL_SECONDS=60
   MAX_SCREENSHOT_AGE_SECONDS=30
   ```
3. Restart the server:
   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```
4. The dashboard badge will automatically switch from `Mock Mode` to `Live OpenAI (gpt-4o-mini)`.

---

## 5. User Workflow Guide

1. **Share Chart**: Click **"Share Chart"** and choose your Quotex browser tab or window. A live video preview appears.
2. **Adjust Chart Crop**: Click and drag your mouse across the video preview to define a rectangular crop enclosing only the candlestick chart. The offscreen transmission preview immediately renders the exact frame to be sent.
3. **Configure Parameters**:
   - Set the asset name (e.g. `EUR/USD OTC`).
   - Set the candle timeframe (e.g. `1m`, `5s`).
   - Configure the analysis interval (default `60s`).
   - Set the demo observation duration (e.g. `1m`, `2m`).
4. **Start Monitoring**: Click **"Start Monitoring"**. The application takes an initial snapshot and schedules periodic evaluations.
5. **Inspect Assessments**: View the latest directional assessment (`UP`, `DOWN`, or `WAIT`), recognized patterns with forming/confirmed status, support/resistance levels, reasoning, and limitations.
6. **Record Demo Trades**: Click **"Record Quotex Demo Trade For This Assessment"** to log your demo platform trade (stake, settlement, and outcome: WIN, LOSS, DRAW, SKIPPED, or UNRESOLVED).
7. **Evaluate Statistical Edge**: Review performance cards displaying:
   - Decisive Win Rate % with exact denominator.
   - 95% Wilson Score Confidence Interval.
   - Net Demo PnL from recorded cashflows.
   - Peak-to-trough Maximum Drawdown.
   - Longest losing streak.
   - Sample size warnings ($n < 30$).
8. **Export Data**: Download complete CSV records via **"Export Trades CSV"** and **"Export Assessments CSV"**.

---

## 6. Limitations & Disclaimer

- **Quotex OTC Price Feeds**: Weekend and OTC quotes are algorithmically generated by the broker and do not trade on public centralized exchanges. Classical volume and institutional liquidity concepts do not apply.
- **Short-Timeframe Noise**: Sub-minute candles (5s to 60s) exhibit severe noise. Patterns can fail within seconds.
- **Correlation**: Wilson confidence bounds provide a standardized binomial approximation assuming independent trials; sequential market trades exhibit temporal autocorrelation.

