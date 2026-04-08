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
    df = pd.read_csv(csv_path, index_col=0, parse_dates=True)
    df = df.sort_index()

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

    dates = df.index.strftime("%Y-%m-%d").tolist()
    series = {}
    for csv_col, resp_key in COL_MAP.items():
        if csv_col not in df.columns:
            series[resp_key] = {"yield": [None] * len(dates), "price": [None] * len(dates)}
            continue
        raw = [None if (isinstance(v, float) and math.isnan(v)) else float(v) for v in df[csv_col].tolist()]
        series[resp_key] = {"yield": raw, "price": [derive_price(v) for v in raw]}

    return {"dates": dates, "series": series}
