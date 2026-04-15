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
from datetime import date, timedelta
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MACRO_CSV = os.path.join(BASE_DIR, "data", "macroData", "macro_data.csv")
MARKET_CSV = os.path.join(BASE_DIR, "data", "marketData", "market_raw.csv")
MASTER_CSV = os.path.join(BASE_DIR, "data", "master_dataset.csv")

# Market data: refresh if last row is older than today minus this many days
# (accounts for weekends — last market close is at most 3 days ago)
_MARKET_STALE_DAYS = 3
# Macro data: refresh if last row is older than 35 days (monthly releases)
_MACRO_STALE_DAYS = 35


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
        print(f"[merge] Master dataset saved -> {MASTER_CSV}")

    return master


# ── staleness helpers ─────────────────────────────────────────────────

def _csv_last_date(path: str) -> date | None:
    """Return the last index date of a CSV, or None if file is missing/empty."""
    if not os.path.exists(path):
        return None
    try:
        df = pd.read_csv(path, index_col=0, parse_dates=True)
        if df.empty:
            return None
        return df.index[-1].date()
    except Exception:
        return None


def _refresh_market_if_stale() -> None:
    """
    If market_raw.csv is missing or its last row is older than
    _MARKET_STALE_DAYS ago, fetch incremental data from yfinance and
    update the file.
    """
    from services.market_service import fetch_market_data

    last = _csv_last_date(MARKET_CSV)
    cutoff = date.today() - timedelta(days=_MARKET_STALE_DAYS)

    if last is None or last < cutoff:
        if last is None:
            print("[merge] market_raw.csv missing — fetching full history")
            fetch_market_data(start="2005-01-01")
        else:
            # Incremental: fetch only from a week before the last row so we
            # get any corrections, then merge back into the existing CSV.
            fetch_from = (last - timedelta(days=7)).isoformat()
            print(f"[merge] market data stale (last={last}) — refreshing from {fetch_from}")
            try:
                import yfinance as yf
                from services.market_service import TICKERS

                existing = pd.read_csv(MARKET_CSV, index_col=0, parse_dates=True)
                existing.index.name = "Date"

                new_data: dict = {}
                for name, ticker in TICKERS.items():
                    try:
                        df = yf.download(ticker, start=fetch_from, progress=False, auto_adjust=True)
                        if df.empty:
                            continue
                        if isinstance(df.columns, pd.MultiIndex):
                            df.columns = df.columns.get_level_values(0)
                        df = df[["Close"]].rename(columns={"Close": name})
                        new_data[name] = df
                    except Exception as e:
                        print(f"[merge] incremental fetch failed for {name}: {e}")

                if new_data:
                    new_df = pd.concat(new_data.values(), axis=1)
                    new_df.columns = [str(c) for c in new_df.columns]
                    new_df.index.name = "Date"
                    # Drop overlapping rows from existing then append
                    existing = existing[existing.index < new_df.index.min()]
                    merged = pd.concat([existing, new_df])
                    merged.to_csv(MARKET_CSV)
                    print(f"[merge] market_raw.csv updated → last row: {merged.index[-1].date()}")
            except Exception as e:
                print(f"[merge] incremental market refresh failed: {e}")
    else:
        print(f"[merge] market data fresh (last={last})")


def _refresh_macro_if_stale() -> None:
    """
    If macro_data.csv is missing or its last row is older than
    _MACRO_STALE_DAYS ago, re-fetch from FRED.
    """
    from services.macro_service import fetch_macro_data

    last = _csv_last_date(MACRO_CSV)
    cutoff = date.today() - timedelta(days=_MACRO_STALE_DAYS)

    if last is None or last < cutoff:
        print(f"[merge] macro data stale (last={last}) — re-fetching from FRED")
        try:
            fetch_macro_data(start="2005-01-01")
        except Exception as e:
            print(f"[merge] macro refresh failed: {e}")
    else:
        print(f"[merge] macro data fresh (last={last})")


# ── cached access ────────────────────────────────────────────────────

def get_master_dataset() -> pd.DataFrame:
    """
    Load master dataset, auto-refreshing stale source data first.
    Market data is refreshed if > _MARKET_STALE_DAYS old.
    Macro data is refreshed if > _MACRO_STALE_DAYS old.
    Master CSV is always rebuilt after any source refresh.
    """
    _refresh_market_if_stale()
    _refresh_macro_if_stale()

    # Check if master CSV is still current after potential source refresh
    market_last = _csv_last_date(MARKET_CSV)
    master_last = _csv_last_date(MASTER_CSV)

    needs_rebuild = (
        master_last is None
        or market_last is None
        or master_last < market_last
    )

    if not needs_rebuild:
        df = pd.read_csv(MASTER_CSV, index_col=0, parse_dates=True)
        df.index.name = "Date"
        if "pmi_ism" in df.columns:
            pmi = pd.to_numeric(df["pmi_ism"], errors="coerce")
            invalid = (pmi < 10) | (pmi > 90)
            if invalid.any():
                df.loc[invalid, "pmi_ism"] = np.nan
        print(f"[merge] loaded master CSV (last={master_last}, {len(df)} rows)")
        return df

    print("[merge] rebuilding master dataset from updated sources")
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
