"""
allocation_service.py
─────────────────────
Maps regime labels → portfolio allocation weights.

Allocation table:
  Risk-On  : 75% equities, 15% bonds, 10% alternatives
  Neutral  : 55% equities, 35% bonds, 10% alternatives
  Risk-Off : 35% equities, 55% bonds, 10% alternatives
  Crisis   : 15% equities, 65% bonds, 20% alternatives
"""

from __future__ import annotations

import pandas as pd
import numpy as np

from services.data_merge_service import get_master_dataset


# ─── allocation map ──────────────────────────────────────────────────

ALLOCATION_MAP: dict[str, dict[str, float]] = {
    "Risk-On": {
        "equities": 0.75,
        "bonds":    0.15,
        "alternatives":     0.10,
    },
    "Neutral": {
        "equities": 0.55,
        "bonds":    0.35,
        "alternatives":     0.10,
    },
    "Risk-Off": {
        "equities": 0.35,
        "bonds":    0.55,
        "alternatives":     0.10,
    },
    "Crisis": {
        "equities": 0.15,
        "bonds":    0.65,
        "alternatives":     0.20,
    },
}

# ETF tickers that correspond to each asset class in our market data
ETF_MAPPING: dict[str, str] = {
    "equities": "SPY",
    "bonds":    "TLT",
    "alternatives":     "GLD",
}

# Illustrative single-name equities by regime (not price-scored in our CSVs).
REGIME_EQUITY_EXAMPLES: dict[str, list[dict[str, str]]] = {
    "Risk-On": [
        {"ticker": "NVDA", "name": "NVIDIA", "role": "Semis / AI beta — typical risk-on leadership."},
        {"ticker": "CAT", "name": "Caterpillar", "role": "Cyclical industrials — capex and early-cycle tilt."},
        {"ticker": "AAPL", "name": "Apple", "role": "Quality mega-cap anchor for the growth sleeve."},
    ],
    "Neutral": [
        {"ticker": "MSFT", "name": "Microsoft", "role": "Defensive mega-cap tech / recurring cash flows."},
        {"ticker": "CAT", "name": "Caterpillar", "role": "Industrials barometer without full risk-on chase."},
        {"ticker": "JNJ", "name": "Johnson & Johnson", "role": "Healthcare staples — lower-beta balance."},
    ],
    "Risk-Off": [
        {"ticker": "KO", "name": "Coca-Cola", "role": "Staples — earnings visibility when growth slows."},
        {"ticker": "PG", "name": "Procter & Gamble", "role": "Household demand — relative drawdown resilience."},
        {"ticker": "CAT", "name": "Caterpillar", "role": "Smaller sleeve only; cyclical if conditions stabilize."},
    ],
    "Crisis": [
        {"ticker": "WMT", "name": "Walmart", "role": "Discount retail — defensive consumer spend."},
        {"ticker": "XLU", "name": "Utilities (sector ETF)", "role": "Low-beta yield when correlations spike."},
        {"ticker": "GLD", "name": "Gold (GLD)", "role": "Aligns with crisis gold sleeve in the regime map."},
    ],
}


def regime_equity_examples(regime: str) -> list[dict[str, str]]:
    return [dict(x) for x in REGIME_EQUITY_EXAMPLES.get(regime, REGIME_EQUITY_EXAMPLES["Neutral"])]


# ─── build-time validation ───────────────────────────────────────────

for _regime, _alloc in ALLOCATION_MAP.items():
    _total = sum(_alloc.values())
    assert abs(_total - 1.0) < 1e-9, (
        f"Allocation for {_regime} sums to {_total}, expected 1.0"
    )


# ─── point-in-time ───────────────────────────────────────────────────

def get_allocation(regime: str) -> dict:
    """
    Return allocation weights for a given regime.

    Parameters
    ----------
    regime : one of "Risk-On", "Neutral", "Risk-Off", "Crisis"

    Returns
    -------
    dict with regime, allocation weights, and ETF mapping.

    Raises
    ------
    ValueError if regime is not recognised.
    """
    if regime not in ALLOCATION_MAP:
        raise ValueError(
            f"Unknown regime: '{regime}'. "
            f"Valid regimes: {list(ALLOCATION_MAP.keys())}"
        )

    return {
        "regime": regime,
        "allocation": ALLOCATION_MAP[regime].copy(),
        "etf_mapping": ETF_MAPPING.copy(),
    }


# ─── historical ──────────────────────────────────────────────────────

def get_allocation_historical(regime_df: pd.DataFrame) -> pd.DataFrame:
    """
    Attach allocation weights to every row of a regime history DataFrame.

    Parameters
    ----------
    regime_df : DataFrame with a 'regime' column
                (from regime_service.classify_regime_historical)

    Returns
    -------
    Same DataFrame with added columns: alloc_equities, alloc_bonds, alloc_alternatives.
    """
    df = regime_df.copy()

    for asset in ["equities", "bonds", "alternatives"]:
        df[f"alloc_{asset}"] = df["regime"].map(
            lambda r, a=asset: ALLOCATION_MAP.get(r, ALLOCATION_MAP["Neutral"])[a]
        )

    return df


# ─── transitions ─────────────────────────────────────────────────────

