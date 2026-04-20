"""
regime_snapshot_service.py
--------------------------
Provides `get_regime_snapshot()` returning the full RegimeData payload
expected by the aarya-designed frontend.

Uses the master dataset (macro + market prices) and computes
market features (momentum, drawdown) on the fly.
"""

import pandas as pd
from services.data_merge_service import get_master_dataset


def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def _trend(current: float, prev: float) -> str:
    if current > prev * 1.005:
        return "up"
    if current < prev * 0.995:
        return "down"
    return "flat"


def _status(value: float, thresholds: dict) -> str:
    for label, check in thresholds.items():
        if check(value):
            return label
    return "NORMAL"


def _compute_growth_score(row: dict, prev: dict) -> float:
    score = 0.0
    unemp = row.get("unemployment", 5.0)
    score += _clamp((5.0 - unemp) / 1.5, 0, 1)
    yc = row.get("yield_curve_10y2y", 0.0)
    score += _clamp((yc + 0.5) / 1.0, 0, 1)
    indpro = row.get("indpro_yoy", 0.0)
    score += _clamp(indpro / 3.0, 0, 1)
    payrolls = row.get("payrolls_mom", 0.0)
    score += _clamp(payrolls / 200.0, 0, 1)
    return round(_clamp(score, 0, 4), 2)


def _compute_inflation_score(row: dict) -> float:
    score = 0.0
    cpi = row.get("cpi_yoy", 2.0)
    score += _clamp((cpi - 2.0) / 4.0, 0, 2)
    pce = row.get("core_pce_yoy", 2.0)
    score += _clamp((pce - 2.0) / 2.0, 0, 2)
    return round(_clamp(score, 0, 4), 2)


def _compute_financial_score(row: dict) -> float:
    score = 0.0
    hy = row.get("credit_spread_hy", 4.0)
    score += _clamp((6.0 - hy) / 4.0, 0, 1)
    real_rate = row.get("real_rate_10y", 1.5)
    score += _clamp((2.5 - real_rate) / 2.5, 0, 1)
    nfci = row.get("financial_cond", 0.0)
    score += _clamp((-nfci + 0.5) / 1.0, 0, 1)
    ig = row.get("credit_spread_ig", 1.0)
    score += _clamp((1.5 - ig) / 0.7, 0, 1)
    return round(_clamp(score, 0, 4), 2)


def _compute_market_risk_score(row: dict) -> float:
    score = 0.0
    vix = row.get("vix", 20.0)
    score += _clamp((30.0 - vix) / 15.0, 0, 1)
    drawdown = row.get("sp500_drawdown", 0.0)
    score += _clamp((drawdown + 0.20) / 0.20, 0, 1)
    mom1 = row.get("sp500_1m_mom", 0.0)
    score += _clamp(mom1 / 0.03, 0, 1)
    mom3 = row.get("sp500_3m_mom", 0.0)
    score += _clamp(mom3 / 0.05, 0, 1)
    return round(_clamp(score, 0, 4), 2)


def _classify(growth: float, inflation: float, financial: float, market: float) -> tuple[str, float]:
    composite = growth + financial + market - (inflation * 0.5)
    if composite >= 8.5:
        return "Risk-On", round(_clamp(0.45 + (composite - 8.5) / 20, 0.45, 0.90), 2)
    if composite >= 5.5:
        return "Expansion", round(_clamp(0.40 + (composite - 5.5) / 20, 0.40, 0.65), 2)
    if composite >= 3.0:
        return "Neutral", 0.45
    return "Risk-Off", round(_clamp(0.40 + (3.0 - composite) / 10, 0.40, 0.80), 2)


def _fmt_pct(val: float, decimals: int = 1) -> str:
    return f"{val:.{decimals}f}%"


def _fmt_val(val: float, decimals: int = 2) -> str:
    return f"{val:.{decimals}f}"


