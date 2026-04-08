"""
regime_pipeline.py
──────────────────
Single entry point that chains Phases 1–5.
No route handler should import individual services directly.

Provides:
  • run_current_pipeline()     → full JSON for latest date
  • run_historical_pipeline()  → list[dict] for every date (with filtering)
  • run_summary_pipeline()     → distribution + streak stats
"""

from __future__ import annotations

import time
import traceback
from datetime import datetime
from typing import Optional

import pandas as pd

from services.data_merge_service import get_master_dataset
from services.signals_engine import compute_signals_latest, compute_signals_historical
from services.scoring_engine import compute_scores, compute_scores_historical
from services.regime_service import (
    classify_regime, classify_regime_historical, get_regime_summary,
)
from services.allocation_service import (
    get_allocation, ALLOCATION_MAP,
)
from services.fedwatch_service import estimate_fedwatch_probabilities
from services.calendar_service import next_macro_releases


# ─── in-memory cache for historical pipeline ─────────────────────────

_cache: dict = {
    "historical_df": None,
    "timestamp": 0.0,
}
_CACHE_TTL = 3600  # 1 hour


def _safe_num(value) -> float | None:
    if pd.isna(value):
        return None
    return float(value)


def clear_cache():
    """Reset the in-memory historical cache."""
    _cache["historical_df"] = None
    _cache["timestamp"] = 0.0


def _get_historical_df() -> pd.DataFrame:
    """Return cached historical regime DataFrame, recomputing if stale."""
    now = time.time()
    if (_cache["historical_df"] is not None
            and (now - _cache["timestamp"]) < _CACHE_TTL):
        # Recompute early if master dataset advanced beyond cached history.
        try:
            master_latest = pd.Timestamp(get_master_dataset().index.max()).normalize()
            cache_latest = pd.Timestamp(_cache["historical_df"].index.max()).normalize()
            if cache_latest >= master_latest:
                return _cache["historical_df"]
        except Exception:
            # Fall through to recompute if any date inspection fails.
            pass

    master = get_master_dataset()
    hist_sigs = compute_signals_historical(master)
    hist_scores = compute_scores_historical(hist_sigs)
    hist_regimes = classify_regime_historical(hist_scores)

    _cache["historical_df"] = hist_regimes
    _cache["timestamp"] = now
    return hist_regimes


# ─── current pipeline ────────────────────────────────────────────────

def run_current_pipeline() -> dict:
    """
    Run the full chain for the latest data point.

    Returns combined JSON with regime, allocation, signals, and scores.
    """
    try:
        master = get_master_dataset()
        latest = master.iloc[-1]
        signals = compute_signals_latest(master)
        scores = compute_scores(signals)
        fedwatch = estimate_fedwatch_probabilities(master)
        cut_p = float(fedwatch["next_3m"]["cut"])
        hike_p = float(fedwatch["next_3m"]["hike"])
        # Portfolio scoring hook: less cut probability implies stickier inflation risk.
        if cut_p < 0.40:
            scores["inflation_score"] = min(scores["inflation_score"] + 1, 3)
        elif cut_p > 0.60 and hike_p < 0.20:
            scores["inflation_score"] = max(scores["inflation_score"] - 1, 0)
        scores["total_score"] = (
            scores["growth_score"]
            + scores["inflation_score"]
            + scores["financial_score"]
            + scores["market_score"]
        )
        regime = classify_regime(scores)
        alloc = get_allocation(regime["regime"])

        return {
            "date": signals["date"],
            "regime": regime["regime"],
            "regime_color": regime["regime_color"],
            "risk_level": regime["risk_level"],
            "probability": regime["probability"],
            "total_score": regime["total_score"],
            "breakdown": regime["breakdown"],
            "allocation": alloc["allocation"],
            "etf_mapping": alloc["etf_mapping"],
            "signals": signals,
            "fedwatch": fedwatch,
            "macro_release_calendar": next_macro_releases(),
            "global_macro": {
                "fed_funds_3m_change": _safe_num(latest.get("fed_funds_3m_change")),
                "real_rate_10y": _safe_num(latest.get("real_rate_10y")),
                "cpi_yoy": _safe_num(latest.get("cpi_yoy")),
                "dxy_3m_pct_change": _safe_num(signals["financial"].get("dxy_3m_pct_change")),
                "boj_10y_yield": _safe_num(latest.get("boj_10y_yield")),
                "ecb_policy_rate": _safe_num(latest.get("ecb_policy_rate")),
                "uk_10y_gilt_yield": _safe_num(latest.get("uk_10y_gilt_yield")),
            },
        }
    except Exception as e:
        traceback.print_exc()
        return {
            "error": str(e),
            "date": str(datetime.now().date()),
            "regime": "Neutral",
            "regime_color": "#eab308",
            "risk_level": 2,
            "probability": 0.5,
            "total_score": -1,
            "breakdown": {
                "growth": {"score": 0, "max": 3},
                "inflation": {"score": 0, "max": 3},
                "financial": {"score": 0, "max": 3},
                "market": {"score": 0, "max": 4},
            },
            "allocation": ALLOCATION_MAP["Neutral"],
            "etf_mapping": {"equities": "SPY", "bonds": "TLT", "gold": "GLD"},
            "signals": {},
            "fedwatch": {"source": "fallback", "as_of": str(datetime.now().date()), "next_3m": {"cut": 0.33, "hold": 0.34, "hike": 0.33}},
            "macro_release_calendar": {"as_of": str(datetime.now().date()), "releases": []},
            "global_macro": {
                "fed_funds_3m_change": None,
                "real_rate_10y": None,
                "cpi_yoy": None,
                "dxy_3m_pct_change": None,
                "boj_10y_yield": None,
                "ecb_policy_rate": None,
                "uk_10y_gilt_yield": None,
            },
        }


