import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from backend.settings import settings
from backend.database import (
    init_db,
    save_assessment,
    get_assessments,
    save_trade,
    get_trades,
    update_trade
)
from backend.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    TradeCreate,
    TradeUpdate,
    SystemConfigResponse
)
from backend.analyzer import analyze_chart
from backend.metrics import calculate_performance_report

class ContentSizeLimitMiddleware(BaseHTTPMiddleware):
    """Enforce maximum body size to protect memory from oversized image payloads."""
    def __init__(self, app, max_size_bytes: int = 15 * 1024 * 1024):
        super().__init__(app)
        self.max_size = max_size_bytes

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_size:
            return Response(
                content="Payload Too Large (Exceeds 15MB limit)",
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
            )
        return await call_next(request)

app = FastAPI(
    title="ChartLab Demo",
    description="Quotex Demo Chart Monitor and AI Assessment Evaluator",
    version=settings.STRATEGY_VERSION
)

app.add_middleware(ContentSizeLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

# -----------------------------------------------------------------------------
# API Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/config", response_model=SystemConfigResponse)
def get_config():
    """Return backend configuration parameters and active operational modes."""
    return SystemConfigResponse(
        mock_mode=settings.MOCK_MODE,
        model=settings.OPENAI_MODEL,
        strategy_version=settings.STRATEGY_VERSION,
        capture_interval_seconds=settings.CAPTURE_INTERVAL_SECONDS,
        max_screenshot_age_seconds=settings.MAX_SCREENSHOT_AGE_SECONDS,
        is_key_configured=bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip())
    )

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(req: AnalyzeRequest):
    """
    Accepts cropped screenshot, checks operational screenshot age,
    runs structured AI analysis (or mock), saves before returning, and flags stale data.
    """
    now_utc = datetime.now(timezone.utc)
    now_utc_str = now_utc.isoformat()
    
    # Calculate screenshot age
    screenshot_age = 0.0
    try:
        # Support ISO formats with or without Z
        clean_ts = req.capture_timestamp.replace("Z", "+00:00")
        cap_dt = datetime.fromisoformat(clean_ts)
        if cap_dt.tzinfo is None:
            cap_dt = cap_dt.replace(tzinfo=timezone.utc)
        screenshot_age = max(0.0, (now_utc - cap_dt).total_seconds())
    except Exception:
        screenshot_age = 0.0

    is_stale = screenshot_age > settings.MAX_SCREENSHOT_AGE_SECONDS

    analysis_res, is_mock, err = await analyze_chart(
        image_base64=req.image_base64,
        asset=req.asset,
        timeframe=req.timeframe,
        observation_duration=req.observation_duration,
        capture_timestamp=req.capture_timestamp
    )

    assessment_id = str(uuid.uuid4())
    
    response_item = AnalyzeResponse(
        id=assessment_id,
        session_id=req.session_id,
        capture_timestamp=req.capture_timestamp,
        response_timestamp=now_utc_str,
        asset=req.asset,
        timeframe=req.timeframe,
        observation_duration=req.observation_duration,
        screenshot_age_seconds=round(screenshot_age, 2),
        model=settings.OPENAI_MODEL if not is_mock else "mock-simulator",
        strategy_version=settings.STRATEGY_VERSION,
        analysis=analysis_res,
        is_mock=is_mock,
        is_stale=is_stale
    )

    # Persist record before returning
    save_assessment(response_item)
    return response_item

@app.get("/api/assessments")
def list_assessments(limit: int = 50, session_id: Optional[str] = None, include_mock: bool = True):
    return get_assessments(limit=limit, session_id=session_id, include_mock=include_mock)

@app.post("/api/trades")
def create_trade(trade: TradeCreate):
    return save_trade(trade)

@app.get("/api/trades")
def list_trades(limit: int = 100, include_mock: bool = True):
    return get_trades(limit=limit, include_mock=include_mock)

@app.patch("/api/trades/{trade_id}")
def update_trade_endpoint(trade_id: str, update: TradeUpdate):
    updated = update_trade(
        trade_id=trade_id,
        outcome=update.outcome.value if update.outcome else None,
        settlement_amount=update.settlement_amount,
        notes=update.notes
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Trade record not found")
    return updated

@app.get("/api/metrics")
def get_metrics(include_mock: bool = False):
    trades = get_trades(limit=5000, include_mock=include_mock)
    assessments = get_assessments(limit=5000, include_mock=include_mock)
    return calculate_performance_report(trades=trades, assessments=assessments, include_mock=include_mock)

@app.get("/api/export/csv")
def export_csv(table: str = "trades", include_mock: bool = True):
    """Export trade records or assessment records as downloadable CSV."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    if table == "trades":
        trades = get_trades(limit=10000, include_mock=include_mock)
        headers = [
            "id", "assessment_id", "session_id", "asset", "timeframe",
            "observation_duration", "was_entered", "direction", "entry_price",
            "entry_time", "expiry_time", "stake", "settlement_amount", "pnl",
            "outcome", "notes", "is_mock", "created_at"
        ]
        writer.writerow(headers)
        for t in trades:
            writer.writerow([t.get(h, "") for h in headers])
        filename = f"chartlab_trades_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    else:
        assessments = get_assessments(limit=10000, include_mock=include_mock)
        headers = [
            "id", "session_id", "capture_timestamp", "response_timestamp",
            "asset", "timeframe", "observation_duration", "screenshot_age_seconds",
            "model", "strategy_version", "direction", "data_quality", "trend",
            "reasoning", "entry_condition", "invalidation_condition", "limitations",
            "is_mock", "is_stale", "created_at"
        ]
        writer.writerow(headers)
        for a in assessments:
            writer.writerow([a.get(h, "") for h in headers])
        filename = f"chartlab_assessments_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
        
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# -----------------------------------------------------------------------------
# Frontend Static Files & Single Page App Serving
# -----------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def serve_index():
    index_file = settings.FRONTEND_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend index.html not found.")
    return HTMLResponse(content=index_file.read_text(encoding="utf-8"))

# Mount frontend directory for static assets (style.css, app.js)
if settings.FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(settings.FRONTEND_DIR)), name="static")

