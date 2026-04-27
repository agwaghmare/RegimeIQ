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
        # FedWatch hook: nudge total_score based on policy path expectations.
        # +0.7 ≈ equivalent of +1 raw flag on the sigmoid-scaled 0-10 range.
        if cut_p < 0.40:
            scores["inflation_score"] = min(scores["inflation_score"] + 1, 3)
            scores["total_score"] = round(min(scores["total_score"] + 0.7, 10.0), 2)
        elif cut_p > 0.60 and hike_p < 0.20:
            scores["inflation_score"] = max(scores["inflation_score"] - 1, 0)
            scores["total_score"] = round(max(scores["total_score"] - 0.7, 0.0), 2)
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
            "signals": {
                "date": str(datetime.now().date()),
                "growth": {},
                "inflation": {},
                "financial": {},
                "market": {},
            },
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


# ─── snapshot pipeline (as-of date) ───────────────────────────────────

def run_snapshot_pipeline(date: str) -> dict:
    """
    Run the full pipeline AS OF a specific historical date.

    Slices the master dataset up to (and including) the given date so rolling
    metrics use only information available on that day. Matches
    run_current_pipeline() fedwatch adjustments.
    """
    master = get_master_dataset()
    target = pd.Timestamp(date)

    subset = master[master.index <= target]
    if subset.empty:
        raise ValueError(
            f"No data available on or before {date}. Earliest available: {master.index[0].date()}"
        )

    latest = subset.iloc[-1]
    signals = compute_signals_latest(subset)
    scores = compute_scores(signals)
    fedwatch = estimate_fedwatch_probabilities(subset)

    cut_p = float(fedwatch["next_3m"]["cut"])
    hike_p = float(fedwatch["next_3m"]["hike"])
    if cut_p < 0.40:
        scores["inflation_score"] = min(scores["inflation_score"] + 1, 3)
        scores["total_score"] = round(min(scores["total_score"] + 0.7, 10.0), 2)
    elif cut_p > 0.60 and hike_p < 0.20:
        scores["inflation_score"] = max(scores["inflation_score"] - 1, 0)
        scores["total_score"] = round(max(scores["total_score"] - 0.7, 0.0), 2)

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
            "total_score": round(float(row["total_score"]), 2),
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


# ─── ML score trajectory forecast ────────────────────────────────────

def _compute_score_forecast() -> list:
    """
    Train a Ridge AR model on full monthly history and return
    T+1M, T+2M, T+3M score predictions with ±1-sigma confidence bounds.

    Features: AR lags at 1, 2, 3, 6, 12 months + one-hot regime (9 features).
    Returns list of 3 dicts: [{date, predicted_score, lo, hi}, ...]
    """
    from sklearn.linear_model import Ridge
    import numpy as np

    LAGS = [1, 2, 3, 6, 12]
    REGIMES = ["Risk-On", "Neutral", "Risk-Off", "Crisis"]

    df = _get_historical_df()
    monthly = df.resample("ME").last().dropna(subset=["total_score", "regime"])
    scores = monthly["total_score"].astype(float)
    regimes = monthly["regime"]

    if len(scores) < max(LAGS) + 5:
        return []

    rows, targets = [], []
    for i in range(max(LAGS), len(scores)):
        feature_row = [float(scores.iloc[i - lag]) for lag in LAGS]
        current_regime = regimes.iloc[i]
        feature_row += [1.0 if current_regime == r else 0.0 for r in REGIMES]
        rows.append(feature_row)
        targets.append(float(scores.iloc[i]))

    X, y = np.array(rows), np.array(targets)
    model = Ridge(alpha=1.0)
    model.fit(X, y)
    sigma = float(np.std(y - model.predict(X)))

    last_date = monthly.index[-1]
    current_history = list(scores.values)
    current_regime_label = regimes.iloc[-1]
    predictions = []

    for step in range(1, 4):
        n = len(current_history)
        feature_row = [current_history[n - lag] for lag in LAGS]
        feature_row += [1.0 if current_regime_label == r else 0.0 for r in REGIMES]
        pred = float(np.clip(model.predict(np.array([feature_row]))[0], 0.0, 10.0))
        forecast_date = last_date + pd.DateOffset(months=step)
        predictions.append({
            "date": str(forecast_date.date()),
            "predicted_score": round(pred, 2),
            "lo": round(float(np.clip(pred - sigma, 0.0, 10.0)), 2),
            "hi": round(float(np.clip(pred + sigma, 0.0, 10.0)), 2),
        })
        current_history.append(pred)

    return predictions


# ─── forecast pipeline ───────────────────────────────────────────────

