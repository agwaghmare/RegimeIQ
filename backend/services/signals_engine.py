"""
signals_engine.py
─────────────────
Computes all raw signal metrics from the master dataset.

Four signal groups:
  1. Growth       — unemployment, yield curve, PMI, industrial production
  2. Inflation    — CPI, core CPI, real rates
  3. Financial    — credit spreads, rate changes, dollar strength
  4. Market Risk  — momentum, vol, drawdown, 200MA

Two modes:
  • compute_signals_latest(df)      → dict  (latest row only)
  • compute_signals_historical(df)  → DataFrame (every row, for backtesting)

NaN rule: every boolean flag returns False when the underlying value is NaN.
"""

import numpy as np
import pandas as pd


# ─── helpers ──────────────────────────────────────────────────────────

def _safe_bool(condition) -> bool:
    """Convert a possibly-NaN boolean to a safe Python bool."""
    if pd.isna(condition):
        return False
    return bool(condition)


def _safe_float(value) -> float | None:
    """Convert to Python float, returning None for NaN."""
    if pd.isna(value):
        return None
    return float(value)


# ─── historical (vectorised) ─────────────────────────────────────────

def compute_signals_historical(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute all signal columns across the entire master DataFrame.
    Returns a new DataFrame with signal columns only (plus the same index).
    Market-level signals are computed here (require rolling windows on daily data).
    Macro-level signals are read from pre-computed columns in the master dataset.
    """
    out = pd.DataFrame(index=df.index)

    # ── GROWTH ────────────────────────────────────────────────────────
    out["unemp_3m_change"] = df["unemp_3m_change"]
    out["unemp_rising"] = df["unemp_3m_change"] > 0.0

    out["yield_spread"] = df["yield_curve_10y2y"]
    out["yield_curve_inverted"] = df["yield_curve_10y2y"] < 0.0

    out["indpro_yoy"] = df["indpro_yoy"]
    out["indpro_negative"] = df["indpro_yoy"] < 0.0

    # NOTE: pmi_ism column is actually MANEMP (manufacturing employment in
    # thousands), NOT the ISM PMI index.  We use YoY % change as a proxy:
    # negative YoY change in manufacturing employment ≈ PMI < 50 (contraction).
    out["pmi_value"] = df["pmi_ism"]
    pmi_yoy_pct = df["pmi_ism"].pct_change(252)  # ~12 months of biz days
    out["pmi_below_50"] = pmi_yoy_pct < 0.0

    # ── INFLATION ─────────────────────────────────────────────────────
    out["cpi_yoy"] = df["cpi_yoy"]
    out["cpi_above_3"] = df["cpi_yoy"] > 3.0

    out["cpi_3m_change"] = df["cpi_3m_change"]
    out["cpi_trend_rising"] = df["cpi_3m_change"] > 0.0

    out["core_cpi_yoy"] = df["core_cpi_yoy"]

    out["real_rate"] = df["real_rate_10y"]
    out["real_rate_negative"] = df["real_rate_10y"] < 0.0

    # ── FINANCIAL CONDITIONS ──────────────────────────────────────────
    out["credit_spread"] = df["credit_spread_hy"]
    out["credit_spread_3m_change"] = df["credit_spread_3m_change"]
    out["credit_spread_widening"] = df["credit_spread_3m_change"] > 0.5

    out["nominal_10y_3m_change"] = df["nominal_10y_3m_change"]
    out["rate_rising_sharply"] = df["nominal_10y_3m_change"] > 0.75

    # DXY proxy (UUP) — 3-month pct change (63 biz days)
    out["dxy_3m_pct_change"] = df["uup"].pct_change(63)
    out["dollar_strengthening"] = out["dxy_3m_pct_change"] > 0.03

    out["nfci"] = df["financial_cond"]

    # ── MARKET RISK ───────────────────────────────────────────────────
    out["sp500_6m_momentum"] = df["sp500"].pct_change(126)
    out["sp500_12m_momentum"] = df["sp500"].pct_change(252)
    out["momentum_negative"] = out["sp500_6m_momentum"] < 0.0

    # 30-day realised vol (annualised)
    daily_ret = df["sp500"].pct_change(1)
    out["sp500_30d_vol"] = daily_ret.rolling(30).std() * np.sqrt(252)

    out["vix_level"] = df["vix"]
    out["vix_above_25"] = df["vix"] > 25.0

    # VIX regime bands
    out["vix_regime"] = pd.cut(
        df["vix"],
        bins=[-np.inf, 20, 30, np.inf],
        labels=["low", "elevated", "high"],
    )

    # Drawdown from running max
    cummax = df["sp500"].cummax()
    out["sp500_drawdown"] = (df["sp500"] - cummax) / cummax
    out["drawdown_severe"] = out["sp500_drawdown"] < -0.15

    # 200-day moving average
    out["sp500_200ma"] = df["sp500"].rolling(200).mean()
    out["sp500_200ma_distance"] = (
        (df["sp500"] - out["sp500_200ma"]) / out["sp500_200ma"]
    )
    out["below_200ma"] = df["sp500"] < out["sp500_200ma"]

    # ── Clean up: convert NaN booleans to False ──────────────────────
    bool_cols = out.select_dtypes(include=["bool"]).columns
    # Some "bool" columns might have NaN from rolling — those are actually
    # object dtype. Fix all flag columns explicitly.
    flag_cols = [
        "unemp_rising", "yield_curve_inverted", "indpro_negative",
        "pmi_below_50", "cpi_above_3", "cpi_trend_rising",
        "real_rate_negative", "credit_spread_widening",
        "rate_rising_sharply", "dollar_strengthening",
        "momentum_negative", "vix_above_25", "drawdown_severe",
        "below_200ma",
    ]
    for col in flag_cols:
        out[col] = out[col].fillna(False).astype(bool)

    return out


# ─── point-in-time (latest) ──────────────────────────────────────────

def compute_signals_latest(df: pd.DataFrame) -> dict:
    """
    Compute signals for the latest row of the master DataFrame.
    Returns a nested dict grouped by signal category.
    """
    signals_df = compute_signals_historical(df)
    row = signals_df.iloc[-1]
    date_str = str(signals_df.index[-1].date())

    return {
        "date": date_str,
        "growth": {
            "unemp_3m_change":      _safe_float(row["unemp_3m_change"]),
            "unemp_rising":         _safe_bool(row["unemp_rising"]),
            "yield_spread":         _safe_float(row["yield_spread"]),
            "yield_curve_inverted": _safe_bool(row["yield_curve_inverted"]),
            "indpro_yoy":           _safe_float(row["indpro_yoy"]),
            "indpro_negative":      _safe_bool(row["indpro_negative"]),
            "pmi_value":            _safe_float(row["pmi_value"]),
            "pmi_below_50":         _safe_bool(row["pmi_below_50"]),
        },
        "inflation": {
            "cpi_yoy":              _safe_float(row["cpi_yoy"]),
            "cpi_above_3":          _safe_bool(row["cpi_above_3"]),
            "cpi_3m_change":        _safe_float(row["cpi_3m_change"]),
            "cpi_trend_rising":     _safe_bool(row["cpi_trend_rising"]),
            "core_cpi_yoy":         _safe_float(row["core_cpi_yoy"]),
            "real_rate":            _safe_float(row["real_rate"]),
            "real_rate_negative":   _safe_bool(row["real_rate_negative"]),
        },
        "financial": {
            "credit_spread":            _safe_float(row["credit_spread"]),
            "credit_spread_3m_change":  _safe_float(row["credit_spread_3m_change"]),
            "credit_spread_widening":   _safe_bool(row["credit_spread_widening"]),
            "nominal_10y_3m_change":    _safe_float(row["nominal_10y_3m_change"]),
            "rate_rising_sharply":      _safe_bool(row["rate_rising_sharply"]),
            "dxy_3m_pct_change":        _safe_float(row["dxy_3m_pct_change"]),
            "dollar_strengthening":     _safe_bool(row["dollar_strengthening"]),
            "nfci":                     _safe_float(row["nfci"]),
        },
        "market": {
            "sp500_6m_momentum":    _safe_float(row["sp500_6m_momentum"]),
            "sp500_12m_momentum":   _safe_float(row["sp500_12m_momentum"]),
            "momentum_negative":    _safe_bool(row["momentum_negative"]),
            "sp500_30d_vol":        _safe_float(row["sp500_30d_vol"]),
            "vix_level":            _safe_float(row["vix_level"]),
            "vix_above_25":         _safe_bool(row["vix_above_25"]),
            "vix_regime":           str(row["vix_regime"]) if pd.notna(row["vix_regime"]) else None,
            "sp500_drawdown":       _safe_float(row["sp500_drawdown"]),
            "drawdown_severe":      _safe_bool(row["drawdown_severe"]),
            "sp500_200ma":          _safe_float(row["sp500_200ma"]),
            "sp500_200ma_distance": _safe_float(row["sp500_200ma_distance"]),
            "below_200ma":          _safe_bool(row["below_200ma"]),
        },
    }


# ─── CLI ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from data_merge_service import get_master_dataset
    import json

    master = get_master_dataset()
    print(f"Master shape: {master.shape}")

    # Test latest signals
    latest = compute_signals_latest(master)
    print("\n=== LATEST SIGNALS ===")
    print(json.dumps(latest, indent=2))

    # Test historical signals — spot check key dates
    hist = compute_signals_historical(master)
    print(f"\nHistorical signals shape: {hist.shape}")

    for date_str in ["2008-10-01", "2020-03-20", "2022-06-15", "2024-12-15"]:
        try:
            idx: int = int(hist.index.get_indexer(pd.DatetimeIndex([date_str]), method="nearest")[0])  # type: ignore[arg-type]
            row = hist.iloc[idx]
            actual_date = pd.Timestamp(hist.index[idx]).date()  # type: ignore[union-attr]
            print(f"\n--- {actual_date} ---")
            for col in ["unemp_rising", "yield_curve_inverted", "pmi_below_50",
                         "cpi_above_3", "cpi_trend_rising", "real_rate_negative",
                         "credit_spread_widening", "rate_rising_sharply", "dollar_strengthening",
                         "momentum_negative", "drawdown_severe", "vix_above_25", "below_200ma"]:
                print(f"  {col:30s} = {row[col]}")
        except Exception as e:
            print(f"  Could not find {date_str}: {e}")
