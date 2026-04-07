"""
validate_crisis_scoring.py
──────────────────────────
Minimal validation script for:
- Checking crisis scoring (2008, 2020, 2022)
- Inspecting yearly breakdowns

Market data (SP500 + VIX) is fetched automatically from Yahoo Finance.
Requires: pip install yfinance

Usage:
    python validate_crisis_scoring.py --csv data/macroData/macro_data.csv
    python validate_crisis_scoring.py --csv data/macroData/macro_data.csv --year 2008
"""

import argparse
import pandas as pd
import numpy as np
import yfinance as yf


# ─────────────────────────────────────────
# LOAD MACRO DATA
# ─────────────────────────────────────────
def load_data(path):
    df = pd.read_csv(path, sep=None, engine="python", index_col=0)
    df.index = pd.to_datetime(df.index, errors="coerce")
    df = df[~df.index.isna()].sort_index()
    df = df.apply(pd.to_numeric, errors="coerce")
    return df


# ─────────────────────────────────────────
# FETCH MARKET DATA FROM YAHOO FINANCE
# ─────────────────────────────────────────
def fetch_market_data(start_date, end_date):
    """
    Pulls SP500 (^GSPC) and VIX (^VIX) from Yahoo Finance.
    Resamples to monthly frequency to match macro data.
    Returns a DataFrame with columns: sp500, vix
    """
    print("Fetching market data from Yahoo Finance...")

    try:
        sp500 = yf.download("^GSPC", start=start_date, end=end_date,
                            auto_adjust=True, progress=False)["Close"]
        vix   = yf.download("^VIX",  start=start_date, end=end_date,
                            auto_adjust=True, progress=False)["Close"]
    except Exception as e:
        print(f"  Warning: Could not fetch market data — {e}")
        return None

    if sp500.empty or vix.empty:
        print("  Warning: Yahoo Finance returned empty data")
        return None

    # Flatten MultiIndex columns if present
    if isinstance(sp500, pd.DataFrame):
        sp500 = sp500.iloc[:, 0]
    if isinstance(vix, pd.DataFrame):
        vix = vix.iloc[:, 0]

    # Resample to month-start to match macro data frequency
    market = pd.DataFrame({
        "sp500": sp500.resample("MS").last(),
        "vix":   vix.resample("MS").mean(),
    })

    print(f"  SP500 + VIX loaded: {market.index[0].date()} → {market.index[-1].date()}")
    return market


# ─────────────────────────────────────────
# COMPUTE MARKET SIGNALS
# ─────────────────────────────────────────
def compute_market_signals(market):
    """
    Computes the 4 market risk flags from SP500 and VIX data.
    """
    s = pd.DataFrame(index=market.index)
    sp500 = market["sp500"]
    vix   = market["vix"]

    # momentum_negative: SP500 6M return < 0
    s["momentum_negative"] = sp500.pct_change(6) < 0

    # drawdown_severe: SP500 > 15% below its rolling 12M high
    rolling_high = sp500.rolling(12).max()
    drawdown = (sp500 - rolling_high) / rolling_high * 100
    s["drawdown_severe"] = drawdown < -15

    # vix_above_25: VIX monthly average > 25
    s["vix_above_25"] = vix > 25

    # below_200ma: SP500 below its 200-day MA (approximated as 10M MA on monthly data)
    s["below_200ma"] = sp500 < sp500.rolling(10).mean()

    return s


