import yfinance as yf
import pandas as pd
import numpy as np
import os

TICKERS = {
    # --- US Equity ---
    "sp500":        "^GSPC",
    "nasdaq":       "^IXIC",
    "russell2000":  "^RUT",

    # --- International Equity ---
    "intl_dev":     "EFA",
    "em_equity":    "EEM",

    # --- Fixed Income ---
    "tlt":          "TLT",      # long bonds
    "shy":          "SHY",      # short bonds
    "tip":          "TIP",      # TIPS / inflation expectations
    "lqd":          "LQD",      # IG corporate bonds
    "hyg":          "HYG",      # HY corporate bonds
    "emb":          "EMB",      # EM bonds

    # --- Commodities ---
    "gld":          "GLD",      # gold
    "uso":          "USO",      # oil
    "dba":          "DBA",      # agriculture

    # --- USD ---
    "uup":          "UUP",      # USD index ETF

    # --- Equity Volatility Term Structure ---
    "vix":          "^VIX",
    "vix9d":        "^VIX9D",   # 9-day VIX
    "vix3m":        "^VIX3M",   # 3-month VIX
    "vix6m":        "^VIX6M",   # 6-month VIX
    "vvix":         "^VVIX",    # vol of vol
    "skew":         "^SKEW",    # tail risk / crash fear

    # --- Cross-Asset Volatility ---
    "move":         "^MOVE",    # bond vol index
    "ovx":          "^OVX",     # crude oil vol
    "gvz":          "^GVZ",     # gold vol
    "vxeem":        "^VXEEM",   # EM equity vol
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARKET_DATA_DIR = os.path.join(BASE_DIR, "data", "marketData")
os.makedirs(MARKET_DATA_DIR, exist_ok=True)


def fetch_market_data(start="2005-01-01"):
    data = {}

    for name, ticker in TICKERS.items():
        try:
            df = yf.download(ticker, start=start, progress=False, auto_adjust=True)

            if df.empty:
                print(f"[market] ✗ EMPTY {name} ({ticker}) — skipping")
                continue

            # Flatten MultiIndex columns from newer yfinance versions
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            df = df[["Close"]].rename(columns={"Close": name})
            data[name] = df
            print(f"[market] ✓ {name} ({ticker}) — {len(df)} rows")

        except Exception as e:
            print(f"[market] ✗ FAILED {name} ({ticker}): {e}")

    merged = pd.concat(data.values(), axis=1)
    merged.columns = [str(c) for c in merged.columns]

    # Save raw before dropna so you never lose data
    raw_path = os.path.join(MARKET_DATA_DIR, "market_raw.csv")
    merged.to_csv(raw_path)
    print(f"[market] raw CSV saved → {raw_path} — {len(merged)} rows")

    merged = merged.dropna()
    print(f"[market] shape after dropna: {merged.shape}")

    return merged


def compute_market_features(start="2005-01-01"):
    df = fetch_market_data(start)
    returns = df.pct_change()

    # --- Momentum (1M, 3M, 6M, 12M) ---
    for asset in ["sp500", "nasdaq", "russell2000", "tlt", "gld", "uso"]:
        if asset in df.columns:
            df[f"{asset}_1m_mom"]  = df[asset].pct_change(21)
            df[f"{asset}_3m_mom"]  = df[asset].pct_change(63)
            df[f"{asset}_6m_mom"]  = df[asset].pct_change(126)
            df[f"{asset}_12m_mom"] = df[asset].pct_change(252)

    # --- Realized Volatility (21-day rolling annualized) ---
    for asset in ["sp500", "nasdaq", "russell2000", "tlt", "hyg", "em_equity"]:
        if asset in df.columns:
            df[f"{asset}_realized_vol"] = (
                returns[asset].rolling(21).std() * np.sqrt(252)
            )

    # --- Drawdown from Rolling Max ---
    for asset in ["sp500", "nasdaq", "russell2000", "em_equity"]:
        if asset in df.columns:
            rolling_max = df[asset].cummax()
            df[f"{asset}_drawdown"] = (df[asset] - rolling_max) / rolling_max

    # --- Relative Strength Ratios ---
    if all(c in df.columns for c in ["sp500", "tlt"]):
        df["eq_bond_ratio"]      = df["sp500"] / df["tlt"]         # risk-on vs risk-off
    if all(c in df.columns for c in ["hyg", "lqd"]):
        df["hy_ig_ratio"]        = df["hyg"] / df["lqd"]           # credit risk appetite
    if all(c in df.columns for c in ["nasdaq", "sp500"]):
        df["growth_value_ratio"] = df["nasdaq"] / df["sp500"]      # growth vs broad market
    if all(c in df.columns for c in ["russell2000", "sp500"]):
        df["small_large_ratio"]  = df["russell2000"] / df["sp500"] # small vs large cap
    if all(c in df.columns for c in ["gld", "sp500"]):
        df["gold_sp_ratio"]      = df["gld"] / df["sp500"]         # inflation hedge demand
    if all(c in df.columns for c in ["em_equity", "intl_dev"]):
        df["em_dm_ratio"]        = df["em_equity"] / df["intl_dev"] # EM vs developed
    if all(c in df.columns for c in ["tip", "tlt"]):
        df["tip_tlt_ratio"]      = df["tip"] / df["tlt"]           # real vs nominal bonds
    if all(c in df.columns for c in ["uso", "gld"]):
        df["oil_gold_ratio"]     = df["uso"] / df["gld"]           # oil vs gold (growth vs safety)

    # --- VIX Momentum ---
    if "vix" in df.columns:
        df["vix_1m_change"]  = df["vix"].pct_change(21)
        df["vix_3m_change"]  = df["vix"].pct_change(63)

    # --- VIX Term Structure ---
    if all(c in df.columns for c in ["vix3m", "vix"]):
        df["vix_term_slope"]   = df["vix3m"] - df["vix"]       # positive = contango (calm)
        df["vix_vix3m_ratio"]  = df["vix"] / df["vix3m"]       # >1 = short-term panic
    if all(c in df.columns for c in ["vix9d", "vix"]):
        df["vix9d_vix_ratio"]  = df["vix9d"] / df["vix"]       # very short-term spike
    if all(c in df.columns for c in ["vix6m", "vix"]):
        df["vix_6m_slope"]     = df["vix6m"] - df["vix"]       # longer-term structure

    # --- Vol of Vol & Tail Risk ---
    if "vvix" in df.columns:
        df["vvix_1m_change"]   = df["vvix"].pct_change(21)     # acceleration in tail risk
    if "skew" in df.columns:
        df["skew_1m_change"]   = df["skew"].pct_change(21)     # rising = more crash fear

    # --- Cross-Asset Vol Ratios ---
    if all(c in df.columns for c in ["move", "vix"]):
        df["bond_eq_vol_ratio"] = df["move"] / df["vix"]       # bond stress vs equity stress
    if all(c in df.columns for c in ["ovx", "vix"]):
        df["oil_eq_vol_ratio"]  = df["ovx"] / df["vix"]        # commodity vs equity fear
    if all(c in df.columns for c in ["vxeem", "vix"]):
        df["em_eq_vol_ratio"]   = df["vxeem"] / df["vix"]      # EM stress vs US stress
    if all(c in df.columns for c in ["gvz", "vix"]):
        df["gold_eq_vol_ratio"] = df["gvz"] / df["vix"]        # gold vol vs equity vol

    df = df.dropna()

    # Save features CSV
    csv_path = os.path.join(MARKET_DATA_DIR, "market_features.csv")
    df.to_csv(csv_path)
    print(f"[market] features CSV saved → {csv_path} — {len(df)} rows")

    return df
