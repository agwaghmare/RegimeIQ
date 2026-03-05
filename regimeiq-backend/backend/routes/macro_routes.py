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