# ─── historical pipeline ─────────────────────────────────────────────

def run_historical_pipeline(
    start: Optional[str] = None,
    end: Optional[str] = None,
    sample: Optional[str] = None,
) -> list[dict]:
    """
    Run the full chain for every date in the master dataset.

    Parameters
    ----------
    start : optional start date filter (YYYY-MM-DD inclusive)
    end   : optional end date filter (YYYY-MM-DD inclusive)
    sample: 'monthly' to downsample to first business day of each month

    Returns
    -------
    list of dicts, one per date.
    """
    df = _get_historical_df()

    # Date filtering
    if start:
        df = df[df.index >= pd.Timestamp(start)]
    if end:
        df = df[df.index <= pd.Timestamp(end)]

    # Downsampling
    if sample == "monthly":
        df = df.resample("MS").first().dropna(subset=["regime"])

    records = []
    for date, row in df.iterrows():
        records.append({
            "date": str(pd.Timestamp(date).date()),  # type: ignore[arg-type]
            "regime": row["regime"],
            "regime_color": row["regime_color"],
            "risk_level": int(row["risk_level"]),
            "probability": float(row["probability"]),
            "total_score": int(row["total_score"]),
            "growth_score": int(row["growth_score"]),
            "inflation_score": int(row["inflation_score"]),
            "financial_score": int(row["financial_score"]),
            "market_score": int(row["market_score"]),
        })

    return records


# ─── summary pipeline ────────────────────────────────────────────────

def run_summary_pipeline() -> dict:
    """Return regime distribution stats and current streak."""
    df = _get_historical_df()
    return get_regime_summary(df)


# ─── CLI ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import json

    print("=== CURRENT PIPELINE ===")
    current = run_current_pipeline()
    print(json.dumps(current, indent=2))

    print("\n=== HISTORICAL PIPELINE (full) ===")
    hist = run_historical_pipeline()
    print(f"  {len(hist)} records")
    print(f"  First: {hist[0]['date']}  Last: {hist[-1]['date']}")

    print("\n=== HISTORICAL PIPELINE (filtered) ===")
    filtered = run_historical_pipeline(start="2020-01-01", end="2020-12-31")
    print(f"  {len(filtered)} records (2020 only)")

    print("\n=== HISTORICAL PIPELINE (monthly sample) ===")
    monthly = run_historical_pipeline(sample="monthly")
    print(f"  {len(monthly)} records (monthly)")

    print("\n=== SUMMARY PIPELINE ===")
    summary = run_summary_pipeline()
    print(json.dumps(summary, indent=2))

    print("\n=== CACHE TEST ===")
    t0 = time.time()
    _ = run_historical_pipeline()
    t1 = time.time()
    print(f"  Second call (cached): {(t1-t0)*1000:.1f}ms")
