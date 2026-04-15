"""
signals_engine.py (FIXED)
────────────────────────
Computes raw signal metrics from the master dataset.
Includes defensive handling for missing/corrupted PMI values.
"""

import numpy as np
import pandas as pd


# ─── helpers ──────────────────────────────────────────────────────────

def _safe_bool(condition) -> bool:
    if pd.isna(condition):
        return False
    return bool(condition)


def _safe_float(value):
    if pd.isna(value):
        return None
    return float(value)


def _vix_series(df: pd.DataFrame) -> pd.Series:
    """
    CBOE VIX is usually ~9–80. Values ~90–150 in the 'vix' column are often VVIX
    mis-mapped (VVIX is typically 80–150; VIX is typically 10–50). Repair obvious swaps.
    """
    v = pd.to_numeric(df["vix"], errors="coerce")
    if "vvix" not in df.columns:
        return v
    vv = pd.to_numeric(df["vvix"], errors="coerce")
    # Typical mis-label: vix holds VVIX (~100+), vvix holds VIX (~15–40)
    swap = (v > 85) & (vv < 70) & (vv > 5)
    return v.where(~swap, vv)


def _resolve_pmi_series(df: pd.DataFrame) -> pd.Series:
    """
    Return a PMI-like series on the expected 0-100 diffusion scale.
    If source values are clearly not PMI (e.g. ~12,000 manufacturing jobs),
    return NaNs so downstream scoring does not use corrupted inputs.
    """
    candidates = ["pmi_ism", "napm", "ism_pmi", "pmi"]
    for col in candidates:
        if col in df.columns:
            s = pd.to_numeric(df[col], errors="coerce")
            # PMI should usually live in a narrow diffusion-index range.
            invalid_mask = (s < 10) | (s > 90)
            s = s.mask(invalid_mask)
            return s
    return pd.Series(np.nan, index=df.index, dtype="float64")


def _resolve_nfci_series(df: pd.DataFrame) -> pd.Series:
    """
    Prefer canonical `financial_cond`; fallback to common aliases when missing.
    Keeps the pipeline resilient to schema drift in cached CSVs.
    """
    for col in ("financial_cond", "nfci", "financial_conditions"):
        if col in df.columns:
            return pd.to_numeric(df[col], errors="coerce")
    return pd.Series(np.nan, index=df.index, dtype="float64")


# ─── historical signals ───────────────────────────────────────────────

def compute_signals_historical(df: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=df.index)
    pmi_series = _resolve_pmi_series(df)

    # ── GROWTH ────────────────────────────────────────────────────────
    out["unemp_3m_change"] = df["unemp_3m_change"]
    out["unemp_rising"] = df["unemp_3m_change"] > 0.0

    out["yield_spread"] = df["yield_curve_10y2y"]
    out["yield_curve_inverted"] = df["yield_curve_10y2y"] < 0.0

    out["indpro_yoy"] = df["indpro_yoy"]
    out["indpro_negative"] = df["indpro_yoy"] < 0.0

    # ✅ FIXED PMI (now real PMI ~50 threshold)
    out["pmi_value"] = pmi_series
    out["pmi_below_50"] = (pmi_series < 50.0) | (
        pmi_series.isna() & (df["indpro_yoy"] < 0.0)
    )

    # ── INFLATION ─────────────────────────────────────────────────────
    out["cpi_yoy"] = df["cpi_yoy"]
    out["cpi_above_3"] = df["cpi_yoy"] > 3.0

    out["cpi_3m_change"] = df["cpi_3m_change"]
    if "fed_funds_3m_change" in df.columns:
        out["fed_funds_3m_change"] = df["fed_funds_3m_change"]
    else:
        out["fed_funds_3m_change"] = df["fed_funds"].diff(63)
    # Inflation risk stays elevated when prices are rising OR policy is not easing.
    out["cpi_trend_rising"] = (df["cpi_3m_change"] > 0.0) | (
        (out["fed_funds_3m_change"] >= -0.10) & (df["real_rate_10y"] > 1.0)
    )

    out["core_cpi_yoy"] = df["core_cpi_yoy"]

    out["real_rate"] = df["real_rate_10y"]
    out["real_rate_negative"] = df["real_rate_10y"] < 0.0

    # ── FINANCIAL CONDITIONS ──────────────────────────────────────────
    out["credit_spread"] = df["credit_spread_hy"]

    if "credit_spread_3m_change" in df.columns:
        out["credit_spread_3m_change"] = df["credit_spread_3m_change"]
    else:
        # Daily fallback when only raw daily series is available.
        out["credit_spread_3m_change"] = df["credit_spread_hy"].diff(63)
    out["credit_spread_3m_pct_change"] = df["credit_spread_hy"].pct_change(63)
    out["credit_spread_widening"] = out["credit_spread_3m_change"] > 0.5

    if "nominal_10y_3m_change" in df.columns:
        out["nominal_10y_3m_change"] = df["nominal_10y_3m_change"]
    elif "nominal_10y" in df.columns:
        out["nominal_10y_3m_change"] = df["nominal_10y"].diff(63)
    else:
        out["nominal_10y_3m_change"] = df["yield_curve_10y3m"].diff(63)
    # Keep this as a genuine rate-shock flag; avoid triggering on routine repricing.
    out["rate_rising_sharply"] = out["nominal_10y_3m_change"].abs() > 0.15

    out["dxy_3m_pct_change"] = df["uup"].pct_change(63)
    out["dollar_strengthening"] = out["dxy_3m_pct_change"] > 0.03

    out["nfci"] = _resolve_nfci_series(df)

    # ── MARKET RISK ───────────────────────────────────────────────────
    out["sp500_6m_momentum"] = df["sp500"].pct_change(126)
    out["sp500_12m_momentum"] = df["sp500"].pct_change(252)
    out["momentum_negative"] = out["sp500_6m_momentum"] < 0.0

    daily_ret = df["sp500"].pct_change(1)
    out["sp500_30d_vol"] = daily_ret.rolling(30).std() * np.sqrt(252)

    vix_clean = _vix_series(df)
    out["vix_level"] = vix_clean
    out["vix_1m_change"] = vix_clean.diff(21)
    out["vix_above_25"] = vix_clean > 25.0

    out["vix_regime"] = pd.cut(
        vix_clean,
        bins=[-np.inf, 20, 30, np.inf],
        labels=["low", "elevated", "high"],
    )

    cummax = df["sp500"].cummax()
    out["sp500_drawdown"] = (df["sp500"] - cummax) / cummax
    # Reserve severe drawdown flag for deeper equity stress.
    out["drawdown_severe"] = out["sp500_drawdown"] < -0.12

    out["sp500_200ma"] = df["sp500"].rolling(200).mean()
    out["sp500_200ma_distance"] = (
        (df["sp500"] - out["sp500_200ma"]) / out["sp500_200ma"]
    )
    out["below_200ma"] = df["sp500"] < out["sp500_200ma"]

    # ── CLEAN BOOLEAN FLAGS ───────────────────────────────────────────
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


