"""
scoring_engine.py
─────────────────
Converts signal dicts into sub-scores and a total score.

Scoring rules:
  Growth        (0-3):  +1 unemp_rising, +1 yield_curve_inverted, +1 pmi_below_50
  Inflation     (0-3):  +1 cpi_above_3, +1 cpi_trend_rising, +1 real_rate_negative
  Financial     (0-3):  +1 credit_spread_widening, +1 rate_rising_sharply, +1 dollar_strengthening
  Market Risk   (0-4):  +1 momentum_negative, +1 drawdown_severe, +1 vix_above_25, +1 below_200ma
                         ─────
  Total               :  0-13

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
TOTAL_MAX = 10  # new public max (LightGBM-predicted continuous score)


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

    Parameters
    ----------
    signals : dict with keys "growth", "inflation", "financial", "market"

    Returns
    -------
    dict with growth_score, inflation_score, financial_score, market_score,
    raw_total_score (integer sum 0-13), total_score (model-predicted float 0-10).
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

    # Model prediction for total score (0-10 continuous)
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

    Parameters
    ----------
    signals_df : DataFrame from compute_signals_historical()

    Returns
    -------
    DataFrame with columns: growth_score, inflation_score, financial_score,
    market_score, raw_total_score (int 0-13), total_score (float 0-10).
    """
    out = pd.DataFrame(index=signals_df.index)

    # Growth score: sum of boolean flags, NaN → 0
    out["growth_score"] = sum(
        signals_df[f].fillna(False).astype(int) for f in GROWTH_FLAGS
    )

    # Inflation score
    out["inflation_score"] = sum(
        signals_df[f].fillna(False).astype(int) for f in INFLATION_FLAGS
    )

    # Financial score
    out["financial_score"] = sum(
        signals_df[f].fillna(False).astype(int) for f in FINANCIAL_FLAGS
    )

    # Market score
    out["market_score"] = sum(
        signals_df[f].fillna(False).astype(int) for f in MARKET_FLAGS
    )

    out["raw_total_score"] = (
        out["growth_score"] + out["inflation_score"]
        + out["financial_score"] + out["market_score"]
    )

    # Rescale raw sum to 0-10 via sigmoid (compresses moderate, amplifies extreme)
    from services.model_service import _sigmoid_rescale
    rescaled = _sigmoid_rescale(out["raw_total_score"])
    out["total_score"] = pd.Series(rescaled, index=out.index).clip(0.0, 10.0).round(2)

    # Use model predictions for ALL data — the model learns interaction effects
    # (multi-category stress, VIX×drawdown, etc.) that the additive system misses,
    # pushing genuine crises higher while keeping moderate periods moderate.
    from services.model_service import predict_scores
    model_preds = predict_scores(signals_df)
    valid = model_preds.notna()
    if valid.any():
        out.loc[valid, "total_score"] = model_preds[valid].round(2)

    return out


# ─── CLI ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json
    from data_merge_service import get_master_dataset
    from signals_engine import compute_signals_latest, compute_signals_historical

    master = get_master_dataset()

    # --- Test point-in-time scoring ---
    signals = compute_signals_latest(master)
    scores = compute_scores(signals)
    print("=== LATEST SCORES ===")
    print(json.dumps(scores, indent=2))

    # --- Test historical scoring ---
    hist_signals = compute_signals_historical(master)
    hist_scores = compute_scores_historical(hist_signals)
    print(f"\nHistorical scores shape: {hist_scores.shape}")

    # --- Spot-check key dates ---
    for date_str in ["2008-10-01", "2008-11-20", "2009-03-09",
                      "2020-03-20", "2021-06-15",
                      "2022-06-15", "2024-12-15", "2026-02-20"]:
        try:
            idx: int = int(hist_scores.index.get_indexer(
                pd.DatetimeIndex([date_str]), method="nearest"  # type: ignore[arg-type]
            )[0])
            row = hist_scores.iloc[idx]
            actual_date = pd.Timestamp(hist_scores.index[idx]).date()  # type: ignore[union-attr]
            total = float(row["total_score"])
            raw = int(row["raw_total_score"])
            g = int(row["growth_score"])
            i = int(row["inflation_score"])
            f = int(row["financial_score"])
            m = int(row["market_score"])
            print(f"  {actual_date}  →  G={g} I={i} F={f} M={m}  "
                  f"Raw={raw}/13  Score={total:.2f}/10")
        except Exception as e:
            print(f"  {date_str}: {e}")

    # --- Unit tests ---
    print("\n=== UNIT TESTS ===")

    # All-false → 0
    all_false = {
        "growth":    {f: False for f in GROWTH_FLAGS},
        "inflation": {f: False for f in INFLATION_FLAGS},
        "financial": {f: False for f in FINANCIAL_FLAGS},
        "market":    {f: False for f in MARKET_FLAGS},
    }
    assert compute_scores(all_false)["raw_total_score"] == 0, "FAIL: all-false"
    print("  ✓ All-false → 0")

    # All-true → raw_total_score 13
    all_true = {
        "growth":    {f: True for f in GROWTH_FLAGS},
        "inflation": {f: True for f in INFLATION_FLAGS},
        "financial": {f: True for f in FINANCIAL_FLAGS},
        "market":    {f: True for f in MARKET_FLAGS},
    }
    assert compute_scores(all_true)["raw_total_score"] == 13, "FAIL: all-true"
    print("  ✓ All-true → raw_total_score=13")

    # NaN PMI → growth max is 2
    nan_pmi = {
        "growth":    {"unemp_rising": True, "yield_curve_inverted": True, "pmi_below_50": None},
        "inflation": {f: False for f in INFLATION_FLAGS},
        "financial": {f: False for f in FINANCIAL_FLAGS},
        "market":    {f: False for f in MARKET_FLAGS},
    }
    result = compute_scores(nan_pmi)
    assert result["growth_score"] == 2, f"FAIL: NaN PMI → growth={result['growth_score']}"
    assert result["raw_total_score"] == 2, f"FAIL: NaN PMI → raw_total={result['raw_total_score']}"
    print("  ✓ NaN PMI → growth=2, raw_total=2")

    # Empty input → 0
    empty = {}
    assert compute_scores(empty)["raw_total_score"] == 0, "FAIL: empty"
    print("  ✓ Empty input → 0")

    # Growth-only stress
    growth_only = {
        "growth":    {f: True for f in GROWTH_FLAGS},
        "inflation": {f: False for f in INFLATION_FLAGS},
        "financial": {f: False for f in FINANCIAL_FLAGS},
        "market":    {f: False for f in MARKET_FLAGS},
    }
    result = compute_scores(growth_only)
    assert result["growth_score"] == 3, "FAIL: growth-only"
    assert result["raw_total_score"] == 3, "FAIL: growth-only raw_total"
    print("  ✓ Growth-only stress → 3/3, raw_total=3")

    print("\n  All unit tests passed.")
