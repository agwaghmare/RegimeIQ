from fredapi import Fred
import pandas as pd
import numpy as np
import os
from dotenv import load_dotenv

load_dotenv()

FRED_API_KEY = os.getenv("FRED_API_KEY")
fred = Fred(api_key=FRED_API_KEY)

INDICATORS = {
    "yield_curve": "T10Y2Y",
    "cpi": "CPIAUCSL",
    "unemployment": "UNRATE",
    "industrial_prod": "INDPRO",
    "fed_funds": "FEDFUNDS",
    "credit_spread": "BAMLH0A0HYM2"
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MACRO_DATA_DIR = os.path.join(BASE_DIR, "data", "macroData")
os.makedirs(MACRO_DATA_DIR, exist_ok=True)


def fetch_macro_data(start="2005-01-01"):
    data = {}

    for name, code in INDICATORS.items():
        series = fred.get_series(code, observation_start=start)  # filter at source
        series.index = pd.to_datetime(series.index)              # ensure DatetimeIndex
        series = series.resample("MS").last()                    # align all to month-start
        data[name] = series

    df = pd.DataFrame(data)

    print(f"[macro] raw shape before dropna: {df.shape}")
    print(df.tail(5))

    # Derived transformations
    df["cpi_yoy"] = df["cpi"].pct_change(12) * 100
    df["indpro_yoy"] = df["industrial_prod"].pct_change(12) * 100

    # Save RAW (before dropna) so you never get an empty file
    raw_path = os.path.join(MACRO_DATA_DIR, "macro_data_raw.csv")
    df.to_csv(raw_path)
    print(f"[macro] raw CSV saved: {raw_path}")

    df = df.dropna()
    print(f"[macro] shape after dropna: {df.shape}")

    # Save clean version
    csv_path = os.path.join(MACRO_DATA_DIR, "macro_data.csv")
    df.to_csv(csv_path)
    print(f"[macro] clean CSV saved: {csv_path} — {len(df)} rows")

    return df
