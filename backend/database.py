import sqlite3
import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from backend.settings import settings
from backend.schemas import AnalyzeResponse, TradeCreate, TradeOutcomeEnum

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.DATABASE_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    """Initialize SQLite database and create required schema tables if not exist."""
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS assessments (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                capture_timestamp TEXT NOT NULL,
                response_timestamp TEXT NOT NULL,
                asset TEXT NOT NULL,
                timeframe TEXT NOT NULL,
                observation_duration TEXT NOT NULL,
                screenshot_age_seconds REAL NOT NULL,
                model TEXT NOT NULL,
                strategy_version TEXT NOT NULL,
                direction TEXT NOT NULL,
                data_quality TEXT NOT NULL,
                trend TEXT NOT NULL,
                patterns_json TEXT NOT NULL,
                support_resistance_json TEXT,
                reasoning TEXT NOT NULL,
                entry_condition TEXT,
                invalidation_condition TEXT,
                limitations TEXT NOT NULL,
                is_mock INTEGER NOT NULL,
                is_stale INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                assessment_id TEXT,
                session_id TEXT,
                asset TEXT NOT NULL,
                timeframe TEXT NOT NULL,
                observation_duration TEXT NOT NULL,
                was_entered INTEGER NOT NULL,
                direction TEXT NOT NULL,
                entry_price REAL,
                entry_time TEXT,
                expiry_time TEXT,
                stake REAL NOT NULL,
                settlement_amount REAL NOT NULL,
                pnl REAL NOT NULL,
                outcome TEXT NOT NULL,
                notes TEXT,
                is_mock INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (assessment_id) REFERENCES assessments(id)
            )
        """)
        
        # Indexes for fast historical querying and session filtering
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_assessments_created ON assessments(created_at DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_assessments_session ON assessments(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_assessment ON trades(assessment_id)")
        
        conn.commit()

def save_assessment(item: AnalyzeResponse) -> None:
    now_utc = datetime.now(timezone.utc).isoformat()
    analysis = item.analysis
    patterns_json = json.dumps([p.model_dump() for p in analysis.patterns])
    sr_json = json.dumps(analysis.support_resistance.model_dump()) if analysis.support_resistance else None
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO assessments (
                id, session_id, capture_timestamp, response_timestamp,
                asset, timeframe, observation_duration, screenshot_age_seconds,
                model, strategy_version, direction, data_quality, trend,
                patterns_json, support_resistance_json, reasoning,
                entry_condition, invalidation_condition, limitations,
                is_mock, is_stale, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item.id,
            item.session_id,
            item.capture_timestamp,
            item.response_timestamp,
            item.asset,
            item.timeframe,
            item.observation_duration,
            item.screenshot_age_seconds,
            item.model,
            item.strategy_version,
            analysis.direction.value,
            analysis.data_quality.value,
            analysis.trend.value,
            patterns_json,
            sr_json,
            analysis.reasoning,
            analysis.entry_condition,
            analysis.invalidation_condition,
            analysis.limitations,
            1 if item.is_mock else 0,
            1 if item.is_stale else 0,
            now_utc
        ))
        conn.commit()

def get_assessments(limit: int = 50, session_id: Optional[str] = None, include_mock: bool = True) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM assessments WHERE 1=1"
        params: List[Any] = []
        
        if not include_mock:
            query += " AND is_mock = 0"
        if session_id:
            query += " AND session_id = ?"
            params.append(session_id)
            
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        results = []
        for r in rows:
            d = dict(r)
            d["is_mock"] = bool(d["is_mock"])
            d["is_stale"] = bool(d["is_stale"])
            d["patterns"] = json.loads(d["patterns_json"]) if d.get("patterns_json") else []
            d["support_resistance"] = json.loads(d["support_resistance_json"]) if d.get("support_resistance_json") else None
            results.append(d)
        return results

def save_trade(trade: TradeCreate) -> Dict[str, Any]:
    trade_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc).isoformat()
    
    # Calculate PnL based on platform settlement and stake
    # For WIN: typically settlement = stake + payout (e.g. 10 stake + 8.5 payout = 18.5, PnL = +8.5)
    # For LOSS: settlement = 0.0, PnL = -stake
    # For DRAW: settlement = stake, PnL = 0.0
    pnl = 0.0
    if trade.outcome == TradeOutcomeEnum.WIN:
        pnl = trade.settlement_amount - trade.stake if trade.settlement_amount > 0 else 0.0
    elif trade.outcome == TradeOutcomeEnum.LOSS:
        pnl = -abs(trade.stake)
    elif trade.outcome == TradeOutcomeEnum.DRAW:
        pnl = 0.0
    elif trade.settlement_amount > 0:
        pnl = trade.settlement_amount - trade.stake
        
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO trades (
                id, assessment_id, session_id, asset, timeframe, observation_duration,
                was_entered, direction, entry_price, entry_time, expiry_time,
                stake, settlement_amount, pnl, outcome, notes, is_mock, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            trade_id,
            trade.assessment_id,
            trade.session_id,
            trade.asset,
            trade.timeframe,
            trade.observation_duration,
            1 if trade.was_entered else 0,
            trade.direction,
            trade.entry_price,
            trade.entry_time or now_utc,
            trade.expiry_time,
            trade.stake,
            trade.settlement_amount,
            pnl,
            trade.outcome.value,
            trade.notes,
            1 if trade.is_mock else 0,
            now_utc
        ))
        conn.commit()
        
    return {
        "id": trade_id,
        "assessment_id": trade.assessment_id,
        "pnl": pnl,
        "outcome": trade.outcome.value,
        "created_at": now_utc
    }

def update_trade(trade_id: str, outcome: Optional[str] = None, settlement_amount: Optional[float] = None, notes: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM trades WHERE id = ?", (trade_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        stake = row["stake"]
        cur_outcome = outcome or row["outcome"]
        cur_settlement = settlement_amount if settlement_amount is not None else row["settlement_amount"]
        cur_notes = notes if notes is not None else row["notes"]
        
        pnl = 0.0
        if cur_outcome == TradeOutcomeEnum.WIN.value:
            pnl = cur_settlement - stake if cur_settlement > 0 else 0.0
        elif cur_outcome == TradeOutcomeEnum.LOSS.value:
            pnl = -abs(stake)
        elif cur_outcome == TradeOutcomeEnum.DRAW.value:
            pnl = 0.0
        elif cur_settlement > 0:
            pnl = cur_settlement - stake

        cursor.execute("""
            UPDATE trades
            SET outcome = ?, settlement_amount = ?, pnl = ?, notes = ?
            WHERE id = ?
        """, (cur_outcome, cur_settlement, pnl, cur_notes, trade_id))
        conn.commit()
        
        cursor.execute("SELECT * FROM trades WHERE id = ?", (trade_id,))
        updated = dict(cursor.fetchone())
        updated["was_entered"] = bool(updated["was_entered"])
        updated["is_mock"] = bool(updated["is_mock"])
        return updated

def get_trades(limit: int = 100, include_mock: bool = True) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM trades WHERE 1=1"
        params: List[Any] = []
        if not include_mock:
            query += " AND is_mock = 0"
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["was_entered"] = bool(d["was_entered"])
            d["is_mock"] = bool(d["is_mock"])
            results.append(d)
        return results

