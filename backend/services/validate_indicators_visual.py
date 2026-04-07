"""
validate_indicators_visual.py
─────────────────────────────
Visual check for key macro indicators.

Goal:
- See if indicators behave correctly in 2008, 2020, 2022
- Each indicator gets its own panel so scales don't interfere
- Crisis windows shaded on every panel

Usage:
    python validate_indicators_visual.py --csv data/macroData/macro_data.csv
"""

import argparse
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


CRISIS_WINDOWS = [
    ("2007-06-01", "2009-06-01", "2008 GFC"),
    ("2020-01-01", "2020-12-01", "COVID"),
    ("2022-01-01", "2022-12-01", "Rate Hikes"),
]

CRISIS_COLORS = ["#ff4444", "#ff9900", "#ffdd00"]


def load_data(path):
    df = pd.read_csv(path, sep=None, engine="python", index_col=0)
    df.index = pd.to_datetime(df.index, errors="coerce")
    df = df[~df.index.isna()].sort_index()
    df = df.apply(pd.to_numeric, errors="coerce")
    df = df.ffill()
    return df


def plot_indicators(df):
    # Each tuple: (column, title, expected behaviour note, reference line)
    indicators = [
        ("unemployment",      "Unemployment (%)",
         "Should spike in 2020 (~14.8%) and rise in 2008",      None),
        ("cpi_yoy",           "CPI YoY (%)",
         "Should spike in 2022 (~9%), low/deflation in 2020",    3.0),
        ("yield_curve_10y2y", "Yield Curve 10Y-2Y (pp)",
         "Should invert (go negative) in 2022 and 2007",         0.0),
        ("credit_spread_hy",  "HY Credit Spread (pp)",
         "Should blow out in 2008 GFC (~20pp)",                  None),
        ("real_rate_10y",     "Real Rate 10Y (%)",
         "Should go deeply negative in 2020-2021",               0.0),
        ("fed_funds",         "Fed Funds Rate (%)",
         "Should spike in 2022-2023, near zero in 2020",         None),
    ]

    available = [(col, title, note, ref)
                 for col, title, note, ref in indicators
                 if col in df.columns]

    if not available:
        print("No expected columns found.")
        return

    n = len(available)
    fig, axes = plt.subplots(n, 1, figsize=(14, 3.2 * n), sharex=True)
    fig.patch.set_facecolor("#0f1117")

    if n == 1:
        axes = [axes]

    for ax, (col, title, note, ref) in zip(axes, available):
        ax.set_facecolor("#1a1d2e")
        ax.tick_params(colors="#cccccc", labelsize=8)
        for spine in ax.spines.values():
            spine.set_color("#444")

        # Crisis shading
        for (start, end, label), color in zip(CRISIS_WINDOWS, CRISIS_COLORS):
            ax.axvspan(pd.Timestamp(start), pd.Timestamp(end),
                       alpha=0.15, color=color, label=label)

        # Reference line (e.g. 0 for yield curve, 3% for CPI)
        if ref is not None:
            ax.axhline(ref, color="#888888", linewidth=0.8,
                       linestyle="--", alpha=0.7)

        # Plot the indicator
        ax.plot(df.index, df[col], color="#4db8ff", linewidth=1.4)
        ax.fill_between(df.index, df[col], alpha=0.15, color="#4db8ff")

        ax.set_ylabel(title, color="#cccccc", fontsize=9)
        ax.set_title(note, color="#888888", fontsize=8, pad=3)

    # Crisis legend on top panel only
    handles = [
        plt.Rectangle((0, 0), 1, 1, fc=c, alpha=0.4)
        for c in CRISIS_COLORS
    ]
    labels = [w[2] for w in CRISIS_WINDOWS]
    axes[0].legend(handles, labels, loc="upper left",
                   framealpha=0.3, fontsize=8, labelcolor="white")

    fig.suptitle("Macro Indicators — Visual Validation",
                 color="white", fontsize=13, y=1.01)

    plt.xticks(color="#cccccc")
    plt.tight_layout()
    plt.savefig("indicators_plot.png", dpi=150,
                bbox_inches="tight", facecolor=fig.get_facecolor())
    print("Saved: indicators_plot.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    args = parser.parse_args()

    df = load_data(args.csv)
    plot_indicators(df)