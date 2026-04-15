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
    df = get_master_dataset().copy()
    end = df.index.max()
    start = end - pd.DateOffset(years=max(1, years))
    df = df[df.index >= start]

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

    return {
        "dates": [str(pd.Timestamp(d).date()) for d in w.index],
        "series": {
            "boj_10y_yield": series_payload("boj_10y_yield"),
            "ecb_policy_rate": series_payload("ecb_policy_rate", duration_years=4.0),
            "uk_10y_gilt_yield": series_payload("uk_10y_gilt_yield"),
            "us_real_10y": series_payload("real_rate_10y"),
        },
    }
