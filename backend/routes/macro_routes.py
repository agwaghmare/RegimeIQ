from fastapi import APIRouter
from services.macro_service import get_macro_cached
from services.data_merge_service import get_master_dataset
import pandas as pd

router = APIRouter()

@router.get("/")
def get_macro_data():
    df = get_macro_cached()

    result = df.tail(10).reset_index()

    date_col = result.columns[0]
    result = result.rename(columns={date_col: "date"})
    result["date"] = result["date"].astype(str)

    return result.to_dict(orient="list")


@router.get("/global-history")
def get_global_macro_history(years: int = 5):
    full = get_master_dataset().copy()
    end = full.index.max()
    start = end - pd.DateOffset(years=max(1, years))
    df = full[full.index >= start]

    # Weekly sampling keeps payload small while preserving trend shape.
    w = df.resample("W-FRI").last().dropna(how="all")

    def series_payload(col: str, duration_years: float = 7.0):
        y = pd.to_numeric(w[col], errors="coerce") if col in w.columns else pd.Series(index=w.index, dtype=float)
        dy = y.diff()
        # Bond price proxy: dP/P ≈ -Duration * dY, where dY is decimal yield move.
        ret = (-duration_years * (dy / 100.0)).fillna(0.0)
        price = (1.0 + ret).cumprod() * 100.0
        return {
            "yield": [None if pd.isna(v) else float(v) for v in y.tolist()],
            "price": [None if pd.isna(v) else float(v) for v in price.tolist()],
        }

    # Annual scatter: real yield vs S&P 500 YoY return — use full history for meaningful range
    combined = pd.DataFrame({
        "sp500": pd.to_numeric(full["sp500"], errors="coerce") if "sp500" in full.columns else pd.Series(dtype=float),
        "real_yield": pd.to_numeric(full["real_rate_10y"], errors="coerce") if "real_rate_10y" in full.columns else pd.Series(dtype=float),
    }).dropna()
    combined["sp500_yoy"] = combined["sp500"].pct_change(252) * 100
    annual = combined.resample("YE").last().dropna(subset=["sp500_yoy", "real_yield"])
    scatter = [
        {"year": int(r.Index.year), "real_yield": round(float(r.real_yield), 3), "sp500_yoy": round(float(r.sp500_yoy), 2)}
        for r in annual.itertuples()
    ]

    # Historical percentile for central bank divergence bars — use full history so percentiles span all-time range
    rate_cols = {"fed_funds": "fed", "ecb_policy_rate": "ecb", "boj_10y_yield": "boj"}
    cb_stats = {}
    for csv_col, key in rate_cols.items():
        s = pd.to_numeric(full[csv_col], errors="coerce").dropna() if csv_col in full.columns else pd.Series(dtype=float)
        if s.empty:
            cb_stats[key] = {"current": None, "pct": None, "min": None, "max": None, "change_3m": None}
            continue
        cur = float(s.iloc[-1])
        lo, hi = float(s.min()), float(s.max())
        span = hi - lo or 1
        pct = round((cur - lo) / span * 100, 1)
        ch3 = round(float(s.iloc[-1] - s.iloc[-4]), 3) if len(s) >= 4 else None
        cb_stats[key] = {"current": round(cur, 3), "pct": pct, "min": round(lo, 3), "max": round(hi, 3), "change_3m": ch3}

    return {
        "dates": [str(pd.Timestamp(d).date()) for d in w.index],
        "series": {
            "boj_10y_yield": series_payload("boj_10y_yield"),
            "ecb_policy_rate": series_payload("ecb_policy_rate", duration_years=4.0),
            "uk_10y_gilt_yield": series_payload("uk_10y_gilt_yield"),
            "us_real_10y": series_payload("real_rate_10y"),
        },
        "scatter": scatter,
        "cb_stats": cb_stats,
    }