# ─────────────────────────────────────────
# SIGNALS
# ─────────────────────────────────────────
def compute_signals(df, market_signals=None):
    s = pd.DataFrame(index=df.index)

    # Growth
    s["unemp_rising"]        = df["unemployment"].diff(3) > 0.3 if "unemployment" in df else False
    s["yield_curve_inverted"] = df["yield_curve_10y2y"] < 0 if "yield_curve_10y2y" in df else False
    s["pmi_below_50"]        = df["pmi_ism"] < 50 if "pmi_ism" in df else False

    # Inflation
    if "cpi_yoy" in df:
        s["cpi_above_3"]      = df["cpi_yoy"] > 3
        s["cpi_trend_rising"] = df["cpi_yoy"].rolling(3).mean().diff() > 0
    else:
        s["cpi_above_3"]      = False
        s["cpi_trend_rising"] = False

    s["real_rate_negative"] = df["real_rate_10y"] < 0 if "real_rate_10y" in df else False

    # Financial
    s["credit_spread_widening"] = df["credit_spread_hy"].diff(3) > 0.5 if "credit_spread_hy" in df else False
    s["rate_rising_sharply"]    = df["fed_funds"].diff(3) > 0.5 if "fed_funds" in df else False
    s["dollar_strengthening"]   = df["financial_cond"].diff(3) > 0.3 if "financial_cond" in df else False

    # Market — use Yahoo Finance data if available, otherwise NaN
    if market_signals is not None:
        # Align market signals to macro data index
        aligned = market_signals.reindex(df.index, method="nearest")
        s["momentum_negative"] = aligned["momentum_negative"]
        s["drawdown_severe"]   = aligned["drawdown_severe"]
        s["vix_above_25"]      = aligned["vix_above_25"]
        s["below_200ma"]       = aligned["below_200ma"]
    else:
        s["momentum_negative"] = np.nan
        s["drawdown_severe"]   = np.nan
        s["vix_above_25"]      = np.nan
        s["below_200ma"]       = np.nan

    return s


# ─────────────────────────────────────────
# SCORING
# ─────────────────────────────────────────
def score(signals):
    def sum_flags(cols):
        return sum(signals[c].fillna(False).astype(int) for c in cols)

    out = pd.DataFrame(index=signals.index)

    growth    = ["unemp_rising", "yield_curve_inverted", "pmi_below_50"]
    inflation = ["cpi_above_3", "cpi_trend_rising", "real_rate_negative"]
    financial = ["credit_spread_widening", "rate_rising_sharply", "dollar_strengthening"]
    market    = ["momentum_negative", "drawdown_severe", "vix_above_25", "below_200ma"]

    out["growth"]    = sum_flags(growth)
    out["inflation"] = sum_flags(inflation)
    out["financial"] = sum_flags(financial)
    out["market"]    = sum_flags(market)
    out["total"]     = out.sum(axis=1)

    return out


# ─────────────────────────────────────────
# CRISIS CHECK
# ─────────────────────────────────────────
def check_crisis(scores, has_market):
    print("\n=== CRISIS CHECK ===")
    if not has_market:
        print("(market score = 0, no Yahoo Finance data — run with internet connection)")

    crises = {
        "2008": ("2007-01-01", "2009-12-31"),
        "2020": ("2020-01-01", "2020-12-31"),
        "2022": ("2022-01-01", "2022-12-31"),
    }

    for name, (start, end) in crises.items():
        window = scores.loc[start:end]

        if window.empty:
            print(f"{name}: no data")
            continue

        peak      = window["total"].max()
        peak_date = window["total"].idxmax()
        g = int(window.loc[peak_date, "growth"])
        i = int(window.loc[peak_date, "inflation"])
        f = int(window.loc[peak_date, "financial"])
        m = int(window.loc[peak_date, "market"])

        print(f"{name}: peak = {peak}/13 on {peak_date.date()}  "
              f"[G={g} I={i} F={f} M={m}]")


# ─────────────────────────────────────────
# YEAR CHECK
# ─────────────────────────────────────────
def get_regime(t):
    if t <= 3:   return "Risk-On  🟢"
    if t <= 7:   return "Neutral  🟡"
    if t <= 10:  return "Risk-Off 🟠"
    return               "Crisis   🔴"


