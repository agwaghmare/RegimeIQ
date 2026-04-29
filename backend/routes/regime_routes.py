"""
Regime API routes.
All data flows through regime_pipeline – no direct service imports.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from services.regime_pipeline import (
    run_current_pipeline,
    run_historical_pipeline,
    run_summary_pipeline,
    run_forecast_pipeline,
    run_snapshot_pipeline,
    _get_historical_df,
)
from services.regime_snapshot_service import get_regime_snapshot
from services.signals_engine import compute_signals_latest
from services.data_merge_service import get_master_dataset
from services.allocation_service import get_allocation_historical, get_allocation_transitions
from schema.regime import (
    RegimeCurrentResponse,
    RegimeHistoryResponse,
    RegimeSummaryResponse,
    SignalsResponse,
)
import pandas as pd
import numpy as np

router = APIRouter()


@router.get(
    "/",
    summary="Full regime snapshot for dashboard frontend",
)
def get_regime_dashboard():
    try:
        return get_regime_snapshot()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=f"Cached data not found: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/current",
    summary="Current regime classification with allocation and signals",
)
def get_current_regime():
    return run_current_pipeline()


@router.get(
    "/forecast",
    summary="Regime forecast and Markov transition probabilities",
)
def get_forecast():
    return run_forecast_pipeline()


@router.get(
    "/history",
    summary="Historical regime classifications",
)
def get_regime_history(
    start: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    sample: Optional[str] = Query(None, description="'monthly' to downsample"),
):
    data = run_historical_pipeline(start=start, end=end, sample=sample)
    return {"count": len(data), "data": data}


@router.get(
    "/summary",
    response_model=RegimeSummaryResponse,
    summary="Regime distribution and current streak",
)
def get_regime_summary_endpoint():
    return run_summary_pipeline()


@router.get(
    "/signals",
    response_model=SignalsResponse,
    summary="Current signal values across all groups",
)
def get_current_signals():
    master = get_master_dataset()
    return compute_signals_latest(master)


@router.get(
    "/historical-insights",
    summary="Historical model validation dashboard payload",
)
def get_historical_insights():
    hist = _get_historical_df().copy()
    master = get_master_dataset().copy()

    alloc_hist = get_allocation_historical(hist)
    transitions = get_allocation_transitions(hist)

    # Timeline (monthly compressed)
    timeline_df = hist.resample("MS").first().dropna(subset=["regime"])
    timeline = [
        {
            "date": str(pd.Timestamp(dt).date()),
            "regime": row["regime"],
            "total_score": round(float(row["total_score"]), 2),
        }
        for dt, row in timeline_df.iterrows()
    ]

    events = [
        {"date": "2008-09-15", "event": "2008 financial crisis", "window_days": 90, "target_score": 8.5},
        {"date": "2020-03-01", "event": "COVID crash", "window_days": 90, "target_score": 7.5},
        {"date": "2022-03-16", "event": "Rate hike cycle", "window_days": 120, "target_score": 6.0},
    ]
    event_overlays = []
    for e in events:
        center = pd.Timestamp(e["date"])
        w = int(e["window_days"])
        window = hist[(hist.index >= center - pd.Timedelta(days=w)) & (hist.index <= center + pd.Timedelta(days=w))]
        if window.empty:
            idx = int(hist.index.get_indexer(pd.DatetimeIndex([e["date"]]), method="nearest")[0])
            row = hist.iloc[idx]
            detected_date = str(pd.Timestamp(hist.index[idx]).date())
        else:
            # Pick row closest to requested target score inside event window.
            target = int(e["target_score"])
            exact = window[window["total_score"] == target]
            if not exact.empty:
                # If multiple exact hits, choose one nearest to input event date.
                sel = min(exact.index, key=lambda dt: abs((pd.Timestamp(dt) - center).days))
            else:
                sel = (window["total_score"] - target).abs().idxmin()
            row = window.loc[sel]
            detected_date = str(pd.Timestamp(sel).date())
        event_overlays.append({
            "event": e["event"],
            "input_date": e["date"],
            "detected_date": detected_date,
            "regime": row["regime"],
            "total_score": round(float(row["total_score"]), 2),
        })

    # Avg duration by regime from transition gaps
    durations = []
    prev_idx = 0
    for i in range(1, len(hist)):
        if hist["regime"].iloc[i] != hist["regime"].iloc[i - 1]:
            durations.append((hist["regime"].iloc[i - 1], i - prev_idx))
            prev_idx = i
    if len(hist) > 0:
        durations.append((hist["regime"].iloc[-1], len(hist) - prev_idx))
    avg_duration = {}
    for rg in ["Risk-On", "Neutral", "Risk-Off", "Crisis"]:
        vals = [d for r, d in durations if r == rg]
        avg_duration[rg] = round(float(np.mean(vals)), 1) if vals else 0.0

    # Allocation history (monthly)
    alloc_monthly = alloc_hist.resample("MS").first().dropna(subset=["regime"])
    allocation_history = [
        {
            "date": str(pd.Timestamp(dt).date()),
            "regime": row["regime"],
            "equities": float(row["alloc_equities"]),
            "bonds": float(row["alloc_bonds"]),
            "alternatives": float(row["alloc_alternatives"]),
        }
        for dt, row in alloc_monthly.iterrows()
    ]

    # Performance simulation: model allocation vs SPY
    cols_ok = all(c in master.columns for c in ["sp500", "tlt", "gld"])
    perf = {}
    if cols_ok:
        joined = master.join(alloc_hist[["alloc_equities", "alloc_bonds", "alloc_alternatives"]], how="inner")
        rets = joined[["sp500", "tlt", "gld"]].pct_change().fillna(0.0)
        model_r = (
            joined["alloc_equities"] * rets["sp500"]
            + joined["alloc_bonds"] * rets["tlt"]
            + joined["alloc_alternatives"] * rets["gld"]
        )
        spy_r = rets["sp500"]
        model_curve = (1 + model_r).cumprod()
        spy_curve = (1 + spy_r).cumprod()

        def _max_dd(curve: pd.Series) -> float:
            roll_max = curve.cummax()
            dd = (curve / roll_max) - 1
            return float(dd.min())

        def _sharpe(r: pd.Series) -> float:
            s = r.std()
            if s == 0 or pd.isna(s):
                return 0.0
            return float((r.mean() / s) * np.sqrt(252))

        perf = {
            "model_return": float(model_curve.iloc[-1] - 1),
            "spy_return": float(spy_curve.iloc[-1] - 1),
            "model_max_drawdown": _max_dd(model_curve),
            "spy_max_drawdown": _max_dd(spy_curve),
            "model_sharpe": _sharpe(model_r),
            "spy_sharpe": _sharpe(spy_r),
        }

    return {
        "timeline": timeline,
        "event_overlays": event_overlays,
        "transitions": transitions,
        "avg_duration_days": avg_duration,
        "allocation_history": allocation_history,
        "performance_simulation": perf,
    }


@router.get(
    "/risk-lab",
    summary="Current risk decomposition payload",
)
def get_risk_lab():
    current = run_current_pipeline()
    sig = current.get("signals", {})
    m = sig.get("market", {})
    f = sig.get("financial", {})
    i = sig.get("inflation", {})
    g = sig.get("growth", {})

    stress = {
        "yield_curve_inverted": bool(g.get("yield_curve_inverted", False)),
        "vix_above_25": bool(m.get("vix_above_25", False)),
        "credit_spreads_widening": bool(f.get("credit_spread_widening", False)),
    }

    vix = m.get("vix_level")
    vol_regime = "low"
    if isinstance(vix, (int, float)):
        if vix >= 30:
            vol_regime = "high"
        elif vix >= 20:
            vol_regime = "elevated"

    drawdown = float(m.get("sp500_drawdown") or 0.0)
    crash_prob = min(0.95, max(0.05, float(current.get("total_score", 0)) / 10.0 + (0.15 if vol_regime == "high" else 0.0)))

    drivers = []
    if bool(f.get("credit_spread_widening")):
        drivers.append("Credit stress is rising")
    if bool(m.get("momentum_negative")):
        drivers.append("Equity momentum is negative")
    if bool(m.get("vix_above_25")):
        drivers.append("Implied volatility is elevated")
    if bool(i.get("cpi_trend_rising")):
        drivers.append("Inflation/policy trend remains restrictive")

    return {
        "breakdown": current.get("breakdown", {}),
        "stress_indicators": stress,
        "volatility_regime": vol_regime,
        "current_drawdown": drawdown,
        "crash_probability": round(crash_prob, 4),
        "risk_drivers": drivers,
    }


@router.get(
    "/snapshot",
    summary="Full regime dashboard as of a historical date (no look-ahead)",
)
def get_regime_snapshot_by_date(date: str = Query(..., description="Target date YYYY-MM-DD")):
    try:
        return run_snapshot_pipeline(date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
