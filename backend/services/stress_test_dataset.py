"""
stress_test_dataset.py
──────────────────────
Simple dataset check before running scoring.

Checks:
1. Date continuity
2. Missing values
3. Basic scale sanity
"""

import argparse
import pandas as pd


# ─────────────────────────────────────────
# LOAD DATA
# ─────────────────────────────────────────
def load_data(path):
    df = pd.read_csv(path, index_col=0)
    df.index = pd.to_datetime(df.index, errors="coerce")
    df = df.sort_index()
    df = df.apply(pd.to_numeric, errors="coerce")
    return df


# ─────────────────────────────────────────
# 1. DATE CHECK
# ─────────────────────────────────────────
def check_dates(df):
    print("\n=== DATE CHECK ===")

    print("Range:", df.index[0].date(), "→", df.index[-1].date())
    print("Rows:", len(df))

    # Missing months
    expected = pd.date_range(df.index[0], df.index[-1], freq="MS")
    missing = expected.difference(df.index)

    if len(missing) == 0:
        print("✅ No missing months")
    else:
        print(f"⚠️ Missing months: {len(missing)}")


# ─────────────────────────────────────────
# 2. MISSING VALUES
# ─────────────────────────────────────────
def check_missing(df):
    print("\n=== MISSING VALUES ===")

    total = df.isna().sum().sum()
    print("Total missing:", total)

    if total == 0:
        print("✅ No missing values")
        return

    missing_cols = df.isna().sum()
    missing_cols = missing_cols[missing_cols > 0]

    for col, val in missing_cols.items():
        print(f"{col}: {val}")


# ─────────────────────────────────────────
# 3. SCALE CHECK
# ─────────────────────────────────────────
def check_scales(df):
    print("\n=== SCALE CHECK ===")

    checks = {
        "unemployment": (0, 30),
        "cpi_yoy": (-5, 20),
        "yield_curve_10y2y": (-5, 10),
        "fed_funds": (0, 25),
        "credit_spread_hy": (0, 30),
        "pmi_ism": (0, 100),
    }

    for col, (lo, hi) in checks.items():
        if col not in df.columns:
            print(f"⚠️ {col} missing")
            continue

        series = df[col].dropna()
        if len(series) == 0:
            print(f"⚠️ {col} empty")
            continue

        mn, mx = series.min(), series.max()

        if mn < lo or mx > hi:
            print(f"❌ {col} out of range ({mn:.2f}, {mx:.2f})")
        else:
            print(f"✅ {col} OK ({mn:.2f}, {mx:.2f})")


# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    args = parser.parse_args()

    df = load_data(args.csv)

    print("\nLoaded dataset:", args.csv)
    print(f"{len(df)} rows, {df.shape[1]} columns")

    check_dates(df)
    check_missing(df)
    check_scales(df)

    print("\nDone.")


if __name__ == "__main__":
    main()