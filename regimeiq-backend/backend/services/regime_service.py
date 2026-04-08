"""
regime_service.py
─────────────────
Maps total scores → regime labels + probability.

Regime bands (0-10 continuous scale):
  0.0–2.5   Risk-On    (green)
  2.5–5.0   Neutral    (yellow)
  5.0–7.5   Risk-Off   (orange)
  7.5–10.0  Crisis     (red)

Provides point-in-time classification and full historical regime series.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from services.scoring_engine import (
    GROWTH_MAX, INFLATION_MAX, FINANCIAL_MAX, MARKET_MAX, TOTAL_MAX,
)


# ─── regime definitions ──────────────────────────────────────────────
#  (lo, hi, label, color_hex, risk_level)

REGIME_BANDS: list[tuple[float, float, str, str, int]] = [
    (0.0,  2.5,  "Risk-On",  "#22c55e", 1),
    (2.5,  5.0,  "Neutral",  "#eab308", 2),
    (5.0,  7.5,  "Risk-Off", "#f97316", 3),
    (7.5, 10.0,  "Crisis",   "#ef4444", 4),
]


# ─── point-in-time ───────────────────────────────────────────────────

def classify_regime(scores: dict) -> dict:
    """
    Convert a scores dict into a regime classification.

    Parameters
    ----------
    scores : dict with keys growth_score, inflation_score, financial_score,
             market_score, total_score (from scoring_engine.compute_scores)

    Returns
    -------
    dict with regime label, color, probability, and full breakdown.
    """
    total = float(scores.get("total_score", 0))

    # Clamp to valid range
    total = max(0.0, min(total, float(TOTAL_MAX)))

    regime = "Neutral"
    color = "#eab308"
    risk_level = 2

    for lo, hi, label, hex_color, rl in REGIME_BANDS:
        if rl == 4:  # Crisis: inclusive upper bound
            if lo <= total <= hi:
                regime = label
                color = hex_color
                risk_level = rl
                break
        else:
            if lo <= total < hi:
                regime = label
                color = hex_color
                risk_level = rl
                break

    probability = round(total / TOTAL_MAX, 4)

    return {
        "regime": regime,
        "regime_color": color,
        "risk_level": risk_level,
        "probability": probability,
        "total_score": round(total, 2),
        "breakdown": {
            "growth":    {"score": int(scores.get("growth_score", 0)),    "max": GROWTH_MAX},
            "inflation": {"score": int(scores.get("inflation_score", 0)), "max": INFLATION_MAX},
            "financial": {"score": int(scores.get("financial_score", 0)), "max": FINANCIAL_MAX},
            "market":    {"score": int(scores.get("market_score", 0)),    "max": MARKET_MAX},
        },
    }


# ─── historical (vectorised) ─────────────────────────────────────────

def classify_regime_historical(scores_df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply regime classification to every row of a scores DataFrame.

    Parameters
    ----------
    scores_df : DataFrame with columns growth_score, inflation_score,
                financial_score, market_score, total_score
                (from scoring_engine.compute_scores_historical)

    Returns
    -------
    DataFrame with added columns: regime, regime_color, risk_level, probability
    """
    df = scores_df.copy()

    # Clamp total score
    df["total_score"] = df["total_score"].clip(0.0, float(TOTAL_MAX))

    # Map total_score → regime using np.select (0-10 float scale)
    conditions = [
        df["total_score"] < 2.5,
        df["total_score"] < 5.0,
        df["total_score"] < 7.5,
        df["total_score"] <= 10.0,
    ]

    regime_labels = ["Risk-On", "Neutral", "Risk-Off", "Crisis"]
    regime_colors = ["#22c55e", "#eab308", "#f97316", "#ef4444"]
    risk_levels = [1, 2, 3, 4]

    df["regime"] = np.select(conditions, regime_labels, default="Neutral")
    df["regime_color"] = np.select(conditions, regime_colors, default="#eab308")
    df["risk_level"] = np.select(conditions, risk_levels, default=2)
    df["probability"] = (df["total_score"] / TOTAL_MAX).round(4)

    return df


# ─── summary stats ───────────────────────────────────────────────────

def get_regime_summary(regime_df: pd.DataFrame) -> dict:
    """
    Compute summary statistics about regime distribution.

    Parameters
    ----------
    regime_df : DataFrame from classify_regime_historical() — must have
                'regime' column and a DatetimeIndex.

    Returns
    -------
    dict with total_days, distribution, and current streak info.
    """
    total = len(regime_df)

    # Distribution
    distribution = {}
    for _, _, label, _, _ in REGIME_BANDS:
        count = int((regime_df["regime"] == label).sum())
        distribution[label] = {
            "count": count,
            "pct": round(count / total, 4) if total > 0 else 0.0,
        }

    # Current streak: count consecutive days of the same regime from the end
    current_regime = regime_df["regime"].iloc[-1]
    streak = 0
    for val in reversed(regime_df["regime"].values):
        if val == current_regime:
            streak += 1
        else:
            break

    streak_start = regime_df.index[-streak] if streak > 0 else regime_df.index[-1]

    return {
        "total_days": total,
        "regime_distribution": distribution,
        "current_regime_streak": {
            "regime": current_regime,
            "start_date": str(streak_start.date()),
            "days": streak,
        },
    }