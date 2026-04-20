"""
Pydantic response models for the RegimeIQ API.
Provides type safety, validation, and auto-generated OpenAPI docs.
"""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


# ─── shared building blocks ──────────────────────────────────────────

class ScoreDetail(BaseModel):
    score: int
    max: int


class BreakdownResponse(BaseModel):
    growth: ScoreDetail
    inflation: ScoreDetail
    financial: ScoreDetail
    market: ScoreDetail


class AllocationWeights(BaseModel):
    equities: float
    bonds: float
    gold: float


class EtfMapping(BaseModel):
    equities: str
    bonds: str
    gold: str


# ─── signal sub-models ───────────────────────────────────────────────

class GrowthSignals(BaseModel):
    unemp_3m_change: Optional[float] = None
    unemp_rising: bool
    yield_spread: Optional[float] = None
    yield_curve_inverted: bool
    indpro_yoy: Optional[float] = None
    indpro_negative: bool
    pmi_value: Optional[float] = None
    pmi_below_50: bool


class InflationSignals(BaseModel):
    cpi_yoy: Optional[float] = None
    cpi_above_3: bool
    cpi_3m_change: Optional[float] = None
    fed_funds_3m_change: Optional[float] = None
    cpi_trend_rising: bool
    core_cpi_yoy: Optional[float] = None
    real_rate: Optional[float] = None
    real_rate_negative: bool


class FinancialSignals(BaseModel):
    credit_spread: Optional[float] = None
    credit_spread_3m_change: Optional[float] = None
    credit_spread_3m_pct_change: Optional[float] = None
    credit_spread_widening: bool
    nominal_10y_3m_change: Optional[float] = None
    rate_rising_sharply: bool
    dxy_3m_pct_change: Optional[float] = None
    dollar_strengthening: bool
    nfci: Optional[float] = None


class MarketSignals(BaseModel):
    sp500_6m_momentum: Optional[float] = None
    sp500_12m_momentum: Optional[float] = None
    momentum_negative: bool
    sp500_30d_vol: Optional[float] = None
    vix_level: Optional[float] = None
    vix_1m_change: Optional[float] = None
    vix_above_25: bool
    vix_regime: Optional[str] = None
    sp500_drawdown: Optional[float] = None
    drawdown_severe: bool
    sp500_200ma: Optional[float] = None
    sp500_200ma_distance: Optional[float] = None
    below_200ma: bool


class SignalsResponse(BaseModel):
    date: str
    growth: GrowthSignals
    inflation: InflationSignals
    financial: FinancialSignals
    market: MarketSignals


class GlobalMacroSnapshot(BaseModel):
    fed_funds: Optional[float] = None
    fed_funds_3m_change: Optional[float] = None
    real_rate_10y: Optional[float] = None
    cpi_yoy: Optional[float] = None
    dxy_3m_pct_change: Optional[float] = None
    boj_10y_yield: Optional[float] = None
    ecb_policy_rate: Optional[float] = None
    uk_10y_gilt_yield: Optional[float] = None


class FedWatchNext3M(BaseModel):
    cut: float
    hold: float
    hike: float


class FedWatchResponse(BaseModel):
    source: str
    as_of: str
    next_3m: FedWatchNext3M


class MacroReleaseItem(BaseModel):
    event: str
    date: str


class MacroReleaseCalendar(BaseModel):
    as_of: str
    releases: list[MacroReleaseItem]


# ─── regime endpoints ────────────────────────────────────────────────

class RegimeCurrentResponse(BaseModel):
    date: str
    regime: str
    regime_color: str
    risk_level: int
    probability: float
    total_score: float
    breakdown: BreakdownResponse
    allocation: AllocationWeights
    etf_mapping: EtfMapping
    signals: SignalsResponse
    fedwatch: FedWatchResponse
    macro_release_calendar: MacroReleaseCalendar
    global_macro: GlobalMacroSnapshot


class RegimeHistoryItem(BaseModel):
    date: str
    regime: str
    regime_color: str
    risk_level: int
    probability: float
    total_score: float
    growth_score: int
    inflation_score: int
    financial_score: int
    market_score: int


class RegimeHistoryResponse(BaseModel):
    count: int
    data: list[RegimeHistoryItem]


# ─── summary ─────────────────────────────────────────────────────────

class RegimeDistributionEntry(BaseModel):
    count: int
    pct: float


class CurrentStreak(BaseModel):
    regime: str
    start_date: str
    days: int


class RegimeSummaryResponse(BaseModel):
    total_days: int
    regime_distribution: dict[str, RegimeDistributionEntry]
    current_regime_streak: CurrentStreak


# ─── allocation endpoints ────────────────────────────────────────────

class AllocationCurrentResponse(BaseModel):
    regime: str
    allocation: AllocationWeights
    etf_mapping: EtfMapping


class TransitionItem(BaseModel):
    date: str
    from_regime: Optional[str] = None
    to_regime: str
    new_allocation: AllocationWeights


class TransitionsResponse(BaseModel):
    count: int
    data: list[TransitionItem]


# ─── scores endpoint ─────────────────────────────────────────────────

class ScoresResponse(BaseModel):
    total_score: float
    breakdown: BreakdownResponse
