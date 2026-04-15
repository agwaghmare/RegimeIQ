from __future__ import annotations

from datetime import date
import pandas as pd


# User-provided CME FedWatch snapshot (conditional meeting probabilities).
# Values are percentages and converted to 0..1 when used.
_BANDS = ["225-250", "250-275", "275-300", "300-325", "325-350", "350-375", "375-400"]
_ROWS = [
    ("2026-04-29", [0.0, 0.0, 0.0, 0.0, 0.0, 97.4, 2.6]),
    ("2026-06-17", [0.0, 0.0, 0.0, 0.0, 7.4, 90.2, 2.4]),
    ("2026-07-29", [0.0, 0.0, 0.0, 0.5, 12.7, 84.6, 2.2]),
    ("2026-09-16", [0.0, 0.0, 0.0, 0.5, 12.6, 84.1, 2.8]),
    ("2026-10-28", [0.0, 0.0, 0.0, 1.3, 17.4, 78.7, 2.6]),
    ("2026-12-09", [0.0, 0.0, 0.2, 3.4, 25.6, 68.5, 2.2]),
    ("2027-01-27", [0.0, 0.0, 0.3, 4.5, 27.6, 65.5, 2.1]),
    ("2027-03-17", [0.0, 0.0, 0.5, 5.5, 29.4, 62.5, 2.0]),
    ("2027-04-28", [0.0, 0.1, 0.8, 6.6, 30.8, 59.9, 1.9]),
    ("2027-06-09", [0.0, 0.2, 1.7, 10.4, 35.4, 50.7, 1.6]),
    ("2027-07-28", [0.0, 0.3, 2.7, 13.4, 37.3, 44.7, 1.4]),
    ("2027-09-15", [0.1, 1.0, 5.7, 20.1, 39.4, 32.6, 1.0]),
    ("2027-10-27", [0.3, 1.7, 7.9, 23.0, 38.3, 27.9, 0.9]),
    ("2027-12-08", [0.5, 3.0, 10.9, 26.1, 36.2, 22.4, 0.7]),
]


def estimate_fedwatch_probabilities(master_df: pd.DataFrame) -> dict:
    """
    Uses the provided CME table snapshot to compute next-3m cut/hold/hike.
    Baseline "hold" band is inferred from the front meeting's highest-probability bucket.
    """
    _ = master_df  # reserved for future live integration
    front_row = _ROWS[0][1]
    current_idx = int(max(range(len(front_row)), key=lambda i: front_row[i]))
    current_band = _BANDS[current_idx]

    first_three = _ROWS[:3]
    cut = hold = hike = 0.0
    for _, row in first_three:
        probs = [x / 100.0 for x in row]
        cut += sum(probs[:current_idx])
        hold += probs[current_idx]
        hike += sum(probs[current_idx + 1 :])
    n = float(len(first_three))
    cut, hold, hike = cut / n, hold / n, hike / n

    return {
        "source": "cme_snapshot",
        "as_of": str(date.today()),
        "assumed_current_target_range": current_band,
        "next_3m": {
            "cut": round(cut, 4),
            "hold": round(hold, 4),
            "hike": round(hike, 4),
        },
        "meetings": [
            {"date": d, "probs_pct": {band: row[i] for i, band in enumerate(_BANDS)}}
            for d, row in _ROWS
        ],
    }
