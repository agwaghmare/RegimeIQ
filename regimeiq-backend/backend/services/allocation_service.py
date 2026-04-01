"""
allocation_service.py
─────────────────────
Maps regime labels → portfolio allocation weights.

Allocation table:
  Risk-On  : 75% equities, 15% bonds, 10% gold
  Neutral  : 55% equities, 35% bonds, 10% gold
  Risk-Off : 35% equities, 55% bonds, 10% gold
  Crisis   : 15% equities, 65% bonds, 20% gold
"""

from __future__ import annotations

import pandas as pd


# ─── allocation map ──────────────────────────────────────────────────

ALLOCATION_MAP: dict[str, dict[str, float]] = {
    "Risk-On": {
        "equities": 0.75,
        "bonds":    0.15,
        "gold":     0.10,
    },
    "Neutral": {
        "equities": 0.55,
        "bonds":    0.35,
        "gold":     0.10,
    },
    "Risk-Off": {
        "equities": 0.35,
        "bonds":    0.55,
        "gold":     0.10,
    },
    "Crisis": {
        "equities": 0.15,
        "bonds":    0.65,
        "gold":     0.20,
    },
}

# ETF tickers that correspond to each asset class in our market data
ETF_MAPPING: dict[str, str] = {
    "equities": "SPY",
    "bonds":    "TLT",
    "gold":     "GLD",
}

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
    Same DataFrame with added columns: alloc_equities, alloc_bonds, alloc_gold.
    """
    df = regime_df.copy()

    for asset in ["equities", "bonds", "gold"]:
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
