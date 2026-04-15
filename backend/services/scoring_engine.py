"""
scoring_engine.py
─────────────────
Converts signal dicts into sub-scores and a continuous total score.

Sub-scores (still integer flag counts):
  Growth        (0-3):  +1 unemp_rising, +1 yield_curve_inverted, +1 pmi_below_50
  Inflation     (0-3):  +1 cpi_above_3, +1 cpi_trend_rising, +1 real_rate_negative
  Financial     (0-3):  +1 credit_spread_widening, +1 rate_rising_sharply, +1 dollar_strengthening
  Market Risk   (0-4):  +1 momentum_negative, +1 drawdown_severe, +1 vix_above_25, +1 below_200ma
                         ─────
  Raw integer sum      :  0-13
  total_score (ML/0-10): LightGBM prediction, sigmoid fallback

NaN rule: if a boolean signal is None/NaN, it contributes 0 (not +1).
"""

from __future__ import annotations
import pandas as pd
import numpy as np


# ─── scoring constants ────────────────────────────────────────────────

GROWTH_FLAGS = ["unemp_rising", "yield_curve_inverted", "pmi_below_50"]
GROWTH_MAX = len(GROWTH_FLAGS)  # 3

INFLATION_FLAGS = ["cpi_above_3", "cpi_trend_rising", "real_rate_negative"]
INFLATION_MAX = len(INFLATION_FLAGS)  # 3

FINANCIAL_FLAGS = ["credit_spread_widening", "rate_rising_sharply", "dollar_strengthening"]
FINANCIAL_MAX = len(FINANCIAL_FLAGS)  # 3

MARKET_FLAGS = ["momentum_negative", "drawdown_severe", "vix_above_25", "below_200ma"]
MARKET_MAX = len(MARKET_FLAGS)  # 4

TOTAL_MAX_RAW = GROWTH_MAX + INFLATION_MAX + FINANCIAL_MAX + MARKET_MAX  # 13
TOTAL_MAX = 10  # ML-predicted continuous score max


# ─── helpers ──────────────────────────────────────────────────────────

def _flag_to_int(val) -> int:
    """Safely convert a boolean flag to 0/1. None → 0, NaN → 0."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return 0
    return int(bool(val))


# ─── point-in-time scoring ───────────────────────────────────────────

def compute_scores(signals: dict) -> dict:
    """
    Convert a signal dict (as returned by compute_signals_latest)
    into sub-scores + total.

    Returns dict with growth_score, inflation_score, financial_score,
    market_score, raw_total_score (integer 0-13), total_score (float 0-10).
    """
    growth = signals.get("growth", {})
    inflation = signals.get("inflation", {})
    financial = signals.get("financial", {})
    market = signals.get("market", {})

    growth_score = sum(_flag_to_int(growth.get(f)) for f in GROWTH_FLAGS)
    inflation_score = sum(_flag_to_int(inflation.get(f)) for f in INFLATION_FLAGS)
    financial_score = sum(_flag_to_int(financial.get(f)) for f in FINANCIAL_FLAGS)
    market_score = sum(_flag_to_int(market.get(f)) for f in MARKET_FLAGS)

    raw_total_score = growth_score + inflation_score + financial_score + market_score

    from services.model_service import predict_score_single
    total_score = predict_score_single(signals, raw_total_score)

    return {
        "growth_score": growth_score,
        "inflation_score": inflation_score,
        "financial_score": financial_score,
        "market_score": market_score,
        "raw_total_score": raw_total_score,
        "total_score": round(total_score, 2),
    }


# ─── historical scoring (vectorised) ─────────────────────────────────

def compute_scores_historical(signals_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute scores for every row of the signals DataFrame.

    Returns DataFrame with columns: growth_score, inflation_score,
    financial_score, market_score, raw_total_score (int 0-13),
    total_score (float 0-10).
    """
    out = pd.DataFrame(index=signals_df.index)

    out["growth_score"] = sum(
        signals_df[f].fillna(False).astype(int) for f in GROWTH_FLAGS
    )
    out["inflation_score"] = sum(
        signals_df[f].fillna(False).astype(int) for f in INFLATION_FLAGS
    )
    out["financial_score"] = sum(
        signals_df[f].fillna(False).astype(int) for f in FINANCIAL_FLAGS
    )
    out["market_score"] = sum(
        signals_df[f].fillna(False).astype(int) for f in MARKET_FLAGS
    )
    out["raw_total_score"] = (
        out["growth_score"] + out["inflation_score"]
        + out["financial_score"] + out["market_score"]
    )

    # Sigmoid fallback: rescale raw integer sum to 0-10
    from services.model_service import _sigmoid_rescale, predict_scores
    rescaled = _sigmoid_rescale(out["raw_total_score"])
    out["total_score"] = pd.Series(rescaled, index=out.index).clip(0.0, 10.0).round(2)

    # Override with LightGBM predictions where available
    model_preds = predict_scores(signals_df)
    valid = model_preds.notna()
    if valid.any():
        out.loc[valid, "total_score"] = model_preds[valid].round(2)

    return out
