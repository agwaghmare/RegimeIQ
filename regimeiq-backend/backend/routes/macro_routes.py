import math
import os

import pandas as pd
from fastapi import APIRouter

from services.macro_service import fetch_macro_data

router = APIRouter()

@router.get("/")
def get_macro_data():
    df = fetch_macro_data()

    result = df.tail(10).reset_index()

    date_col = result.columns[0]
    result = result.rename(columns={date_col: "date"})
    result["date"] = result["date"].astype(str)

    return result.to_dict(orient="list")


@router.get("/global-history")
def get_global_macro_history():
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_path = os.path.join(BASE_DIR, "data", "macroData", "macro_data.csv")
    master_path = os.path.join(BASE_DIR, "data", "master_dataset.csv")
    df = pd.read_csv(csv_path, index_col=0, parse_dates=True).sort_index()
    master = pd.read_csv(master_path, index_col=0, parse_dates=True).sort_index()

    COL_MAP = {
        "boj_10y_yield":     "boj_10y_yield",
        "ecb_policy_rate":   "ecb_policy_rate",
        "uk_10y_gilt_yield": "uk_10y_gilt_yield",
        "real_rate_10y":     "us_real_10y",
    }

    def derive_price(y_val):
        if y_val is None or (isinstance(y_val, float) and math.isnan(y_val)):
            return None
        y = max(float(y_val) / 100.0, 0.001)
        return round(100.0 / (1.0 + y), 4)

    def clean(val):
        return None if (isinstance(val, float) and math.isnan(val)) else float(val)

    dates = df.index.strftime("%Y-%m-%d").tolist()
    series = {}
    for csv_col, resp_key in COL_MAP.items():
        if csv_col not in df.columns:
            series[resp_key] = {"yield": [None] * len(dates), "price": [None] * len(dates)}
            continue
        raw = [clean(v) for v in df[csv_col].tolist()]
        series[resp_key] = {"yield": raw, "price": [derive_price(v) for v in raw]}

    # Build annual scatter: one point per year (Dec snapshot) of real yield vs S&P YoY return
    sp500_aligned = master["sp500"].reindex(df.index, method="ffill") if "sp500" in master.columns else pd.Series([None] * len(df), index=df.index)
    real_yield = df["real_rate_10y"] if "real_rate_10y" in df.columns else pd.Series([None] * len(df), index=df.index)
    combined = pd.DataFrame({"sp500": sp500_aligned, "real_yield": real_yield}).dropna()
    combined["sp500_yoy"] = combined["sp500"].pct_change(12) * 100
    annual = combined.resample("YE").last().dropna(subset=["sp500_yoy", "real_yield"])
    scatter = [
        {"year": int(row.Index.year), "real_yield": round(float(row.real_yield), 3), "sp500_yoy": round(float(row.sp500_yoy), 2)}
        for row in annual.itertuples()
    ]

    # Historical percentile stats for central bank divergence bars
    rate_cols = {
        "fed_funds":        "fed",
        "ecb_policy_rate":  "ecb",
        "boj_10y_yield":    "boj",
    }
    cb_stats = {}
    for csv_col, key in rate_cols.items():
        src = master if csv_col in master.columns else df
        series_raw = src[csv_col].dropna() if csv_col in src.columns else pd.Series([], dtype=float)
        if len(series_raw) == 0:
            cb_stats[key] = {"current": None, "pct": None, "min": None, "max": None, "change_3m": None}
            continue
        current_val = float(series_raw.iloc[-1])
        hist_min = float(series_raw.min())
        hist_max = float(series_raw.max())
        hist_span = hist_max - hist_min or 1
        pct = round((current_val - hist_min) / hist_span * 100, 1)
        change_3m = round(float(series_raw.iloc[-1] - series_raw.iloc[-4]), 3) if len(series_raw) >= 4 else None
        cb_stats[key] = {"current": round(current_val, 3), "pct": pct, "min": round(hist_min, 3), "max": round(hist_max, 3), "change_3m": change_3m}

    return {"dates": dates, "series": series, "scatter": scatter, "cb_stats": cb_stats}