def get_allocation_transitions(regime_df: pd.DataFrame) -> list[dict]:
    """
    Identify every date where the regime (and therefore allocation) changed.

    Parameters
    ----------
    regime_df : DataFrame with 'regime' column and DatetimeIndex.

    Returns
    -------
    list of dicts, one per transition event.
    """
    shifted = regime_df["regime"].shift(1)
    mask = regime_df["regime"] != shifted
    # Skip the first row (always shows as a "transition" from NaN)
    mask.iloc[0] = False

    transitions = []
    for date, row in regime_df[mask].iterrows():
        idx: int = int(regime_df.index.get_loc(date))  # type: ignore[arg-type]
        from_regime = regime_df["regime"].iloc[idx - 1] if idx > 0 else None  # type: ignore[operator]

        transitions.append({
            "date": str(pd.Timestamp(date).date()),  # type: ignore[arg-type]
            "from_regime": from_regime,
            "to_regime": row["regime"],
            "new_allocation": ALLOCATION_MAP.get(
                row["regime"], ALLOCATION_MAP["Neutral"]
            ).copy(),
        })

    return transitions


def _annualized_sharpe(returns: pd.Series) -> float:
    clean = pd.to_numeric(returns, errors="coerce").dropna()
    if clean.empty:
        return 0.0
    vol = clean.std()
    if vol == 0 or pd.isna(vol):
        return 0.0
    return float((clean.mean() / vol) * np.sqrt(252))


def get_rebalance_plan(regime: str, risk_tolerance: str = "moderate") -> dict:
    """
    Return concrete buy suggestions + 6-holding Sharpe-ranked portfolio.
    """
    master = get_master_dataset().copy()
    # Keep recent window to reflect current market conditions.
    px = master.tail(252)
    returns = px.pct_change().dropna(how="all")

    asset_map = {
        "stocks": {
            "SPY": "sp500",
            "QQQ": "nasdaq",
            "IWM": "russell2000",
            "EFA": "intl_dev",
            "EEM": "em_equity",
        },
        "bonds": {
            "TLT": "tlt",
            "SHY": "shy",
            "LQD": "lqd",
            "HYG": "hyg",
            "EMB": "emb",
        },
        "commodities": {
            "GLD": "gld",
            "USO": "uso",
            "DBA": "dba",
        },
    }

    def rank_assets(group: dict[str, str]) -> list[dict]:
        ranked: list[dict] = []
        for ticker, col in group.items():
            if col not in returns.columns:
                continue
            r = returns[col]
            sharpe = _annualized_sharpe(r)
            if np.isnan(sharpe):
                continue
            ranked.append(
                {
                    "ticker": ticker,
                    "sharpe": round(float(sharpe), 3),
                    "ann_return": round(float(r.mean() * 252), 4),
                    "ann_vol": round(float(r.std() * np.sqrt(252)), 4),
                }
            )
        ranked.sort(key=lambda x: x["sharpe"], reverse=True)
        return ranked

    ranked_stocks = rank_assets(asset_map["stocks"])
    ranked_bonds = rank_assets(asset_map["bonds"])
    ranked_commodities = rank_assets(asset_map["commodities"])

    # Guarantee explicit "what to buy" guidance by bucket.
    buy_recommendations = {
        "stocks": ranked_stocks[:2],
        "bonds": ranked_bonds[:2],
        "commodities": ranked_commodities[:2],
    }

    # Risk profile tilt from base regime mix.
    base = ALLOCATION_MAP.get(regime, ALLOCATION_MAP["Neutral"]).copy()
    risk = (risk_tolerance or "moderate").strip().lower()
    if risk == "conservative":
        base["equities"] = max(0.05, base["equities"] - 0.10)
        base["bonds"] = min(0.85, base["bonds"] + 0.10)
    elif risk == "aggressive":
        base["equities"] = min(0.90, base["equities"] + 0.10)
        base["bonds"] = max(0.05, base["bonds"] - 0.10)

    total = base["equities"] + base["bonds"] + base["alternatives"]
    for k in base:
        base[k] = base[k] / total

    selected = buy_recommendations["stocks"] + buy_recommendations["bonds"] + buy_recommendations["commodities"]
    if len(selected) < 6:
        # fallback fill from all assets by Sharpe
        all_ranked = ranked_stocks + ranked_bonds + ranked_commodities
        seen = {a["ticker"] for a in selected}
        for asset in all_ranked:
            if asset["ticker"] not in seen:
                selected.append(asset)
                seen.add(asset["ticker"])
            if len(selected) >= 6:
                break
    selected = selected[:6]

    equities_count = max(1, len(buy_recommendations["stocks"]))
    bonds_count = max(1, len(buy_recommendations["bonds"]))
    commodities_count = max(1, len(buy_recommendations["commodities"]))
    eq_w = base["equities"] / equities_count
    bd_w = base["bonds"] / bonds_count
    cm_w = base["alternatives"] / commodities_count

    target_weights: dict[str, float] = {}
    for a in buy_recommendations["stocks"]:
        target_weights[a["ticker"]] = round(eq_w, 4)
    for a in buy_recommendations["bonds"]:
        target_weights[a["ticker"]] = round(bd_w, 4)
    for a in buy_recommendations["commodities"]:
        target_weights[a["ticker"]] = round(cm_w, 4)

    # Normalize to exactly 1 in case of rounding.
    tw_total = sum(target_weights.values())
    if tw_total > 0:
        target_weights = {k: round(v / tw_total, 4) for k, v in target_weights.items()}

    model_portfolio = []
    for a in selected:
        model_portfolio.append(
            {
                "ticker": a["ticker"],
                "sharpe": a["sharpe"],
                "target_weight": target_weights.get(a["ticker"], 0.0),
            }
        )

    return {
        "regime": regime,
        "risk_tolerance": risk,
        "bucket_weights": {
            "equities": round(base["equities"], 4),
            "bonds": round(base["bonds"], 4),
            "commodities": round(base["alternatives"], 4),
        },
        "buy_recommendations": buy_recommendations,
        "model_portfolio": model_portfolio,
        "regime_equity_examples": regime_equity_examples(regime),
    }
