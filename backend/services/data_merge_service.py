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

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MACRO_CSV = os.path.join(BASE_DIR, "data", "macroData", "macro_data.csv")
MARKET_CSV = os.path.join(BASE_DIR, "data", "marketData", "market_raw.csv")
MASTER_CSV = os.path.join(BASE_DIR, "data", "master_dataset.csv")


# ── loaders ──────────────────────────────────────────────────────────

def _load_macro() -> pd.DataFrame:
    """Load cleaned macro data (monthly frequency)."""
    df = pd.read_csv(MACRO_CSV, index_col=0, parse_dates=True)
    df.index.name = "Date"
    df = df.sort_index()
    return df


def _load_market() -> pd.DataFrame:
    """Load raw market data (daily frequency)."""
    df = pd.read_csv(MARKET_CSV, index_col=0, parse_dates=True)
    df.index.name = "Date"
    df = df.sort_index()
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
    master = market.join(macro_daily, how="inner")

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
        print(f"[merge] Master dataset saved → {MASTER_CSV}")

    return master


# ── cached access ────────────────────────────────────────────────────

def get_master_dataset() -> pd.DataFrame:
    """
    Load master dataset from CSV cache if available,
    otherwise build from scratch.
    """
    if os.path.exists(MASTER_CSV):
        df = pd.read_csv(MASTER_CSV, index_col=0, parse_dates=True)
        df.index.name = "Date"
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
    print(f"Date range: {df.index[0]} → {df.index[-1]}")
    print(f"\nColumns ({len(df.columns)}):")
    for c in df.columns:
        non_null = df[c].notna().sum()
        print(f"  {c:35s}  {non_null}/{len(df)} non-null")
    print(f"\nLast 3 rows:")
    print(df.tail(3))