def _enrich_market_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute sp500 momentum and drawdown from raw prices in master dataset."""
    out = df.copy()
    if "sp500" in out.columns:
        out["sp500_1m_mom"] = out["sp500"].pct_change(21)
        out["sp500_3m_mom"] = out["sp500"].pct_change(63)
        rolling_max = out["sp500"].cummax()
        out["sp500_drawdown"] = (out["sp500"] - rolling_max) / rolling_max
    return out


def get_regime_snapshot() -> dict:
    master = get_master_dataset()
    master = _enrich_market_features(master)

    # Get last 2 rows for trend computation
    tail = master.tail(2)
    m_row = tail.iloc[-1].to_dict()
    m_prev = tail.iloc[-2].to_dict() if len(tail) > 1 else m_row

    growth = _compute_growth_score(m_row, m_prev)
    inflation = _compute_inflation_score(m_row)
    financial = _compute_financial_score(m_row)
    market_risk = _compute_market_risk_score(m_row)
    total = round(growth + inflation + financial + market_risk, 2)

    regime, probability = _classify(growth, inflation, financial, market_risk)

    updated_at = str(master.index[-1].date()) if hasattr(master.index[-1], "date") else str(master.index[-1])

    # --- Growth metrics rows ---
    unemp = m_row.get("unemployment", 0)
    yc = m_row.get("yield_curve_10y2y", 0)
    indpro = m_row.get("indpro_yoy", 0)
    payrolls = m_row.get("payrolls_mom", 0)
    fed_funds = m_row.get("fed_funds", 0)

    growth_metrics = [
        {
            "metric": "Unemployment Rate",
            "value": _fmt_pct(unemp),
            "trend": _trend(unemp, m_prev.get("unemployment", unemp)),
            "status": _status(unemp, {"CRITICAL": lambda v: v > 7, "WARNING": lambda v: v > 5.5}),
        },
        {
            "metric": "Fed Funds Rate",
            "value": _fmt_pct(fed_funds),
            "trend": _trend(fed_funds, m_prev.get("fed_funds", fed_funds)),
            "status": _status(fed_funds, {"WARNING": lambda v: v > 5, "NEUTRAL": lambda v: v > 3}),
        },
        {
            "metric": "Yield Curve (10Y-2Y)",
            "value": _fmt_val(yc),
            "trend": _trend(yc, m_prev.get("yield_curve_10y2y", yc)),
            "status": _status(yc, {"CRITICAL": lambda v: v < -0.5, "WARNING": lambda v: v < 0}),
        },
        {
            "metric": "Industrial Production YoY",
            "value": _fmt_pct(indpro),
            "trend": _trend(indpro, m_prev.get("indpro_yoy", indpro)),
            "status": _status(indpro, {"WARNING": lambda v: v < 0, "NEUTRAL": lambda v: v < 1}),
        },
        {
            "metric": "Nonfarm Payrolls MoM",
            "value": f"{int(payrolls):,}k",
            "trend": _trend(payrolls, m_prev.get("payrolls_mom", payrolls)),
            "status": _status(payrolls, {"CRITICAL": lambda v: v < 0, "WARNING": lambda v: v < 50}),
        },
    ]

    # --- Inflation metrics rows ---
    cpi_yoy = m_row.get("cpi_yoy", 0)
    core_pce_yoy = m_row.get("core_pce_yoy", 0)
    core_cpi_yoy = m_row.get("core_cpi_yoy", 0)
    ppi_yoy = m_row.get("ppi_yoy", 0)

    inflation_metrics = [
        {
            "metric": "CPI YoY",
            "value": _fmt_pct(cpi_yoy),
            "trend": _trend(cpi_yoy, m_prev.get("cpi_yoy", cpi_yoy)),
            "status": _status(cpi_yoy, {"CRITICAL": lambda v: v > 5, "WARNING": lambda v: v > 3.5, "NEUTRAL": lambda v: v > 2.5}),
        },
        {
            "metric": "Core CPI YoY",
            "value": _fmt_pct(core_cpi_yoy),
            "trend": _trend(core_cpi_yoy, m_prev.get("core_cpi_yoy", core_cpi_yoy)),
            "status": _status(core_cpi_yoy, {"CRITICAL": lambda v: v > 5, "WARNING": lambda v: v > 3.5, "NEUTRAL": lambda v: v > 2.5}),
        },
        {
            "metric": "Core PCE YoY",
            "value": _fmt_pct(core_pce_yoy),
            "trend": _trend(core_pce_yoy, m_prev.get("core_pce_yoy", core_pce_yoy)),
            "status": _status(core_pce_yoy, {"CRITICAL": lambda v: v > 4, "WARNING": lambda v: v > 3, "NEUTRAL": lambda v: v > 2.5}),
        },
        {
            "metric": "PPI YoY",
            "value": _fmt_pct(ppi_yoy),
            "trend": _trend(ppi_yoy, m_prev.get("ppi_yoy", ppi_yoy)),
            "status": _status(ppi_yoy, {"CRITICAL": lambda v: v > 6, "WARNING": lambda v: v > 4, "NEUTRAL": lambda v: v > 2}),
        },
    ]

    # --- Financial conditions rows ---
    hy_spread = m_row.get("credit_spread_hy", 0)
    ig_spread = m_row.get("credit_spread_ig", 0)
    real_rate = m_row.get("real_rate_10y", 0)
    nfci = m_row.get("financial_cond", 0)

    financial_metrics = [
        {
            "metric": "HY Credit Spread (OAS)",
            "value": f"{hy_spread:.2f}%",
            "trend": _trend(hy_spread, m_prev.get("credit_spread_hy", hy_spread)),
            "status": _status(hy_spread, {"CRITICAL": lambda v: v > 8, "WARNING": lambda v: v > 5, "NEUTRAL": lambda v: v > 3}),
        },
        {
            "metric": "IG Credit Spread (OAS)",
            "value": f"{ig_spread:.2f}%",
            "trend": _trend(ig_spread, m_prev.get("credit_spread_ig", ig_spread)),
            "status": _status(ig_spread, {"WARNING": lambda v: v > 2, "NEUTRAL": lambda v: v > 1.2}),
        },
        {
            "metric": "Real Rates (10Y)",
            "value": _fmt_pct(real_rate),
            "trend": _trend(real_rate, m_prev.get("real_rate_10y", real_rate)),
            "status": _status(real_rate, {"WARNING": lambda v: v > 2.5, "NEUTRAL": lambda v: v > 1.5}),
        },
        {
            "metric": "Chicago NFCI",
            "value": _fmt_val(nfci),
            "trend": _trend(nfci, m_prev.get("financial_cond", nfci)),
            "status": _status(nfci, {"CRITICAL": lambda v: v > 0.5, "WARNING": lambda v: v > 0, "NEUTRAL": lambda v: v > -0.3}),
        },
    ]

    # --- Market risk rows ---
    vix = m_row.get("vix", 0)
    drawdown = m_row.get("sp500_drawdown", 0)
    mom1 = m_row.get("sp500_1m_mom", 0)
    mom3 = m_row.get("sp500_3m_mom", 0)

    market_metrics = [
        {
            "metric": "VIX Index",
            "value": _fmt_val(vix),
            "trend": _trend(vix, m_prev.get("vix", vix)),
            "status": _status(vix, {"CRITICAL": lambda v: v > 30, "WARNING": lambda v: v > 20, "NEUTRAL": lambda v: v > 15}),
        },
        {
            "metric": "S&P 500 Drawdown",
            "value": _fmt_pct(drawdown * 100),
            "trend": _trend(drawdown, m_prev.get("sp500_drawdown", drawdown)),
            "status": _status(drawdown, {"CRITICAL": lambda v: v < -0.20, "WARNING": lambda v: v < -0.10, "NEUTRAL": lambda v: v < -0.05}),
        },
        {
            "metric": "S&P 500 1M Return",
            "value": _fmt_pct(mom1 * 100),
            "trend": _trend(mom1, m_prev.get("sp500_1m_mom", mom1)),
            "status": _status(mom1, {"CRITICAL": lambda v: v < -0.10, "WARNING": lambda v: v < -0.03, "NEUTRAL": lambda v: v < 0}),
        },
        {
            "metric": "S&P 500 3M Return",
            "value": _fmt_pct(mom3 * 100),
            "trend": _trend(mom3, m_prev.get("sp500_3m_mom", mom3)),
            "status": _status(mom3, {"CRITICAL": lambda v: v < -0.15, "WARNING": lambda v: v < -0.05, "NEUTRAL": lambda v: v < 0}),
        },
    ]

    # --- Portfolio allocation based on regime ---
    if regime == "Risk-On":
        allocation = {"equities": 0.65, "bonds": 0.25, "alternatives": 0.10}
    elif regime == "Expansion":
        allocation = {"equities": 0.55, "bonds": 0.35, "alternatives": 0.10}
    elif regime == "Neutral":
        allocation = {"equities": 0.45, "bonds": 0.45, "alternatives": 0.10}
    else:
        allocation = {"equities": 0.25, "bonds": 0.60, "alternatives": 0.15}

    return {
        "regime": regime,
        "probability": probability,
        "total_score": total,
        "max_score": 10.0,
        "scores": {
            "growth": growth,
            "inflation": inflation,
            "financial_conditions": financial,
            "market_risk": market_risk,
        },
        "growth_metrics": growth_metrics,
        "inflation_metrics": inflation_metrics,
        "financial_metrics": financial_metrics,
        "market_metrics": market_metrics,
        "allocation": allocation,
        "updated_at": updated_at,
    }
