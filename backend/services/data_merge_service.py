"""
data_merge_service.py
─────────────────────
Merges macro (monthly) and market (daily) datasets into ONE aligned
daily-frequency master DataFrame.

Key design decisions:
  • Macro-level deltas (3M changes, derived columns) are computed BEFORE
    forward-filling to daily — avoids the shift-on-ffilled-data bug.
  • Forward-fill carries each monthly observation until the next release.
  • Inner join ensures every row has both macro context and market prices.
  • Critical columns must be non-NaN; optional columns allowed to be NaN.
"""

import os
import pandas as pd
import numpy as np
from pandas.tseries.offsets import BDay

from services.macro_service import fetch_macro_data
from services.market_service import fetch_market_data

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MACRO_CSV = os.path.join(BASE_DIR, "data", "macroData", "macro_data.csv")
MARKET_CSV = os.path.join(BASE_DIR, "data", "marketData", "market_raw.csv")
MASTER_CSV = os.path.join(BASE_DIR, "data", "master_dataset.csv")


def _expected_latest_market_day() -> pd.Timestamp:
    """
    Return the most recent business day that should reasonably exist in market data.
    Using previous business day avoids false stale alarms on intraday requests.
    """
    return (pd.Timestamp.today().normalize() - BDay(1)).normalize()


def _is_dataset_stale(df: pd.DataFrame) -> bool:
    """Detect whether cached master data is stale vs expected market freshness."""
    if df.empty:
        return True
    last_dt = pd.Timestamp(df.index.max()).normalize()
    return last_dt < _expected_latest_market_day()


# ── loaders ──────────────────────────────────────────────────────────

def _load_macro() -> pd.DataFrame:
    """Load cleaned macro data (monthly frequency)."""
    df = pd.read_csv(MACRO_CSV, index_col=0, parse_dates=False)
    df.index = pd.to_datetime(df.index, errors="coerce")
    df.index.name = "Date"
    df = df[df.index.notna()]
    df = df.sort_index()
    return df


def _load_market() -> pd.DataFrame:
    """Load raw market data (daily frequency)."""
    df = pd.read_csv(MARKET_CSV, index_col=0, parse_dates=False)
    # Force datetime — stray non-date rows (e.g. trailing garbage) become NaT and get dropped.
    df.index = pd.to_datetime(df.index, errors="coerce")
    df.index.name = "Date"
    df = df[df.index.notna()]
    df = df.sort_index()
    # yfinance concat / CSV round-trips can introduce duplicate column names; keep first.
    df = df.loc[:, ~df.columns.duplicated(keep="first")]
    return df


# ── macro pre-processing (monthly, BEFORE ffill) ────────────────────

def _enrich_macro(macro: pd.DataFrame) -> pd.DataFrame:
    """
    Compute derived macro columns on the MONTHLY dataframe,
    before any forward-fill to daily frequency.

    shift(3) = 3 months because the index is monthly.
    """
    df = macro.copy()

    # --- Unemployment 3-month change ---
    df["unemp_3m_change"] = df["unemployment"] - df["unemployment"].shift(3)

    # --- CPI YoY 3-month trend (acceleration) ---
    df["cpi_3m_change"] = df["cpi_yoy"] - df["cpi_yoy"].shift(3)
    # --- Policy path over last 3 months (proxy for "no-cuts" regime) ---
    df["fed_funds_3m_change"] = df["fed_funds"] - df["fed_funds"].shift(3)

    # --- Credit spread 3-month change ---
    df["credit_spread_3m_change"] = (
        df["credit_spread_hy"] - df["credit_spread_hy"].shift(3)
    )

    # --- Nominal 10Y ≈ real_rate_10y + cpi_yoy  (Fisher approximation) ---
    df["nominal_10y"] = df["real_rate_10y"] + df["cpi_yoy"]

    # --- Nominal 10Y 3-month change ---
    df["nominal_10y_3m_change"] = df["nominal_10y"] - df["nominal_10y"].shift(3)

    # --- Nominal 2Y ≈ nominal_10y - yield_curve_10y2y ---
    df["nominal_2y"] = df["nominal_10y"] - df["yield_curve_10y2y"]

    return df


# ── master dataset builder ───────────────────────────────────────────