def check_year(scores, year):
    print(f"\n=== YEAR {year} ===")

    data = scores.loc[f"{year}-01-01":f"{year}-12-31"]

    if data.empty:
        print("No data")
        return

    for date, row in data.iterrows():
        g = int(row["growth"])
        i = int(row["inflation"])
        f = int(row["financial"])
        m = int(row["market"])
        t = int(row["total"])
        print(f"{date.date()} -> G={g} I={i} F={f} M={m}  total={t}/13  {get_regime(t)}")

    total     = data["total"]
    peak_val  = int(total.max())
    peak_date = total.idxmax()
    mean_val  = total.mean()

    print(f"\n--- {year} Summary ---")
    print(f"Peak   : {peak_val}/13 on {peak_date.date()}  {get_regime(peak_val)}")
    print(f"Average: {mean_val:.1f}/13  {get_regime(round(mean_val))}")

    rc = {"Risk-On": 0, "Neutral": 0, "Risk-Off": 0, "Crisis": 0}
    for t in total:
        if t <= 3:    rc["Risk-On"]  += 1
        elif t <= 7:  rc["Neutral"]  += 1
        elif t <= 10: rc["Risk-Off"] += 1
        else:         rc["Crisis"]   += 1
    print("Months :", "  ".join(f"{k}={v}" for k, v in rc.items()))

    data = scores.loc[f"{year}-01-01":f"{year}-12-31"]

    if data.empty:
        print("No data")
        return






# ─────────────────────────────────────────
# OVERALL SUMMARY
# ─────────────────────────────────────────
def regime_label(s):
    if s <= 3:  return "Risk-On"
    if s <= 7:  return "Neutral"
    if s <= 10: return "Risk-Off"
    return "Crisis"


def overall_summary(scores):
    print("\n=== OVERALL SUMMARY ===")
    total = scores["total"]

    print(f"\nAverage score      : {total.mean():.1f}/13")

    peak_val  = total.max()
    peak_date = total.idxmax()
    g = int(scores.loc[peak_date, "growth"])
    i = int(scores.loc[peak_date, "inflation"])
    f = int(scores.loc[peak_date, "financial"])
    m = int(scores.loc[peak_date, "market"])
    print(f"Highest month      : {peak_date.date()}  ->  {peak_val}/13  [G={g} I={i} F={f} M={m}]")

    print(f"\nMonths per regime:")
    for label, lo, hi in [("Risk-On  (0-3)",  0, 3),
                           ("Neutral  (4-7)",  4, 7),
                           ("Risk-Off (8-10)", 8, 10),
                           ("Crisis   (11-13)",11, 13)]:
        count = ((total >= lo) & (total <= hi)).sum()
        pct   = count / len(total) * 100
        bar   = chr(9608) * int(pct / 2)
        print(f"  {label} : {count:>4} months  ({pct:>5.1f}%)  {bar}")

    mid   = len(total) // 2
    first = total.iloc[:mid].mean()
    last  = total.iloc[mid:].mean()
    diff  = last - first
    if diff > 0.3:
        trend = f"Rising  (first half {first:.1f} -> second half {last:.1f})"
    elif diff < -0.3:
        trend = f"Falling (first half {first:.1f} -> second half {last:.1f})"
    else:
        trend = f"Stable  (first half {first:.1f} -> second half {last:.1f})"
    print(f"\nScore trend        : {trend}")


# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--year", type=int)
    parser.add_argument("--summary", action="store_true")
    args = parser.parse_args()

    df = load_data(args.csv)
    print("Loaded:", args.csv)

    start = str(df.index[0].date())
    end   = str(df.index[-1].date())
    market = fetch_market_data(start, end)

    market_signals = compute_market_signals(market) if market is not None else None
    has_market     = market_signals is not None

    signals = compute_signals(df, market_signals)
    scores  = score(signals)

    if args.year:
        check_year(scores, args.year)
    elif args.summary:
        overall_summary(scores)
    else:
        check_crisis(scores, has_market)


if __name__ == "__main__":
    main()