# ─── latest snapshot ──────────────────────────────────────────────────

def compute_signals_latest(df: pd.DataFrame) -> dict:
    signals_df = compute_signals_historical(df)

    # ✅ ALWAYS use latest row
    row = signals_df.iloc[-1]
    date_str = str(signals_df.index[-1].date())

    return {
        "date": date_str,
        "growth": {
            "unemp_3m_change": _safe_float(row["unemp_3m_change"]),
            "unemp_rising": _safe_bool(row["unemp_rising"]),
            "yield_spread": _safe_float(row["yield_spread"]),
            "yield_curve_inverted": _safe_bool(row["yield_curve_inverted"]),
            "indpro_yoy": _safe_float(row["indpro_yoy"]),
            "indpro_negative": _safe_bool(row["indpro_negative"]),
            "pmi_value": _safe_float(row["pmi_value"]),
            "pmi_below_50": _safe_bool(row["pmi_below_50"]),
        },
        "inflation": {
            "cpi_yoy": _safe_float(row["cpi_yoy"]),
            "cpi_above_3": _safe_bool(row["cpi_above_3"]),
            "cpi_3m_change": _safe_float(row["cpi_3m_change"]),
            "fed_funds_3m_change": _safe_float(row["fed_funds_3m_change"]),
            "cpi_trend_rising": _safe_bool(row["cpi_trend_rising"]),
            "core_cpi_yoy": _safe_float(row["core_cpi_yoy"]),
            "real_rate": _safe_float(row["real_rate"]),
            "real_rate_negative": _safe_bool(row["real_rate_negative"]),
        },
        "financial": {
            "credit_spread": _safe_float(row["credit_spread"]),
            "credit_spread_3m_change": _safe_float(row["credit_spread_3m_change"]),
            "credit_spread_3m_pct_change": _safe_float(row["credit_spread_3m_pct_change"]),
            "credit_spread_widening": _safe_bool(row["credit_spread_widening"]),
            "nominal_10y_3m_change": _safe_float(row["nominal_10y_3m_change"]),
            "rate_rising_sharply": _safe_bool(row["rate_rising_sharply"]),
            "dxy_3m_pct_change": _safe_float(row["dxy_3m_pct_change"]),
            "dollar_strengthening": _safe_bool(row["dollar_strengthening"]),
            "nfci": _safe_float(row["nfci"]),
        },
        "market": {
            "sp500_6m_momentum": _safe_float(row["sp500_6m_momentum"]),
            "sp500_12m_momentum": _safe_float(row["sp500_12m_momentum"]),
            "momentum_negative": _safe_bool(row["momentum_negative"]),
            "sp500_30d_vol": _safe_float(row["sp500_30d_vol"]),
            "vix_level": _safe_float(row["vix_level"]),
            "vix_1m_change": _safe_float(row["vix_1m_change"]),
            "vix_above_25": _safe_bool(row["vix_above_25"]),
            "vix_regime": str(row["vix_regime"]) if pd.notna(row["vix_regime"]) else None,
            "sp500_drawdown": _safe_float(row["sp500_drawdown"]),
            "drawdown_severe": _safe_bool(row["drawdown_severe"]),
            "sp500_200ma": _safe_float(row["sp500_200ma"]),
            "sp500_200ma_distance": _safe_float(row["sp500_200ma_distance"]),
            "below_200ma": _safe_bool(row["below_200ma"]),
        },
    }