def build_master_dataset(save: bool = True) -> pd.DataFrame:
    """
    1. Load macro (monthly) and market (daily)
    2. Enrich macro with derived columns (on monthly freq)
    3. Forward-fill macro to market's daily index
    4. Inner join
    5. Drop rows missing critical columns
    6. Save to CSV
    """
    macro = _load_macro()
    market = _load_market()

    # Step 2: enrich macro at monthly freq
    macro = _enrich_macro(macro)

    # Step 3: forward-fill macro to daily using market's date index
    macro_daily = macro.reindex(market.index, method="ffill")

    # Step 4: inner join (only dates where both exist)
    # rsuffix avoids silent duplicate names (e.g. rare macro/market key clashes).
    master = market.join(macro_daily, how="inner", rsuffix="_macro")
    master = master.loc[:, ~master.columns.duplicated(keep="first")]

    # Step 5: drop rows where critical columns are NaN
    critical_cols = ["sp500", "vix", "unemployment", "cpi_yoy",
                     "yield_curve_10y2y", "credit_spread_hy"]
    before = len(master)
    master = master.dropna(subset=critical_cols)
    after = len(master)
    print(f"[merge] Dropped {before - after} rows missing critical columns. "
          f"Shape: {master.shape}")

    # Step 6: save
    if save:
        os.makedirs(os.path.dirname(MASTER_CSV), exist_ok=True)
        master.to_csv(MASTER_CSV)
        print(f"[merge] Master dataset saved -> {MASTER_CSV}")

    return master


# ── cached access ────────────────────────────────────────────────────

def get_master_dataset() -> pd.DataFrame:
    """
    Load master dataset from CSV cache if available,
    otherwise build from scratch.
    """
    if os.path.exists(MASTER_CSV):
        df = pd.read_csv(MASTER_CSV, index_col=0, parse_dates=False)
        df.index = pd.to_datetime(df.index, errors="coerce")
        df.index.name = "Date"
        df = df[df.index.notna()]
        df = df.loc[:, ~df.columns.duplicated(keep="first")]

        # Hygiene guard: historical bad caches may store non-PMI values
        # (e.g. ~12,000 manufacturing employment) under pmi_ism.
        if "pmi_ism" in df.columns:
            pmi = pd.to_numeric(df["pmi_ism"], errors="coerce")
            invalid = (pmi < 10) | (pmi > 90)
            if invalid.any():
                df.loc[invalid, "pmi_ism"] = np.nan

        # Corrupt cache: misaligned columns (e.g. VIX/VVIX swapped, SPX ~100).
        try:
            last_sp = float(pd.to_numeric(df["sp500"], errors="coerce").iloc[-1])
            last_vix = float(pd.to_numeric(df["vix"], errors="coerce").iloc[-1])
            last_vvix = (
                float(pd.to_numeric(df["vvix"], errors="coerce").iloc[-1])
                if "vvix" in df.columns
                else np.nan
            )
            vix_vvix_swapped = (
                last_vix > 85
                and not np.isnan(last_vvix)
                and last_vvix < 65
                and last_vvix > 5
            )
            if last_sp < 500 or vix_vvix_swapped:
                print(
                    "[merge] Master cache failed sanity check (e.g. bad VIX/VVIX or SPX). "
                    "Rebuilding from on-disk market/macro CSVs..."
                )
                try:
                    return build_master_dataset(save=True)
                except Exception as e1:
                    print(f"[merge] Rebuild from CSV failed: {e1}. Trying full data refresh...")
                    try:
                        fetch_macro_data()
                        fetch_market_data()
                        return build_master_dataset(save=True)
                    except Exception as e2:
                        print(f"[merge] Full refresh failed: {e2}")
        except Exception:
            pass

        if not _is_dataset_stale(df):
            return df

        print(
            f"[merge] Cached dataset stale (last={pd.Timestamp(df.index.max()).date()}). "
            "Refreshing macro + market sources..."
        )
        try:
            fetch_macro_data()
            fetch_market_data()
            refreshed = build_master_dataset(save=True)
            print(
                f"[merge] Refresh complete. New last date: "
                f"{pd.Timestamp(refreshed.index.max()).date()}"
            )
            return refreshed
        except Exception as e:
            # Graceful fallback so API remains available even if data vendors fail.
            print(f"[merge] Refresh failed, serving stale cache: {e}")
            return df
    return build_master_dataset()


def get_latest_row() -> pd.Series:
    """Return the most recent row of the master dataset."""
    df = get_master_dataset()
    return df.iloc[-1]


# ── CLI entry point for standalone testing ───────────────────────────

if __name__ == "__main__":
    print("Building master dataset...")
    df = build_master_dataset()
    print(f"\nFinal shape: {df.shape}")
    print(f"Date range: {df.index[0]} -> {df.index[-1]}")
    print(f"\nColumns ({len(df.columns)}):")
    for c in df.columns:
        non_null = df[c].notna().sum()
        print(f"  {c:35s}  {non_null}/{len(df)} non-null")
    print(f"\nLast 3 rows:")
    print(df.tail(3))
