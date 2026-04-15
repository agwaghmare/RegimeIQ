from fredapi import Fred
import pandas as pd
import numpy as np
import os
from dotenv import load_dotenv

load_dotenv()

FRED_API_KEY = os.getenv("FRED_API_KEY")

def _get_fred():
    if not FRED_API_KEY:
        raise ValueError("FRED_API_KEY environment variable is not set.")
    return Fred(api_key=FRED_API_KEY)

INDICATORS = {
    # --- Rates & Yield Curve ---
    "yield_curve_10y2y":    "T10Y2Y",       # 10Y - 2Y spread (recession signal)
    "yield_curve_10y3m":    "T10Y3M",       # 10Y - 3M spread (alt recession signal)
    "fed_funds":            "FEDFUNDS",     # Effective Fed Funds Rate
    "real_rate_10y":        "REAINTRATREARAT10Y",  # 10Y Real Interest Rate (TIPS)
    "boj_10y_yield":        "IRLTLT01JPM156N",  # Japan 10Y govt yield (BoJ policy proxy)
    "ecb_policy_rate":      "ECBDFR",       # ECB deposit facility rate
    "uk_10y_gilt_yield":    "IRLTLT01GBM156N",  # UK 10Y gilt yield

    # --- Inflation ---
    "cpi":                  "CPIAUCSL",     # CPI All Urban Consumers
    "core_cpi":             "CPILFESL",     # Core CPI (ex food & energy)
    "pce":                  "PCEPI",        # PCE Price Index (Fed's preferred)
    "core_pce":             "PCEPILFE",     # Core PCE (ex food & energy)
    "ppi":                  "PPIACO",       # Producer Price Index

    # --- Labor Market ---
    "unemployment":         "UNRATE",       # Unemployment Rate
    "u6_unemployment":      "U6RATE",       # U-6 Underemployment Rate
    "jobless_claims":       "ICSA",         # Initial Jobless Claims (weekly)
    "nonfarm_payrolls":     "PAYEMS",       # Total Nonfarm Payrolls

    # --- Growth & Activity ---
    "industrial_prod":      "INDPRO",       # Industrial Production Index
    "retail_sales":         "RSAFS",        # Advance Retail Sales
    "capacity_util":        "TCU",          # Capacity Utilization
    # FRED does not reliably provide headline ISM PMI in all environments.
    # Keep this key optional in downstream logic.
    "pmi_ism":              "NAPM",
    "housing_starts":       "HOUST",        # Housing Starts

    # --- Credit & Financial Conditions ---
    "credit_spread_hy":     "BAMLH0A0HYM2",         # HY Credit Spread (OAS)
    "credit_spread_ig":     "BAMLC0A0CM",            # IG Credit Spread (OAS)
    "financial_cond":       "NFCI",                  # Chicago Fed National Financial Conditions Index
    "consumer_credit":      "TOTALSL",               # Total Consumer Credit

    # --- Money Supply ---
    "m2":                   "M2SL",         # M2 Money Supply
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MACRO_DATA_DIR = os.path.join(BASE_DIR, "data", "macroData")
os.makedirs(MACRO_DATA_DIR, exist_ok=True)


def fetch_macro_data(start="2005-01-01"):
    fred = _get_fred()
    data = {}

    for name, code in INDICATORS.items():
        try:
            series = fred.get_series(code, observation_start=start)
            series.index = pd.to_datetime(series.index)
            series = series.resample("MS").last()   # align all to month-start
            data[name] = series
            print(f"[macro] OK {name} ({code}) - {len(series)} rows")
        except Exception as e:
            print(f"[macro] FAILED {name} ({code}): {e}")

    df = pd.DataFrame(data)
    print(f"[macro] raw shape before dropna: {df.shape}")

    # --- Derived Transformations ---
    def pct_yoy(col: str) -> pd.Series:
        if col not in df.columns:
            return pd.Series(np.nan, index=df.index, dtype="float64")
        return df[col].pct_change(12, fill_method=None) * 100

    def diff1(col: str) -> pd.Series:
        if col not in df.columns:
            return pd.Series(np.nan, index=df.index, dtype="float64")
        return df[col].diff(1)

    # YoY % changes
    df["cpi_yoy"]           = pct_yoy("cpi")
    df["core_cpi_yoy"]      = pct_yoy("core_cpi")
    df["pce_yoy"]           = pct_yoy("pce")
    df["core_pce_yoy"]      = pct_yoy("core_pce")
    df["ppi_yoy"]           = pct_yoy("ppi")
    df["indpro_yoy"]        = pct_yoy("industrial_prod")
    df["retail_sales_yoy"]  = pct_yoy("retail_sales")
    df["m2_yoy"]            = pct_yoy("m2")
    df["payrolls_mom"]      = diff1("nonfarm_payrolls")        # MoM change in jobs (thousands)

    # Save raw CSV before dropna
    raw_path = os.path.join(MACRO_DATA_DIR, "macro_data_raw.csv")
    df.to_csv(raw_path)
    print(f"[macro] raw CSV saved -> {raw_path}")

    df = df.ffill().dropna()
    print(f"[macro] shape after dropna: {df.shape}")

    # Save clean CSV
    csv_path = os.path.join(MACRO_DATA_DIR, "macro_data.csv")
    df.to_csv(csv_path)
    print(f"[macro] clean CSV saved -> {csv_path} - {len(df)} rows")

    return df
