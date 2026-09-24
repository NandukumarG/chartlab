from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class DirectionEnum(str, Enum):
    UP = "UP"
    DOWN = "DOWN"
    WAIT = "WAIT"

class DataQualityEnum(str, Enum):
    CLEAR = "clear"
    LIMITED = "limited"
    UNREADABLE = "unreadable"

class TrendEnum(str, Enum):
    UP = "up"
    DOWN = "down"
    RANGE = "range"
    UNCLEAR = "unclear"

class PatternStatusEnum(str, Enum):
    FORMING = "forming"
    CONFIRMED = "confirmed"

class PatternItem(BaseModel):
    name: str = Field(description="Recognized chart or candlestick pattern name")
    evidence: str = Field(description="Visible anatomical evidence on chart candles")
    status: PatternStatusEnum = Field(description="Whether the pattern is forming or confirmed")

class SupportResistanceItem(BaseModel):
    support_level: Optional[str] = Field(default=None, description="Approximate visible support level or null")
    resistance_level: Optional[str] = Field(default=None, description="Approximate visible resistance level or null")
    summary: Optional[str] = Field(default=None, description="Brief note on key price levels or null")

class AIChartAnalysis(BaseModel):
    direction: DirectionEnum = Field(
        description="Assessed directional bias: UP, DOWN, or WAIT if evidence is insufficient or conflicting"
    )
    data_quality: DataQualityEnum = Field(
        description="Visual quality of the chart crop: clear, limited, or unreadable"
    )
    trend: TrendEnum = Field(
        description="Identified market structure/trend: up, down, range, or unclear"
    )
    patterns: List[PatternItem] = Field(
        default_factory=list,
        description="Visible completed or forming patterns with structural evidence"
    )
    support_resistance: Optional[SupportResistanceItem] = Field(
        default=None,
        description="Approximate visible horizontal or dynamic levels"
    )
    reasoning: str = Field(
        description="Concise technical explanation based purely on visible candles"
    )
    entry_condition: Optional[str] = Field(
        default=None,
        description="Specific technical price/candle condition required before any theoretical entry"
    )
    invalidation_condition: Optional[str] = Field(
        default=None,
        description="Condition that invalidates this assessment thesis"
    )
    limitations: str = Field(
        description="Missing context, OTC noise, absence of volume, or visual ambiguity"
    )

# -----------------------------------------------------------------------------
# API Request / Response Schemas
# -----------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    image_base64: str = Field(description="Base64 encoded cropped screenshot (JPEG/PNG/WEBP)")
    asset: str = Field(default="EUR/USD", description="Asset or market pair name")
    timeframe: str = Field(default="1m", description="Candle timeframe e.g. 5s, 1m, 5m")
    observation_duration: str = Field(default="1m", description="Selected demo observation duration")
    capture_timestamp: str = Field(description="ISO 8601 UTC timestamp of client capture")
    session_id: str = Field(description="Unique identifier for the current capture session")

class AnalyzeResponse(BaseModel):
    id: str
    session_id: str
    capture_timestamp: str
    response_timestamp: str
    asset: str
    timeframe: str
    observation_duration: str
    screenshot_age_seconds: float
    model: str
    strategy_version: str
    analysis: AIChartAnalysis
    is_mock: bool
    is_stale: bool

class TradeOutcomeEnum(str, Enum):
    WIN = "WIN"
    LOSS = "LOSS"
    DRAW = "DRAW"
    SKIPPED = "SKIPPED"
    UNRESOLVED = "UNRESOLVED"

class TradeCreate(BaseModel):
    assessment_id: Optional[str] = None
    session_id: Optional[str] = None
    asset: str = "EUR/USD"
    timeframe: str = "1m"
    observation_duration: str = "1m"
    was_entered: bool = True
    direction: str = Field(description="Actual trade direction: UP or DOWN")
    entry_price: Optional[float] = None
    entry_time: Optional[str] = None
    expiry_time: Optional[str] = None
    stake: float = 10.0
    settlement_amount: float = 0.0
    outcome: TradeOutcomeEnum = TradeOutcomeEnum.UNRESOLVED
    notes: Optional[str] = None
    is_mock: bool = False

class TradeUpdate(BaseModel):
    outcome: Optional[TradeOutcomeEnum] = None
    settlement_amount: Optional[float] = None
    notes: Optional[str] = None

class SystemConfigResponse(BaseModel):
    mock_mode: bool
    model: str
    strategy_version: str
    capture_interval_seconds: int
    max_screenshot_age_seconds: int
    is_key_configured: bool