def run_forecast_pipeline() -> dict:
    """
    Derive forward-looking regime probabilities from Markov chain analysis.

    Returns:
      - transition_matrix: historical regime transition probabilities
      - projected_regimes: regime probability vectors at T+1M, T+3M, T+6M
      - score_trajectory: last 36 monthly data points
      - signal_momentum: 6 key continuous signal values + 3M direction
      - current_streak: current regime streak info
      - avg_duration_days: average duration per regime
    """
    REGIMES = ["Risk-On", "Neutral", "Risk-Off", "Crisis"]

    df = _get_historical_df()

    # ── 1. Markov transition matrix from monthly-sampled history ─────
    monthly = df.resample("ME").last().dropna(subset=["regime"])
    today = pd.Timestamp(datetime.now().date())
    monthly_past = monthly[monthly.index <= today]
    regimes_seq = monthly_past["regime"].tolist()

    counts: dict[str, dict[str, float]] = {r: {r2: 0.0 for r2 in REGIMES} for r in REGIMES}
    for i in range(len(regimes_seq) - 1):
        from_r = regimes_seq[i]
        to_r = regimes_seq[i + 1]
        if from_r in counts and to_r in counts[from_r]:
            counts[from_r][to_r] += 1

    transition_matrix: dict[str, dict[str, float]] = {}
    for from_r, to_counts in counts.items():
        total = sum(to_counts.values())
        if total > 0:
            transition_matrix[from_r] = {to_r: round(c / total, 4) for to_r, c in to_counts.items()}
        else:
            # Uniform fallback if no transitions observed
            transition_matrix[from_r] = {to_r: round(1 / len(REGIMES), 4) for to_r in REGIMES}

    # ── 2. Matrix multiplication helper ─────────────────────────────
    def mat_vec(mat: dict, vec: dict) -> dict:
        """Multiply transition matrix by probability vector."""
        result = {r: 0.0 for r in REGIMES}
        for to_r in REGIMES:
            for from_r in REGIMES:
                result[to_r] += mat.get(from_r, {}).get(to_r, 0.0) * vec.get(from_r, 0.0)
        return result

    def mat_pow_vec(mat: dict, vec: dict, steps: int) -> dict:
        v = vec.copy()
        for _ in range(steps):
            v = mat_vec(mat, v)
        return {k: round(v, 4) for k, v in v.items()}

    # ── 3. Current regime as start vector ────────────────────────────
    current_regime = regimes_seq[-1] if regimes_seq else "Neutral"
    start_vec = {r: (1.0 if r == current_regime else 0.0) for r in REGIMES}

    projected_regimes = {
        "t1m": mat_pow_vec(transition_matrix, start_vec, 1),
        "t3m": mat_pow_vec(transition_matrix, start_vec, 3),
        "t6m": mat_pow_vec(transition_matrix, start_vec, 6),
    }

    # ── 4. Score trajectory — last 36 monthly points (up to today) ───
    traj_df = monthly_past.tail(36)
    score_trajectory = [
        {
            "date": str(pd.Timestamp(date).date()),
            "total_score": round(float(row["total_score"]), 2),
            "regime": row["regime"],
        }
        for date, row in traj_df.iterrows()
    ]

    # Force the final point to equal the live dashboard score so the chart's
    # rightmost node matches the headline number instead of last month-end.
    if score_trajectory:
        try:
            live = run_current_pipeline()
            live_score = live.get("total_score")
            if isinstance(live_score, (int, float)) and live_score >= 0:
                score_trajectory[-1] = {
                    "date": str(datetime.now().date()),
                    "total_score": round(float(live_score), 2),
                    "regime": live.get("regime", score_trajectory[-1]["regime"]),
                }
        except Exception:
            pass

    # ── 5. Signal momentum from latest signals ───────────────────────
    try:
        master = get_master_dataset()
        signals = compute_signals_latest(master)

        def _sig(category: str, key: str):
            return signals.get(category, {}).get(key)

        def _momentum(val, change_3m) -> dict:
            v = _safe_num(val) if val is not None else None
            c = _safe_num(change_3m) if change_3m is not None else None
            if v is None:
                v = 0.0
            if c is None:
                c = 0.0
            direction = "up" if c > 0.01 else ("down" if c < -0.01 else "flat")
            return {"value": round(v, 4), "change_3m": round(c, 4), "direction": direction}

        signal_momentum = {
            "vix_level": _momentum(
                _sig("market", "vix_level"),
                _sig("market", "vix_1m_change"),
            ),
            "credit_spread": _momentum(
                _sig("financial", "credit_spread"),
                _sig("financial", "credit_spread_3m_change"),
            ),
            "cpi_yoy": _momentum(
                _sig("inflation", "cpi_yoy"),
                _sig("inflation", "cpi_3m_change"),
            ),
            "yield_spread": _momentum(
                _sig("growth", "yield_spread"),
                _sig("growth", "nominal_10y_3m_change"),
            ),
            "sp500_drawdown": _momentum(
                _sig("market", "sp500_drawdown"),
                _sig("market", "sp500_6m_momentum"),
            ),
            "fed_funds_3m_change": _momentum(
                _sig("financial", "fed_funds_3m_change"),
                _sig("financial", "fed_funds_3m_change"),
            ),
        }
    except Exception:
        signal_momentum = {
            k: {"value": 0.0, "change_3m": 0.0, "direction": "flat"}
            for k in ["vix_level", "credit_spread", "cpi_yoy", "yield_spread", "sp500_drawdown", "fed_funds_3m_change"]
        }

    # ── 6. Current streak ────────────────────────────────────────────
    streak_days = 0
    streak_start = str(pd.Timestamp(monthly_past.index[-1]).date()) if len(monthly_past) > 0 else str(datetime.now().date())
    try:
        transitions_list = monthly_past["regime"].tolist()
        last_change_idx = 0
        for i in range(len(transitions_list) - 2, -1, -1):
            if transitions_list[i] != current_regime:
                last_change_idx = i + 1
                break
        streak_start = str(pd.Timestamp(monthly_past.index[last_change_idx]).date())
        streak_days = max(0, (datetime.now().date() - pd.Timestamp(streak_start).date()).days)
    except Exception:
        streak_days = 0

    current_streak = {
        "regime": current_regime,
        "start_date": streak_start,
        "days": streak_days,
    }

    # ── 7. Average duration per regime ───────────────────────────────
    summary = get_regime_summary(df)
    avg_duration_days = summary.get("avg_duration_days", {r: 90 for r in REGIMES})

    try:
        score_forecast = _compute_score_forecast()
    except Exception:
        score_forecast = []

    return {
        "transition_matrix": transition_matrix,
        "projected_regimes": projected_regimes,
        "score_trajectory": score_trajectory,
        "signal_momentum": signal_momentum,
        "current_streak": current_streak,
        "avg_duration_days": avg_duration_days,
        "score_forecast": score_forecast,
    }


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
